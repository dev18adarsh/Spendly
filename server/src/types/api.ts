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

/** Headline metrics for a reporting window. */
export interface SummaryDto {
  totalBalance: number
  income: number
  expenses: number
  savingsRate: number
  changes: {
    balance: MetricChangeDto
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
  key: string
  label: string
  income: number
  expenses: number
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
