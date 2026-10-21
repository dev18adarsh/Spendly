/**
 * Core domain model for Spendly.
 * These types are the contract shared by the mock data layer and the future
 * REST API — keep them transport-agnostic so either source can satisfy them.
 */

export type TransactionType = 'expense' | 'income'

export type TransactionStatus = 'cleared' | 'pending'

export type PaymentMethod = 'card' | 'bank' | 'cash' | 'transfer'

export type BudgetPeriod = 'weekly' | 'monthly'

export interface Category {
  id: string
  name: string
  /** Hex colour used for charts, chips and avatars. */
  color: string
  /** Lucide icon key, resolved by `CategoryIcon`. */
  icon: string
}

export interface Transaction {
  id: string
  merchant: string
  note?: string
  categoryId: string
  categoryName: string
  /** Always positive. `type` carries the direction. */
  amount: number
  type: TransactionType
  /** ISO-8601 timestamp. */
  date: string
  status: TransactionStatus
  method: PaymentMethod
}

export interface CashflowPoint {
  /** Stable calendar key, e.g. `2026-04` or `2026-04-14`. */
  key: string
  /** Short axis label, e.g. `Apr`. */
  label: string
  /** Long label used in tooltips, e.g. `Week of Apr 6, 2026`. */
  fullLabel: string
  income: number
  expenses: number
  /** Running balance at the end of the bucket. */
  balance: number
}

export interface CategorySpend {
  categoryId: string
  name: string
  amount: number
  /** Share of total spend, 0–1. */
  share: number
  color: string
}

/** The reporting window a set of figures belongs to. */
export interface ReportingPeriod {
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

export interface Budget {
  id: string
  categoryId: string
  name: string
  limit: number
  spent: number
  color: string
  period: BudgetPeriod
}

export interface MetricChange {
  /** Percentage change vs. the previous comparable period. */
  value: number
  /** Whether the change is favourable for this metric. */
  isPositive: boolean
}

export interface SummaryMetrics {
  /** Net of the selected window: `income - expenses`. */
  balance: number
  /** Net of every transaction recorded before the window closed. */
  allTimeBalance: number
  income: number
  expenses: number
  /** Percentage of income retained, 0–100. */
  savingsRate: number
  /** The window these figures describe. */
  period: ReportingPeriod
  changes: {
    /** Movement of the all-time balance against the balance before the window. */
    balance: MetricChange
    /** Movement of the window's own net against the previous window. */
    net: MetricChange
    income: MetricChange
    expenses: MetricChange
    savingsRate: MetricChange
  }
}
