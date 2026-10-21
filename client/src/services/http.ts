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

/**
 * Real HTTP client for the Spendly API.
 *
 * It is wired up end-to-end but intentionally not the active data source yet
 * — the Express server currently exposes only a health probe. Flip
 * `VITE_DATA_SOURCE=api` once the transaction routes land and the UI will
 * read from the server without any component changes.
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
    throw new ApiError(`Request failed with status ${response.status}.`, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function toQueryString(query: TransactionQuery = {}): string {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.categoryId && query.categoryId !== 'all') params.set('categoryId', query.categoryId)
  if (query.type && query.type !== 'all') params.set('type', query.type)
  if (query.range) params.set('range', query.range)
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

export function createHttpClient(baseUrl: string): SpendlyApi {
  const root = baseUrl.replace(/\/$/, '')

  return {
    getSummary(range: DateRangeKey, signal) {
      return request<SummaryMetrics>(`${root}/summary?range=${range}`, { signal })
    },
    getCashflow(range: DateRangeKey, signal) {
      return request<CashflowPoint[]>(`${root}/analytics/cashflow?range=${range}`, { signal })
    },
    getCategoryBreakdown(range: DateRangeKey, signal) {
      return request<CategorySpend[]>(`${root}/analytics/categories?range=${range}`, { signal })
    },
    getTransactions(query, signal) {
      return request<Transaction[]>(`${root}/transactions${toQueryString(query)}`, { signal })
    },
    getBudgets(signal) {
      return request<Budget[]>(`${root}/budgets`, { signal })
    },
    getCategories(signal) {
      return request<Category[]>(`${root}/categories`, { signal })
    },
    getTopMerchants(range: DateRangeKey, limit = 6, signal) {
      return request<MerchantSpend[]>(
        `${root}/analytics/merchants?range=${range}&limit=${limit}`,
        { signal },
      )
    },
  }
}
