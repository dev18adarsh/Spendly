import type {
  AuthApi,
  AuthUser,
  Budget,
  BudgetQuery,
  CashflowPoint,
  Category,
  CategorySpend,
  LoginInput,
  OverallBudget,
  OverallBudgetDraft,
  RegisterInput,
  SpendlyApi,
  SummaryMetrics,
  Transaction,
  TransactionDraft,
  TransactionDraftUpdate,
  TransactionQuery,
} from '@/services/types'
import type { DateRangeKey, IntervalKey } from '@/services/types'
import type { MerchantSpend } from '@/data/mock/analytics'
import type { PaymentMethod } from '@/types'
import { resolveClientTimeZone } from '@/lib/timezone'

import { CSRF_HEADER, currentCsrfToken, forgetCsrfToken, rememberCsrfToken } from './csrf'

/**
 * Real HTTP client for the Spendly API.
 *
 * It speaks the API's envelope (`{ success, data, meta }`) and maps the
 * server's DTOs onto the shapes the UI renders. Set `VITE_DATA_SOURCE=api`
 * to read from the Express server instead of the bundled sample data.
 *
 * Authentication is cookie-based: every request is sent with
 * `credentials: 'include'` so the browser attaches the HTTP-only session
 * cookie, and every write repeats the CSRF token in a header. No token is
 * ever stored in `localStorage`.
 */

/** A field-level problem reported by the API's validation layer. */
export interface ApiFieldIssue {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  /** The stable error code the API returns, e.g. `INVALID_CREDENTIALS`. */
  readonly code: string
  /**
   * Field-level issues, when the API rejected the payload.
   * The API answers a 422 with one entry per offending field.
   */
  readonly details: ApiFieldIssue[]

  constructor(message: string, status: number, code = 'UNKNOWN', details: ApiFieldIssue[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Fired when the API rejects a request because the session is gone.
 *
 * The auth provider listens for it and signs the user out, which sends the
 * app back to the sign-in screen instead of showing a cryptic error.
 */
export const SESSION_EXPIRED_EVENT = 'spendly:session-expired'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Set to `false` for the "who am I?" call, where a 401 is expected. */
  notifyOnUnauthorized?: boolean
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
    details?: unknown
  }
}
/** The server's view of an account. */
interface ServerUser {
  id: string
  email: string
  name: string
  createdAt: string
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
  createdAt: string
  updatedAt: string
}

interface ServerBudget {
  id: string
  category: string
  categoryName: string
  categoryColor: string
  categoryIcon?: string
  limit: number
  spent: number
  remaining?: number
  percentUsed?: number
  status?: 'ok' | 'approaching' | 'over'
  month?: number
  year?: number
  period: 'monthly'
}

interface ServerOverallBudget {
  id: string
  limit: number
  spent: number
  remaining: number
  percentUsed: number
  status: 'ok' | 'approaching' | 'over'
  month: number
  year: number
  period: 'monthly'
  createdAt?: string
  updatedAt?: string
}

interface ServerCategory {
  id: string
  slug: string
  name: string
  color: string
  icon: string
}

/** The headline figures for a reporting window. */
interface ServerSummary {
  /** Net of the window: `income - expenses`. */
  balance: number
  /** Net of every transaction recorded before the window closed. */
  allTimeBalance: number
  income: number
  expenses: number
  savingsRate: number
  period: {
    key: string
    from: string
    to: string
    days: number
    label: string
    timeZone: string
  }
  changes: {
    balance: { value: number; isPositive: boolean }
    net: { value: number; isPositive: boolean }
    income: { value: number; isPositive: boolean }
    expenses: { value: number; isPositive: boolean }
    savingsRate: { value: number; isPositive: boolean }
  }
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
  const remaining =
    typeof dto.remaining === 'number'
      ? dto.remaining
      : Math.round((dto.limit - dto.spent) * 100) / 100

  const percentUsed =
    typeof dto.percentUsed === 'number'
      ? dto.percentUsed
      : dto.limit > 0
        ? Math.round((dto.spent / dto.limit) * 1000) / 10
        : dto.spent > 0
          ? 100
          : 0

  const status =
    dto.status ??
    (dto.spent >= dto.limit
      ? 'over'
      : dto.limit > 0 && dto.spent / dto.limit >= 0.85
        ? 'approaching'
        : 'ok')

