import type {
  Budget,
  CashflowPoint,
  CategorySpend,
  ReportingPeriod,
  SummaryMetrics,
  Transaction,
} from '@/types'

import type { DateRangeKey, IntervalKey } from '@/services/types'
import { DEFAULT_INTERVAL } from '@/services/types'
import {
  addLocalDays,
  addLocalMonths,
  localDayKey,
  localMonthKey,
  localYearKey,
  resolveClientTimeZone,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfLocalYear,
} from '@/lib/timezone'

import { mockCategories } from './categories'
import { mockBudgetLimits } from './summary'
import { mockTransactions } from './transactions'

/* ------------------------------------------------------------------ */
/* Reporting windows                                                   */
/* ------------------------------------------------------------------ */

/**
 * The windows the mock understands.
 *
 * They mirror the server exactly: a half-open interval `[from, to)` that
 * starts on a local calendar boundary, so the demo build and the API build
 * report on the same period.
 */
const RANGE_DAYS: Partial<Record<DateRangeKey, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const RANGE_MONTHS: Partial<Record<DateRangeKey, number>> = {
  '12m': 12,
  '3y': 36,
}

const RANGE_LABELS: Record<DateRangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  '3y': 'Last 3 years',
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface MockRange {
  key: DateRangeKey
  /** Inclusive start of the window. */
  from: Date
  /** Exclusive end of the window. */
  to: Date
  durationMs: number
  /** How many local calendar days the window covers, both ends included. */
  days: number
  /**
   * Inclusive start of the window that immediately precedes this one.
   *
   * Shifted back by a calendar step rather than by the same number of
   * milliseconds, so the comparison window is a whole window too.
   */
  previousFrom: Date
  label: string
}

/** Resolves a reporting window against a point in time. */
export function resolveMockRange(range: DateRangeKey, now: Date = new Date()): MockRange {
  const months = RANGE_MONTHS[range]
  const days = RANGE_DAYS[range]
  let from: Date

  if (months) {
    const monthStart = startOfLocalMonth(now)
    from = startOfLocalMonth(addLocalMonths(monthStart, -(months - 1)))
  } else {
    const size = days ?? 30
    from = addLocalDays(startOfLocalDay(now), -(size - 1))
  }

  const previousFrom = months
    ? addLocalMonths(from, -months)
    : addLocalDays(from, -(days ?? 30))

  return {
    key: range,
    from,
    to: now,
    durationMs: now.getTime() - from.getTime(),
    days: countLocalDays(from, now),
    previousFrom,
    label: RANGE_LABELS[range],
  }
}

/**
 * How many local calendar days a window covers.
 *
 * The ends are read from the calendar rather than the clock, so a day that
 * is 23 or 25 hours long still counts once — exactly as the server counts it.
 */
function countLocalDays(from: Date, to: Date): number {
  const first = startOfLocalDay(from)
  const last = startOfLocalDay(to)
  return Math.max(1, Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1)
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

/** All ledger entries that fall inside the requested window. */
export function transactionsInRange(
  range: DateRangeKey,
  now: Date = new Date(),
  ledger: Transaction[] = mockTransactions,
): Transaction[] {
  const window = resolveMockRange(range, now)
  return ledger.filter((transaction) => {
    const time = new Date(transaction.date).getTime()
    return time >= window.from.getTime() && time < window.to.getTime()
  })
}

function sumBy(transactions: Transaction[], type: Transaction['type']): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0)
}

function netOf(transactions: Transaction[]): number {
  return sumBy(transactions, 'income') - sumBy(transactions, 'expense')
}

/* ------------------------------------------------------------------ */
/* Buckets                                                             */
/* ------------------------------------------------------------------ */

interface MockBucket {
  key: string
  label: string
  fullLabel: string
  start: Date
  end: Date
}

/**
 * The calendar buckets that cover a window.
 *
 * Buckets are aligned to the local calendar: a "week" is the local
 * Sunday-to-Saturday week, a "month" the local calendar month.
 */
