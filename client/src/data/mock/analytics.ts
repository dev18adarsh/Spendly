import type {
  Budget,
  CashflowPoint,
  CategorySpend,
  SummaryMetrics,
  Transaction,
} from '@/types'

import type { DateRangeKey } from '@/services/types'

import { mockCategories } from './categories'
import { mockBudgetLimits, mockChangesByRange, mockHistoricalMonthly, mockTotalBalance } from './summary'
import { mockTransactions } from './transactions'

/* ------------------------------------------------------------------ */
/* Range helpers                                                       */
/* ------------------------------------------------------------------ */

export const rangeDays: Record<DateRangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

/** All ledger entries that fall inside the requested window. */
export function transactionsInRange(range: DateRangeKey, now: Date = new Date()): Transaction[] {
  if (range === '12m') return mockTransactions
  const cutoff = now.getTime() - rangeDays[range] * DAY_MS
  return mockTransactions.filter((transaction) => new Date(transaction.date).getTime() >= cutoff)
}

function sumBy(transactions: Transaction[], type: Transaction['type']): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0)
}

/* ------------------------------------------------------------------ */
/* Series                                                              */
/* ------------------------------------------------------------------ */

/**
 * Cashflow series for the requested window.
 *
 * - 7D / 30D → daily buckets
 * - 90D      → weekly buckets
 * - 12M      → monthly buckets (recent months aggregated from the ledger,
 *              older months taken from the historical sample totals)
 */
export function buildSeries(range: DateRangeKey, now: Date = new Date()): CashflowPoint[] {
  if (range === '12m') return buildMonthlySeries(now)
  if (range === '90d') return buildBuckets(rangeDays[range], 7, now)
  return buildBuckets(rangeDays[range], 1, now)
}

/** Buckets of `size` days covering the last `totalDays` days, oldest first. */
function buildBuckets(totalDays: number, size: number, now: Date): CashflowPoint[] {
  const transactions = transactionsInRange(size === 1 ? '30d' : '90d', now).filter(
    (transaction) =>
      new Date(transaction.date).getTime() >= now.getTime() - totalDays * DAY_MS,
  )
  const bucketCount = Math.ceil(totalDays / size)
  const today = startOfDay(now)

  const buckets: CashflowPoint[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(today.getTime() - (bucketCount - 1 - index) * size * DAY_MS)
    const bucketEnd = new Date(bucketStart.getTime() + size * DAY_MS)
    const inBucket = transactions.filter((transaction) => {
      const time = new Date(transaction.date).getTime()
      return time >= bucketStart.getTime() && time < bucketEnd.getTime()
    })

    return {
      key: bucketStart.toISOString(),
      label: labelFor(bucketStart, size),
      income: sumBy(inBucket, 'income'),
      expenses: sumBy(inBucket, 'expense'),
    }
  })

  return buckets
}

