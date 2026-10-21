import type { MerchantSpend } from '@/data/mock/analytics'
import type {
  Budget,
  BudgetStatus,
  CashflowPoint,
  Category,
  CategorySpend,
  OverallBudget,
  PaymentMethod,
  ReportingPeriod,
  SummaryMetrics,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/types'

/** Supported reporting windows. */
export type DateRangeKey = '7d' | '30d' | '90d' | '12m' | '3y'

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
  { key: '3y', label: 'Last 3 years', shortLabel: '3Y' },
]

/** The bucket sizes a trend series can be grouped by. */
export type IntervalKey = 'day' | 'week' | 'month' | 'year'

export interface IntervalOption {
  key: IntervalKey
  label: string
  /** Longer name for screen readers. */
  title: string
}

export const INTERVALS: IntervalOption[] = [
  { key: 'day', label: 'Day', title: 'Daily' },
  { key: 'week', label: 'Week', title: 'Weekly' },
  { key: 'month', label: 'Month', title: 'Monthly' },
  { key: 'year', label: 'Year', title: 'Yearly' },
]

/**
 * The bucket sizes that make sense for a window.
 *
 * A seven day window cannot be read per year and a three year window is
 * unreadable per day, so the selector only offers what fits.
 */
export const INTERVALS_BY_RANGE: Record<DateRangeKey, IntervalKey[]> = {
  '7d': ['day', 'week'],
  '30d': ['day', 'week', 'month'],
  '90d': ['week', 'month'],
  '12m': ['month', 'year'],
  '3y': ['month', 'year'],
}

/** The bucket size a window falls back to when the user has not picked one. */
export const DEFAULT_INTERVAL: Record<DateRangeKey, IntervalKey> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'month',
  '3y': 'year',
}

export interface TransactionQuery {
  search?: string
  categoryId?: string | 'all'
  type?: TransactionType | 'all'
  range?: DateRangeKey
  limit?: number
}

/**
 * A transaction the user is about to save.
 *
 * The shape is transport-agnostic on purpose: the HTTP client maps it onto
 * the API's payload and the mock client stores it as-is, so a form never has
 * to know which data source it is talking to.
 */
export interface TransactionDraft {
  /** Always positive — `type` carries the direction. */
  amount: number
  type: TransactionType
  /** Category slug, e.g. `food`. */
  categoryId: string
  /** Headline of the entry. Required by the API. */
  merchant: string
  note?: string
  /** ISO-8601 timestamp. */
  date: string
  method: PaymentMethod
  status: TransactionStatus
}

/** A partial update — only the fields that actually changed are sent. */
export type TransactionDraftUpdate = Partial<TransactionDraft>

/** A monthly budget the user wants to save. */
export interface BudgetDraft {
  /** Category slug, e.g. `food`. */
  categoryId: string
  /** Monthly ceiling. Must not be negative. */
  limit: number
  /** 1–12. Defaults to the current month when the API is asked. */
  month?: number
  /** Four digit year. Defaults to the current year when the API is asked. */
  year?: number
}

export interface BudgetQuery {
  month?: number
  year?: number
}

export interface OverallBudgetDraft {
  limit: number
  month?: number
  year?: number
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
  getCashflow(
    range: DateRangeKey,
    interval?: IntervalKey,
    signal?: AbortSignal,
  ): Promise<CashflowPoint[]>
  getCategoryBreakdown(range: DateRangeKey, signal?: AbortSignal): Promise<CategorySpend[]>
  getTransactions(query?: TransactionQuery, signal?: AbortSignal): Promise<Transaction[]>
  getBudgets(queryOrSignal?: BudgetQuery | AbortSignal, signal?: AbortSignal): Promise<Budget[]>
  getOverallBudget(query?: BudgetQuery, signal?: AbortSignal): Promise<OverallBudget | null>
  getCategories(signal?: AbortSignal): Promise<Category[]>
  getTopMerchants(range: DateRangeKey, limit?: number, signal?: AbortSignal): Promise<MerchantSpend[]>

  /** Creates a transaction and returns the saved record. */
  createTransaction(draft: TransactionDraft): Promise<Transaction>
  /** Updates a transaction and returns the saved record. */
  updateTransaction(id: string, draft: TransactionDraftUpdate): Promise<Transaction>
  /** Removes a transaction. Resolves once the record is gone. */
  deleteTransaction(id: string): Promise<void>

  /** Creates or updates a monthly budget for a category. */
  createBudget(draft: BudgetDraft): Promise<Budget>
  /** Updates the limit of an existing budget. */
  updateBudget(id: string, limit: number): Promise<Budget>
  /** Removes a budget. Resolves once the record is gone. */
  deleteBudget(id: string): Promise<void>

  /** Sets or updates the overall monthly budget. */
  saveOverallBudget(draft: OverallBudgetDraft): Promise<OverallBudget>
  /** Removes the overall monthly budget for a period. */
  deleteOverallBudget(query?: BudgetQuery): Promise<void>
}

export type {
  Budget,
  BudgetStatus,
  CashflowPoint,
  Category,
  CategorySpend,
  OverallBudget,
  ReportingPeriod,
  SummaryMetrics,
  Transaction,
}


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