function buildBuckets(window: MockRange, interval: IntervalKey): MockBucket[] {
  const buckets: MockBucket[] = []

  let cursor = bucketStart(window.from, interval)
  while (cursor.getTime() <= window.to.getTime()) {
    const end = bucketEnd(cursor, interval)
    buckets.push(describeBucket(cursor, end, interval))
    cursor = bucketStart(end, interval)
  }

  return buckets
}

function bucketStart(instant: Date, interval: IntervalKey): Date {
  switch (interval) {
    case 'day':
      return startOfLocalDay(instant)
    case 'week':
      return startOfLocalWeek(instant)
    case 'month':
      return startOfLocalMonth(instant)
    case 'year':
      return startOfLocalYear(instant)
  }
}

function bucketEnd(start: Date, interval: IntervalKey): Date {
  switch (interval) {
    case 'day':
      return addLocalDays(start, 1)
    case 'week':
      return addLocalDays(start, 7)
    case 'month':
      return addLocalMonths(start, 1)
    case 'year':
      return addLocalMonths(start, 12)
  }
}

function describeBucket(start: Date, end: Date, interval: IntervalKey): MockBucket {
  if (interval === 'year') {
    const year = localYearKey(start)
    return { key: year, label: year, fullLabel: year, start, end }
  }

  if (interval === 'month') {
    return {
      key: localMonthKey(start),
      label: start.toLocaleDateString('en-US', { month: 'short' }),
      fullLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      start,
      end,
    }
  }

  const key = localDayKey(start)
  const longDate = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  if (interval === 'week') {
    return {
      key,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullLabel: `Week of ${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
      start,
      end,
    }
  }

  const isFirstOfMonth = start.getDate() === 1

  return {
    key,
    label: isFirstOfMonth
      ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(start.getDate()),
    fullLabel: longDate,
    start,
    end,
  }
}

/* ------------------------------------------------------------------ */
/* Series                                                              */
/* ------------------------------------------------------------------ */

/**
 * Cashflow series for the requested window.
 *
 * Every point carries the running balance at the end of its bucket, rolled
 * forward from everything that happened before the window — the same rule
 * the server applies.
 */
export function buildSeries(
  range: DateRangeKey,
  interval: IntervalKey = DEFAULT_INTERVAL[range],
  now: Date = new Date(),
  ledger: Transaction[] = mockTransactions,
): CashflowPoint[] {
  const window = resolveMockRange(range, now)
  const buckets = buildBuckets(window, interval)

  const opening = ledger.filter(
    (transaction) => new Date(transaction.date).getTime() < window.from.getTime(),
  )

  let running = netOf(opening)

  return buckets.map((bucket) => {
    const inBucket = ledger.filter((transaction) => {
      const time = new Date(transaction.date).getTime()
      return time >= bucket.start.getTime() && time < bucket.end.getTime()
    })

    const income = sumBy(inBucket, 'income')
    const expenses = sumBy(inBucket, 'expense')
    running += income - expenses

    return {
      key: bucket.key,
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      income: round2(income),
      expenses: round2(expenses),
      balance: round2(running),
    }
  })
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/* ------------------------------------------------------------------ */
/* Breakdown                                                           */
/* ------------------------------------------------------------------ */

/** Spend per category for the requested window. */
export function buildCategoryBreakdown(
  range: DateRangeKey,
  now: Date = new Date(),
  ledger: Transaction[] = mockTransactions,
): CategorySpend[] {
  const transactions = transactionsInRange(range, now, ledger).filter(
    (transaction) => transaction.type === 'expense',
  )
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + transaction.amount,
    )
  }

  const entries = Array.from(totals.entries()).map(([categoryId, amount]) => {
    const category = mockCategories.find((item) => item.id === categoryId)
    return {
      categoryId,
      name: category?.name ?? transactionLabel(categoryId),
      amount: round2(amount),
      share: 0,
      color: category?.color ?? '#98a2ae',
    }
  })

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

function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Headline metrics for the requested window. */
export function buildSummary(
  range: DateRangeKey,
  now: Date = new Date(),
  ledger: Transaction[] = mockTransactions,
): SummaryMetrics {
  const window = resolveMockRange(range, now)
  const previousFrom = window.previousFrom

  const current = transactionsInRange(range, now, ledger)
  const previous = ledger.filter((transaction) => {
    const time = new Date(transaction.date).getTime()
    return time >= previousFrom.getTime() && time < window.from.getTime()
  })
  const allTime = ledger.filter(
    (transaction) => new Date(transaction.date).getTime() < window.to.getTime(),
  )
  const beforeWindow = ledger.filter(
    (transaction) => new Date(transaction.date).getTime() < window.from.getTime(),
  )

  const income = sumBy(current, 'income')
  const expenses = sumBy(current, 'expense')
  const balance = income - expenses
  const allTimeBalance = netOf(allTime)
  const previousBalance = netOf(beforeWindow)

  const previousIncome = sumBy(previous, 'income')
  const previousExpenses = sumBy(previous, 'expense')
  const previousNet = previousIncome - previousExpenses
  const savingsRate = income > 0 ? (balance / income) * 100 : 0
  const previousSavingsRate =
    previousIncome > 0 ? ((previousIncome - previousExpenses) / previousIncome) * 100 : 0

  const period: ReportingPeriod = {
    key: window.key,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    days: window.days,
    label: window.label,
    timeZone: resolveClientTimeZone(),
  }

  return {
    balance: round2(balance),
    allTimeBalance: round2(allTimeBalance),
    income: round2(income),
    expenses: round2(expenses),
    savingsRate: round2(savingsRate),
    period,
    changes: {
      balance: {
        value: round2(percentageChange(allTimeBalance, previousBalance)),
        isPositive: allTimeBalance >= previousBalance,
      },
      net: {
        value: round2(percentageChange(balance, previousNet)),
        isPositive: balance >= previousNet,
      },
      income: {
        value: round2(percentageChange(income, previousIncome)),
        isPositive: income >= previousIncome,
      },
      expenses: {
        value: round2(percentageChange(expenses, previousExpenses)),
        isPositive: expenses <= previousExpenses,
      },
      savingsRate: {
        value: round2(savingsRate - previousSavingsRate),
        isPositive: savingsRate >= previousSavingsRate,
      },
    },
  }
}

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

/** Monthly budgets; `spent` is aggregated from the ledger's current month. */
export function buildBudgets(
  now: Date = new Date(),
  ledger: Transaction[] = mockTransactions,
  limits: typeof mockBudgetLimits = mockBudgetLimits,
): Budget[] {
  const currentMonth = localMonthKey(now)
  const spentByCategory = new Map<string, number>()

  for (const transaction of ledger) {
    if (transaction.type !== 'expense') continue
    if (localMonthKey(new Date(transaction.date)) !== currentMonth) continue
    spentByCategory.set(
      transaction.categoryId,
      (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amount,
    )
  }

  return limits.map((limit) => ({
    id: `budget_${limit.categoryId}`,
    categoryId: limit.categoryId,
    name: limit.name,
    limit: limit.limit,
    spent: spentByCategory.get(limit.categoryId) ?? 0,
    color: limit.color,
    period: 'monthly' as const,
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
  ledger: Transaction[] = mockTransactions,
): MerchantSpend[] {
  const transactions = transactionsInRange(range, now, ledger).filter(
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
      amount: round2(value.amount),
      count: value.count,
      category: mockCategories.find((category) => category.id === value.categoryId)?.name ?? 'Other',
      color: mockCategories.find((category) => category.id === value.categoryId)?.color ?? '#98a2ae',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}
