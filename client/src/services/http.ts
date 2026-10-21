import type {
  Budget,
  CashflowPoint,
  Category,
  CategorySpend,
  SpendlyApi,
  SummaryMetrics,
  Transaction,
  TransactionQuery,
} from '@/services/types'
import type { DateRangeKey } from '@/services/types'
import type { MerchantSpend } from '@/data/mock/analytics'
import type { PaymentMethod } from '@/types'

/**
 * Real HTTP client for the Spendly API.
 *
 * It speaks the API's envelope (`{ success, data, meta }`) and maps the
 * server's DTOs onto the shapes the UI renders. Set `VITE_DATA_SOURCE=api`
 * to read from the Express server instead of the bundled sample data.
 */

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  }
}

interface ApiErrorEnvelope {
  success: false
  error: {
    status: number
    code: string
    message: string
  }
}

/* ------------------------------------------------------------------ */
/* Server DTOs                                                         */
/* ------------------------------------------------------------------ */

interface ServerTransaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  category: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  description: string
  merchant: string | null
  notes: string | null
  date: string
  paymentMethod: string | null
  status: 'cleared' | 'pending'
}

interface ServerBudget {
  id: string
  category: string
  categoryName: string
  categoryColor: string
  limit: number
  spent: number
  period: 'monthly'
}

interface ServerCategory {
  id: string
  slug: string
  name: string
  color: string
  icon: string
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const PAYMENT_METHODS: PaymentMethod[] = ['card', 'bank', 'cash', 'transfer']

function toClientMethod(value: string | null): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : 'bank'
}

function toClientTransaction(dto: ServerTransaction): Transaction {
  const transaction: Transaction = {
    id: dto.id,
    merchant: dto.merchant ?? dto.description,
    categoryId: dto.category,
    categoryName: dto.categoryName,
    amount: dto.amount,
    type: dto.type,
    date: dto.date,
    status: dto.status,
    method: toClientMethod(dto.paymentMethod),
  }

  if (dto.notes) transaction.note = dto.notes
  return transaction
}

function toClientBudget(dto: ServerBudget): Budget {
  return {
    id: dto.id,
    categoryId: dto.category,
    name: dto.categoryName,
    limit: dto.limit,
    spent: dto.spent,
    color: dto.categoryColor,
    period: dto.period,
  }
}

function toClientCategory(dto: ServerCategory): Category {
  return {
    id: dto.slug,
    name: dto.name,
    color: dto.color,
    icon: dto.icon,
  }
}

/* ------------------------------------------------------------------ */
/* Query helpers                                                       */
/* ------------------------------------------------------------------ */

const RANGE_DAYS: Record<DateRangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Translates a range key into the absolute bounds the API filters on. */
function rangeToBounds(range: DateRangeKey): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString()

  if (range === '12m') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
    return { from: from.toISOString(), to }
  }

  const from = new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS)
  return { from: from.toISOString(), to }
}

/** Page size used when the caller does not ask for a specific one. */
const DEFAULT_TRANSACTION_LIMIT = 100

function toQueryString(query: TransactionQuery = {}): string {
  const params = new URLSearchParams()

  if (query.search) params.set('search', query.search)
  if (query.categoryId && query.categoryId !== 'all') params.set('category', query.categoryId)
  if (query.type && query.type !== 'all') params.set('type', query.type)
  if (query.range) {
    const { from, to } = rangeToBounds(query.range)
    params.set('from', from)
    params.set('to', to)
  }
  params.set('limit', String(query.limit ?? DEFAULT_TRANSACTION_LIMIT))

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options

  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: body
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Network request failed. Please try again.', 0)
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  if (response.status === 204) return undefined as T

  const payload = (await response.json()) as ApiEnvelope<T>
  return payload.data
}

/** Pulls the server's error message out of the failure envelope. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorEnvelope
    if (payload?.error?.message) return payload.error.message
  } catch {
    // The body was not JSON — fall through to the generic message.
  }
  return `Request failed with status ${response.status}.`
}

export function createHttpClient(baseUrl: string): SpendlyApi {
  const root = baseUrl.replace(/\/$/, '')

  return {
    getSummary(range: DateRangeKey, signal) {
      return request<SummaryMetrics>(`${root}/analytics/summary?range=${range}`, { signal })
    },
    getCashflow(range: DateRangeKey, signal) {
      return request<CashflowPoint[]>(`${root}/analytics/cashflow?range=${range}`, { signal })
    },
    getCategoryBreakdown(range: DateRangeKey, signal) {
      return request<CategorySpend[]>(`${root}/analytics/categories?range=${range}`, { signal })
    },
    async getTransactions(query, signal) {
      const transactions = await request<ServerTransaction[]>(
        `${root}/transactions${toQueryString(query)}`,
        { signal },
      )
      return transactions.map(toClientTransaction)
    },
    async getBudgets(signal) {
      const budgets = await request<ServerBudget[]>(`${root}/budgets`, { signal })
      return budgets.map(toClientBudget)
    },
    async getCategories(signal) {
      const categories = await request<ServerCategory[]>(`${root}/categories`, { signal })
      return categories.map(toClientCategory)
    },
    getTopMerchants(range: DateRangeKey, limit = 6, signal) {
      return request<MerchantSpend[]>(
        `${root}/analytics/merchants?range=${range}&limit=${limit}`,
        { signal },
      )
    },
  }
}
