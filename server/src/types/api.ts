import type { TransactionStatus, TransactionType } from '../constants/payment-methods.js'

/** A transaction as returned by the API. */
export interface TransactionDto {
  id: string
  amount: number
  type: TransactionType
  /** Category slug, e.g. `food`. */
  category: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  description: string
  merchant: string | null
  notes: string | null
  /** ISO-8601 timestamp of the transaction date. */
  date: string
  paymentMethod: string | null
  status: TransactionStatus
  createdAt: string
  updatedAt: string
}

/** A monthly budget as returned by the API. */
export interface BudgetDto {
  id: string
  category: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  /** Monthly limit. */
  limit: number
  /** Amount already spent in the budget's month, computed from transactions. */
  spent: number
  month: number
  year: number
  period: 'monthly'
  createdAt: string
  updatedAt: string
}

/** A category as returned by the API. */
export interface CategoryDto {
  id: string
  slug: string
  name: string
  color: string
  icon: string
  order: number
}

/** The reporting window a set of figures belongs to. */
export interface ReportingPeriodDto {
  /** The range key, e.g. `30d`. */
  key: string
  /** Inclusive start of the window, as an ISO-8601 timestamp. */
  from: string
  /** Exclusive end of the window, as an ISO-8601 timestamp. */
  to: string
  /** How many days the window covers. */
  days: number
  /** Human readable name, e.g. `Last 30 days`. */
  label: string
  /** The IANA zone the boundaries were calculated in. */
  timeZone: string
}

/** Headline metrics for a reporting window. */
export interface SummaryDto {
  /** Net of the window: `income - expenses`. */
  balance: number
  /** Net of every transaction recorded before the window closed. */
  allTimeBalance: number
  income: number
  expenses: number
  savingsRate: number
  period: ReportingPeriodDto
  changes: {
    /** Movement of the all-time balance against the balance before the window. */
    balance: MetricChangeDto
    /** Movement of the window's own net against the previous window. */
    net: MetricChangeDto
    income: MetricChangeDto
    expenses: MetricChangeDto
    savingsRate: MetricChangeDto
  }
}

export interface MetricChangeDto {
  value: number
  isPositive: boolean
}

/** One point on the cashflow chart. */
export interface CashflowPointDto {
  /** Stable calendar key, e.g. `2026-03-08` or `2026-03`. */
  key: string
  /** Compact axis label, e.g. `8`. */
  label: string
  /** Long label used in tooltips, e.g. `Week of Mar 8, 2026`. */
  fullLabel: string
  income: number
  expenses: number
  /** Running balance at the end of the bucket. */
  balance: number
}

/** Spend per category within a window. */
export interface CategorySpendDto {
  categoryId: string
  name: string
  amount: number
  share: number
  color: string
}

/** A merchant ranked by spend. */
export interface MerchantSpendDto {
  id: string
  name: string
  category: string
  amount: number
  count: number
  color: string
}

/**
 * The public profile of an account.
 *
 * Deliberately free of anything secret — no password hash, no session token.
 */
export interface UserDto {
  id: string
  email: string
  name: string
  /** ISO-8601 timestamp of when the account was created. */
  createdAt: string
}