function labelFor(date: Date, size: number): string {
  if (size === 1) {
    const sameMonth = date.getDate() === 1
    return sameMonth
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(date.getDate())
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Twelve calendar months, oldest first, combining ledger and historical totals. */
function buildMonthlySeries(now: Date): CashflowPoint[] {
  const months: Array<{ key: string; label: string; income: number; expenses: number }> = []

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    months.push({ key: monthKey(date), label: monthLabel(date), income: 0, expenses: 0 })
  }

  // Recent months come from the ledger so chart, cards and transactions agree.
  for (const transaction of mockTransactions) {
    const date = new Date(transaction.date)
    const bucket = months.find((month) => month.key === monthKey(date))
    if (!bucket) continue
    if (transaction.type === 'income') bucket.income += transaction.amount
    else bucket.expenses += transaction.amount
  }

  // Fill any month the ledger does not cover with the historical sample totals.
  let fallbackIndex = 0
  for (const month of months) {
    if (month.income !== 0 || month.expenses !== 0) continue
    const fallback = mockHistoricalMonthly[fallbackIndex]
    fallbackIndex += 1
    if (!fallback) break
    month.income = fallback.income
    month.expenses = fallback.expenses
  }

  return months
}

/* ------------------------------------------------------------------ */
/* Breakdown                                                           */
/* ------------------------------------------------------------------ */

/**
 * Spend per category for the requested window.
 * For the 12-month window the ledger only covers the recent months, so the
 * per-category amounts are scaled to match the annual total.
 */
export function buildCategoryBreakdown(range: DateRangeKey, now: Date = new Date()): CategorySpend[] {
  const transactions = transactionsInRange(range, now).filter(
    (transaction) => transaction.type === 'expense',
  )
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount)
  }

  let entries = Array.from(totals.entries()).map(([categoryId, amount]) => {
    const category = mockCategories.find((item) => item.id === categoryId)
    return {
      categoryId,
      name: category?.name ?? transactionLabel(categoryId),
      amount,
      share: 0,
      color: category?.color ?? '#98a2ae',
    }
  })

  if (range === '12m') {
    const annualExpenses = buildMonthlySeries(now).reduce((total, month) => total + month.expenses, 0)
    const ledgerTotal = entries.reduce((total, entry) => total + entry.amount, 0)
    if (ledgerTotal > 0 && annualExpenses > 0) {
      const factor = annualExpenses / ledgerTotal
      entries = entries.map((entry) => ({ ...entry, amount: entry.amount * factor }))
    }
  }

  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)

  return entries
    .map((entry) => ({ ...entry, share: total > 0 ? entry.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

function transactionLabel(categoryId: string): string {
  return categoryId.charAt(0).toUpperCase() + categoryId.slice(1)
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

/** Headline metrics for the requested window. */
export function buildSummary(range: DateRangeKey, now: Date = new Date()): SummaryMetrics {
  const series = buildSeries(range, now)
  const income = series.reduce((total, point) => total + point.income, 0)
  const expenses = series.reduce((total, point) => total + point.expenses, 0)
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0

  return {
    totalBalance: mockTotalBalance,
    income,
    expenses,
    savingsRate,
    changes: mockChangesByRange[range],
  }
}

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

/** Monthly budgets; `spent` is aggregated from the ledger's current month. */
export function buildBudgets(now: Date = new Date()): Budget[] {
  const currentMonth = monthKey(now)
  const spentByCategory = new Map<string, number>()

  for (const transaction of mockTransactions) {
    if (transaction.type !== 'expense') continue
    if (monthKey(new Date(transaction.date)) !== currentMonth) continue
    spentByCategory.set(
      transaction.categoryId,
      (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amount,
    )
  }

  return mockBudgetLimits.map((limit) => ({
    id: `budget_${limit.categoryId}`,
    categoryId: limit.categoryId,
    name: limit.name,
    limit: limit.limit,
    spent: spentByCategory.get(limit.categoryId) ?? 0,
    color: limit.color,
    period: 'monthly',
  }))
}

/* ------------------------------------------------------------------ */
/* Merchants                                                           */
/* ------------------------------------------------------------------ */

export interface MerchantSpend {
  id: string
  name: string
  category: string
  amount: number
  count: number
  color: string
}

/** Merchants ranked by spend for the requested window. */
export function buildTopMerchants(
  range: DateRangeKey,
  limit = 6,
  now: Date = new Date(),
): MerchantSpend[] {
  const transactions = transactionsInRange(range, now).filter(
    (transaction) => transaction.type === 'expense',
  )
  const totals = new Map<string, { name: string; amount: number; count: number; categoryId: string }>()

  for (const transaction of transactions) {
    const existing = totals.get(transaction.merchant)
    if (existing) {
      existing.amount += transaction.amount
      existing.count += 1
    } else {
      totals.set(transaction.merchant, {
        name: transaction.merchant,
        amount: transaction.amount,
        count: 1,
        categoryId: transaction.categoryId,
      })
    }
  }

  return Array.from(totals.entries())
    .map(([id, value]) => ({
      id,
      name: value.name,
      amount: value.amount,
      count: value.count,
      category: mockCategories.find((category) => category.id === value.categoryId)?.name ?? 'Other',
      color: mockCategories.find((category) => category.id === value.categoryId)?.color ?? '#98a2ae',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}
