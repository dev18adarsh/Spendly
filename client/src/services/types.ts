import type { MerchantSpend } from '@/data/mock/analytics'
import type {
  Budget,
  CashflowPoint,
  Category,
  CategorySpend,
  SummaryMetrics,
  Transaction,
  TransactionType,
} from '@/types'

/** Supported reporting windows. */
export type DateRangeKey = '7d' | '30d' | '90d' | '12m'

export interface DateRangeOption {
  key: DateRangeKey
  label: string
  shortLabel: string
}

export const DATE_RANGES: DateRangeOption[] = [
  { key: '7d', label: 'Last 7 days', shortLabel: '7D' },
  { key: '30d', label: 'Last 30 days', shortLabel: '30D' },
  { key: '90d', label: 'Last 90 days', shortLabel: '90D' },
  { key: '12m', label: 'Last 12 months', shortLabel: '12M' },
]

export interface TransactionQuery {
  search?: string
  categoryId?: string | 'all'
  type?: TransactionType | 'all'
  range?: DateRangeKey
  limit?: number
}

/**
 * The single interface the UI talks to.
 * `services/mock` implements it against sample data today; the HTTP client
 * implements it against the Express API once it exposes real routes.
 *
 * Every method accepts an optional `AbortSignal` so in-flight requests can be
 * cancelled when a filter changes or a view unmounts.
 */
export interface SpendlyApi {
  getSummary(range: DateRangeKey, signal?: AbortSignal): Promise<SummaryMetrics>
  getCashflow(range: DateRangeKey, signal?: AbortSignal): Promise<CashflowPoint[]>
  getCategoryBreakdown(range: DateRangeKey, signal?: AbortSignal): Promise<CategorySpend[]>
  getTransactions(query?: TransactionQuery, signal?: AbortSignal): Promise<Transaction[]>
  getBudgets(signal?: AbortSignal): Promise<Budget[]>
  getCategories(signal?: AbortSignal): Promise<Category[]>
  getTopMerchants(range: DateRangeKey, limit?: number, signal?: AbortSignal): Promise<MerchantSpend[]>
}

export type { Budget, CashflowPoint, Category, CategorySpend, SummaryMetrics, Transaction }

/* ------------------------------------------------------------------ */
/* Authentication                                                       */
/* ------------------------------------------------------------------ */

/**
 * The signed-in account.
 *
 * There is no token in here — the session lives in an HTTP-only cookie the
 * browser attaches on its own, so the app never handles a credential.
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  /** ISO-8601 timestamp of when the account was created. */
  createdAt: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

/**
 * The authentication endpoints.
 *
 * Every call is cookie-based: the browser sends the session cookie and the
 * client repeats the CSRF token in a header. Nothing is ever written to
 * `localStorage` or `sessionStorage`.
 */
export interface AuthApi {
  register(input: RegisterInput): Promise<AuthUser>
  login(input: LoginInput): Promise<AuthUser>
  logout(): Promise<void>
  /** The current account, or `null` when nobody is signed in. */
  me(signal?: AbortSignal): Promise<AuthUser | null>
}
