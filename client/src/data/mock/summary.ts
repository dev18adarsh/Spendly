import type { SummaryMetrics } from '@/types'

import type { DateRangeKey } from '@/services/types'

/**
 * Sample headline figures that cannot be derived from the ledger
 * (account balances have no transaction representation).
 */
export const mockTotalBalance = 24860.42

/**
 * Percentage movement vs. the previous comparable window.
 * Hard-coded sample values — the server computes these from persisted data.
 */
export const mockChangesByRange: Record<DateRangeKey, SummaryMetrics['changes']> = {
  '7d': {
    balance: { value: 4.2, isPositive: true },
    income: { value: 8.1, isPositive: true },
    expenses: { value: -12.4, isPositive: true },
    savingsRate: { value: 6.8, isPositive: true },
  },
  '30d': {
    balance: { value: 6.8, isPositive: true },
    income: { value: 12.4, isPositive: true },
    expenses: { value: 3.1, isPositive: false },
    savingsRate: { value: 2.6, isPositive: true },
  },
  '90d': {
    balance: { value: 9.5, isPositive: true },
    income: { value: 7.2, isPositive: true },
    expenses: { value: -2.6, isPositive: true },
    savingsRate: { value: 4.1, isPositive: true },
  },
  '12m': {
    balance: { value: 18.7, isPositive: true },
    income: { value: 15.3, isPositive: true },
    expenses: { value: -4.9, isPositive: true },
    savingsRate: { value: 7.9, isPositive: true },
  },
}

/**
 * Totals for months that pre-date the sample ledger (oldest first).
 * The nine entries fill the calendar months between "12 months ago" and the
 * ledger window.
 */
export const mockHistoricalMonthly: Array<{ income: number; expenses: number }> = [
  { income: 7650, expenses: 6210 },
  { income: 9400, expenses: 8130 },
  { income: 7650, expenses: 5440 },
  { income: 8300, expenses: 5910 },
  { income: 9830, expenses: 6340 },
  { income: 8300, expenses: 5720 },
  { income: 8580, expenses: 6180 },
  { income: 8580, expenses: 5290 },
  { income: 10480, expenses: 7460 },
]

/**
 * Monthly spend limits per category. `spent` is derived from the ledger so
 * budgets and transactions always agree.
 */
export const mockBudgetLimits: Array<{
  categoryId: string
  name: string
  limit: number
  color: string
}> = [
  { categoryId: 'housing', name: 'Housing', limit: 3500, color: '#60a5fa' },
  { categoryId: 'food', name: 'Food & Dining', limit: 900, color: '#f2b544' },
  { categoryId: 'shopping', name: 'Shopping', limit: 1000, color: '#fb7185' },
  { categoryId: 'transport', name: 'Transport', limit: 600, color: '#a78bfa' },
  { categoryId: 'utilities', name: 'Utilities', limit: 450, color: '#2dd4bf' },
  { categoryId: 'health', name: 'Health', limit: 300, color: '#f472b6' },
  { categoryId: 'subscriptions', name: 'Subscriptions', limit: 120, color: '#38bdf8' },
  { categoryId: 'entertainment', name: 'Entertainment', limit: 250, color: '#c084fc' },
]
