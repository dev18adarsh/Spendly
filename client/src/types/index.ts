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
  /** ISO month key, e.g. `2026-04`. */
  key: string
  /** Short axis label, e.g. `Apr`. */
  label: string
  income: number
  expenses: number
}

export interface CategorySpend {
  categoryId: string
  name: string
  amount: number
  /** Share of total spend, 0–1. */
  share: number
  color: string
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
  totalBalance: number
  income: number
  expenses: number
  /** Percentage of income retained, 0–100. */
  savingsRate: number
  changes: {
    balance: MetricChange
    income: MetricChange
    expenses: MetricChange
    savingsRate: MetricChange
  }
}