  return {
    id: dto.id,
    categoryId: dto.category,
    name: dto.categoryName,
    limit: dto.limit,
    spent: dto.spent,
    remaining,
    percentUsed,
    status,
    month: dto.month,
    year: dto.year,
    icon: dto.categoryIcon,
    color: dto.categoryColor,
    period: dto.period,
  }
}

function toClientOverallBudget(dto: ServerOverallBudget): OverallBudget {
  return {
    id: dto.id,
    limit: dto.limit,
    spent: dto.spent,
    remaining: dto.remaining,
    percentUsed: dto.percentUsed,
    status: dto.status,
    month: dto.month,
    year: dto.year,
    period: dto.period,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
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

/**
 * Maps the server's headline figures onto the shape the UI renders.
 *
 * The mapping is explicit so a missing field can never turn into `NaN` on a
 * stat card — an unusable number is shown as a dash instead.
 */
function toClientSummary(dto: ServerSummary): SummaryMetrics {
  const safe = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0

  return {
    balance: safe(dto.balance),
    allTimeBalance: safe(dto.allTimeBalance),
    income: safe(dto.income),
    expenses: safe(dto.expenses),
    savingsRate: safe(dto.savingsRate),
    period: {
      key: dto.period?.key ?? '',
      from: dto.period?.from ?? '',
      to: dto.period?.to ?? '',
      days: safe(dto.period?.days),
      label: dto.period?.label ?? '',
      timeZone: dto.period?.timeZone ?? 'UTC',
    },
    changes: {
      balance: dto.changes?.balance ?? { value: 0, isPositive: true },
      net: dto.changes?.net ?? { value: 0, isPositive: true },
      income: dto.changes?.income ?? { value: 0, isPositive: true },
      expenses: dto.changes?.expenses ?? { value: 0, isPositive: true },
      savingsRate: dto.changes?.savingsRate ?? { value: 0, isPositive: true },
    },
  }
}

/**
 * Maps a client draft onto the API's write payload.
 *
 * The API calls the headline of an entry `description` and treats `merchant`
 * as an optional refinement. The client shows a single field, so both carry
 * the same value — search then matches either one.
 *
 * Only defined fields are included, which is what makes the same function
 * usable for a `POST` (everything) and a `PATCH` (only what changed).
 */
function toServerPayload(draft: TransactionDraft | TransactionDraftUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (draft.amount !== undefined) payload.amount = draft.amount
  if (draft.type !== undefined) payload.type = draft.type
  if (draft.categoryId !== undefined) payload.category = draft.categoryId

  if (draft.merchant !== undefined) {
    const description = draft.merchant.trim()
    payload.description = description
    if (description) payload.merchant = description
  }

  if (draft.note !== undefined) payload.notes = draft.note.trim()
  if (draft.date !== undefined) payload.date = draft.date
  if (draft.method !== undefined) payload.paymentMethod = draft.method
  if (draft.status !== undefined) payload.status = draft.status

  return payload
}

/* ------------------------------------------------------------------ */
/* Query helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * The timezone every report is calculated in.
 *
 * The browser knows which zone the user is in, the server does not — so the
 * client names it, the server validates it and both sides bucket the day
 * the same way.
 */
function currentTimeZone(): string {
  return resolveClientTimeZone()
}

/** Page size used when the caller does not ask for a specific one. */
const DEFAULT_TRANSACTION_LIMIT = 100

function toQueryString(query: TransactionQuery = {}): string {
  const params = new URLSearchParams()

  // The API rejects a blank search term, so only a real term is sent.
  const search = query.search?.trim()
  if (search) params.set('search', search)
  if (query.categoryId && query.categoryId !== 'all') params.set('category', query.categoryId)
  if (query.type && query.type !== 'all') params.set('type', query.type)
  // The reporting window is resolved by the API with the very same code the
  // analytics use, so a list and the totals beside it always agree.
  if (query.range) {
    params.set('range', query.range)
    params.set('tz', currentTimeZone())
  }
  params.set('limit', String(query.limit ?? DEFAULT_TRANSACTION_LIMIT))

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

/** The query string of a report: the window plus the zone it is read in. */
function reportQuery(range: DateRangeKey, interval?: IntervalKey): string {
  const params = new URLSearchParams({ range, tz: currentTimeZone() })
  if (interval) params.set('interval', interval)

  return `?${params.toString()}`
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** Methods that change state and therefore need a CSRF token. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * A request bound to one API root.
 *
 * Every request carries the session cookie (`credentials: 'include'`) and
 * every write carries the CSRF token.
 */
function createRequester(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '')

  /** Fetches a CSRF token for the rare case where the cookie is not readable. */
  async function fetchCsrfToken(): Promise<string> {
    const response = await fetch(`${root}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return ''

    const payload = (await response.json()) as ApiEnvelope<{ csrfToken: string }>
    const token = payload?.data?.csrfToken ?? ''
    rememberCsrfToken(token)
    return token
  }

  async function request<T>(
    path: string,
    options: RequestOptions = {},
    attempt = 0,
  ): Promise<T> {
    const { method = 'GET', body, signal, notifyOnUnauthorized = true } = options
    const headers: Record<string, string> = { Accept: 'application/json' }

    if (body) headers['Content-Type'] = 'application/json'

    if (WRITE_METHODS.has(method)) {
      const token = currentCsrfToken() ?? (await fetchCsrfToken())
      if (token) headers[CSRF_HEADER] = token
    }

    let response: Response
    try {
      response = await fetch(path, {
        method,
        signal,
        credentials: 'include',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError('Network request failed. Please try again.', 0, 'NETWORK_ERROR')
    }

    if (!response.ok) {
      const failure = await readFailure(response)

      // A stale CSRF token is not the caller's fault — the token may have
      // been replaced while the tab was open. Fetch a fresh one and try
      // once more before giving up.
      if (isCsrfFailure(failure.code) && attempt === 0 && WRITE_METHODS.has(method)) {
        forgetCsrfToken()
        const fresh = await fetchCsrfToken()
        if (fresh) return request<T>(path, options, attempt + 1)
      }

      if (response.status === 401 && notifyOnUnauthorized) {
        notifySessionExpired()
      }

      throw new ApiError(failure.message, response.status, failure.code, failure.details)
    }

    if (response.status === 204) return undefined as T

    const payload = (await response.json()) as ApiEnvelope<T>
    return payload.data
  }

  return { request, root }
}

/** Whether a failure was caused by the CSRF token. */
function isCsrfFailure(code: string): boolean {
  return code === 'CSRF_TOKEN_MISSING' || code === 'CSRF_TOKEN_INVALID'
}

/** Tells the app that the session is gone. */
function notifySessionExpired(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/** Pulls the server's error message and code out of the failure envelope. */
async function readFailure(
  response: Response,
): Promise<{ message: string; code: string; details: ApiFieldIssue[] }> {
  try {
    const payload = (await response.json()) as ApiErrorEnvelope
    if (payload?.error?.message) {
      return {
        message: payload.error.message,
        code: payload.error.code ?? 'UNKNOWN',
        details: toFieldIssues(payload.error.details),
      }
    }
  } catch {
    // The body was not JSON — fall through to the generic message.
  }
  return { message: `Request failed with status ${response.status}.`, code: 'UNKNOWN', details: [] }
}

/**
 * Normalises the `details` payload of a failure envelope.
 *
 * The API answers a validation error with `[{ field, message }]`, but other
 * failures may carry anything at all — so anything unexpected is dropped
 * rather than rendered.
 */
function toFieldIssues(details: unknown): ApiFieldIssue[] {
  if (!Array.isArray(details)) return []

  return details.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    if (typeof record.field !== 'string' || typeof record.message !== 'string') return []
    return [{ field: record.field, message: record.message }]
  })
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

export function createHttpClient(baseUrl: string): SpendlyApi {
  const { request, root } = createRequester(baseUrl)

  return {
    async getSummary(range: DateRangeKey, signal) {
      const summary = await request<ServerSummary>(
        `${root}/analytics/summary${reportQuery(range)}`,
        { signal },
      )
      return toClientSummary(summary)
    },
    getCashflow(range: DateRangeKey, interval, signal) {
      return request<CashflowPoint[]>(
        `${root}/analytics/cashflow${reportQuery(range, interval)}`,
        { signal },
      )
    },
    getCategoryBreakdown(range: DateRangeKey, signal) {
      return request<CategorySpend[]>(
        `${root}/analytics/categories${reportQuery(range)}`,
        { signal },
      )
    },
    async getTransactions(query, signal) {
      const transactions = await request<ServerTransaction[]>(
        `${root}/transactions${toQueryString(query)}`,
        { signal },
      )
      return transactions.map(toClientTransaction)
    },
    async getBudgets(
      queryOrSignal?: BudgetQuery | AbortSignal,
      maybeSignal?: AbortSignal,
    ): Promise<Budget[]> {
      const query = queryOrSignal instanceof AbortSignal ? undefined : queryOrSignal
      const signal = queryOrSignal instanceof AbortSignal ? queryOrSignal : maybeSignal

      const params = new URLSearchParams()
      if (query?.month) params.set('month', String(query.month))
      if (query?.year) params.set('year', String(query.year))
      params.set('tz', currentTimeZone())

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const budgets = await request<ServerBudget[]>(`${root}/budgets${queryString}`, { signal })
      return budgets.map(toClientBudget)
    },
    async getOverallBudget(
      query?: BudgetQuery,
      signal?: AbortSignal,
    ): Promise<OverallBudget | null> {
      const params = new URLSearchParams()
      if (query?.month) params.set('month', String(query.month))
      if (query?.year) params.set('year', String(query.year))
      params.set('tz', currentTimeZone())

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const overall = await request<ServerOverallBudget | null>(`${root}/budgets/overall${queryString}`, { signal })
      return overall ? toClientOverallBudget(overall) : null
    },
    async getCategories(signal) {
      const categories = await request<ServerCategory[]>(`${root}/categories`, { signal })
      return categories.map(toClientCategory)
    },
    getTopMerchants(range: DateRangeKey, limit = 6, signal) {
      const params = new URLSearchParams({ range, tz: currentTimeZone(), limit: String(limit) })
      return request<MerchantSpend[]>(
        `${root}/analytics/merchants?${params.toString()}`,
        { signal },
      )
    },
    async createTransaction(draft) {
      const transaction = await request<ServerTransaction>(`${root}/transactions`, {
        method: 'POST',
        body: toServerPayload(draft),
      })
      return toClientTransaction(transaction)
    },
    async updateTransaction(id, draft) {
      const transaction = await request<ServerTransaction>(
        `${root}/transactions/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: toServerPayload(draft) },
      )
      return toClientTransaction(transaction)
    },
    async deleteTransaction(id) {
      await request<void>(`${root}/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    async createBudget(draft) {
      const now = new Date()
      const budget = await request<ServerBudget>(`${root}/budgets`, {
        method: 'POST',
        body: {
          category: draft.categoryId,
          limit: draft.limit,
          month: draft.month ?? now.getMonth() + 1,
          year: draft.year ?? now.getFullYear(),
          tz: currentTimeZone(),
        },
      })
      return toClientBudget(budget)
    },
    async updateBudget(id, limit) {
      const budget = await request<ServerBudget>(`${root}/budgets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { limit },
      })
      return toClientBudget(budget)
    },
    async deleteBudget(id) {
      await request<void>(`${root}/budgets/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    async saveOverallBudget(draft: OverallBudgetDraft): Promise<OverallBudget> {
      const now = new Date()
      const budget = await request<ServerOverallBudget>(`${root}/budgets/overall`, {
        method: 'PUT',
        body: {
          limit: draft.limit,
          month: draft.month ?? now.getMonth() + 1,
          year: draft.year ?? now.getFullYear(),
          tz: currentTimeZone(),
        },
      })
      return toClientOverallBudget(budget)
    },
    async deleteOverallBudget(query?: BudgetQuery): Promise<void> {
      const params = new URLSearchParams()
      if (query?.month) params.set('month', String(query.month))
      if (query?.year) params.set('year', String(query.year))
      params.set('tz', currentTimeZone())

      const queryString = params.toString() ? `?${params.toString()}` : ''
      await request<void>(`${root}/budgets/overall${queryString}`, { method: 'DELETE' })
    },
  }
}

/* ------------------------------------------------------------------ */
/* Authentication                                                       */
/* ------------------------------------------------------------------ */

/**
 * Client for the authentication endpoints.
 *
 * `me` resolves to `null` for an anonymous visitor instead of throwing, so
 * the app can decide what to show without special-casing the error.
 */
export function createHttpAuthClient(baseUrl: string): AuthApi {
  const { request, root } = createRequester(baseUrl)

  return {
    async register(input: RegisterInput) {
      const user = await request<ServerUser>(`${root}/auth/register`, {
        method: 'POST',
        body: input,
      })
      return user
    },
    async login(input: LoginInput) {
      const user = await request<ServerUser>(`${root}/auth/login`, {
        method: 'POST',
        body: input,
      })
      return user
    },
    async logout() {
      await request<void>(`${root}/auth/logout`, { method: 'POST' })
    },
    async me(signal) {
      try {
        const user = await request<ServerUser>(`${root}/auth/me`, {
          signal,
          notifyOnUnauthorized: false,
        })
        return user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  }
}

export type { AuthUser }

