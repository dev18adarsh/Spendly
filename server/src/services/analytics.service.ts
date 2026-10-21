import { TransactionModel } from '../models/transaction.model.js'
import type {
  CashflowPointDto,
  CategorySpendDto,
  MerchantSpendDto,
  MetricChangeDto,
  SummaryDto,
} from '../types/api.js'
import { resolveCategories } from './category.service.js'
import { toCategorySpendDto } from './mappers.js'

/** Reporting windows supported by the API. */
export const RANGE_KEYS = ['7d', '30d', '90d', '12m'] as const

export type RangeKey = (typeof RANGE_KEYS)[number]

export const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isRangeKey(value: string): value is RangeKey {
  return Object.prototype.hasOwnProperty.call(RANGE_DAYS, value)
}

export interface ResolvedRange {
  key: RangeKey
  from: Date
  to: Date
  /** Length of the window in milliseconds. */
  durationMs: number
}

type BucketUnit = 'day' | 'week' | 'month'

function bucketUnitFor(key: RangeKey): BucketUnit {
  if (key === '12m') return 'month'
  if (key === '90d') return 'week'
  return 'day'
}

/** How many buckets a window is divided into. */
function bucketCountFor(key: RangeKey): number {
  if (key === '12m') return 12
  if (key === '90d') return Math.ceil(RANGE_DAYS[key] / 7)
  return RANGE_DAYS[key]
}

/**
 * The window a reporting range covers.
 *
 * Buckets are aligned to the end of the window so the last bucket is the
 * current day (or week, or month).
 */
export function resolveRange(key: RangeKey, now: Date = new Date()): ResolvedRange {
  const count = bucketCountFor(key)
  const to = new Date(now)

  let from: Date
  if (key === '12m') {
    from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1))
  } else if (key === '90d') {
    from = new Date(startOfDayUtc(to).getTime() - (count - 1) * 7 * DAY_MS)
  } else {
    from = new Date(startOfDayUtc(to).getTime() - (count - 1) * DAY_MS)
  }

  return { key, from, to, durationMs: to.getTime() - from.getTime() }
}

interface Totals {
  income: number
  expenses: number
}

/** Income and expense totals for a window (both bounds optional). */
async function totalsBetween(from?: Date, to?: Date): Promise<Totals> {
  const match: Record<string, unknown> = {}
  if (from || to) {
    match.date = {}
    if (from) (match.date as Record<string, Date>).$gte = from
    if (to) (match.date as Record<string, Date>).$lte = to
  }

  const rows = await TransactionModel.aggregate<{ _id: string; total: number }>([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]).exec()

  const result: Totals = { income: 0, expenses: 0 }
  for (const row of rows) {
    if (row._id === 'income') result.income = row.total
    if (row._id === 'expense') result.expenses = row.total
  }
  return result
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

function metricChange(value: number, isPositive: boolean): MetricChangeDto {
  return { value: Math.round(value * 100) / 100, isPositive }
}

/**
 * Headline metrics for a reporting window.
 *
 * `totalBalance` is the all-time balance (every income minus every expense),
 * while the other figures cover the selected window only.
 */
export async function getSummary(key: RangeKey, now: Date = new Date()): Promise<SummaryDto> {
  const range = resolveRange(key, now)
  const previousFrom = new Date(range.from.getTime() - range.durationMs)
  const previousTo = range.from

  const [current, previous, allTime, beforeWindow] = await Promise.all([
    totalsBetween(range.from, range.to),
    totalsBetween(previousFrom, previousTo),
    totalsBetween(),
    totalsBetween(undefined, previousTo),
  ])

  const totalBalance = allTime.income - allTime.expenses
  const previousBalance = beforeWindow.income - beforeWindow.expenses

  const savingsRate = current.income > 0 ? ((current.income - current.expenses) / current.income) * 100 : 0
  const previousSavingsRate =
    previous.income > 0 ? ((previous.income - previous.expenses) / previous.income) * 100 : 0

  return {
    totalBalance: Math.round(totalBalance * 100) / 100,
    income: Math.round(current.income * 100) / 100,
    expenses: Math.round(current.expenses * 100) / 100,
    savingsRate: Math.round(savingsRate * 100) / 100,
    changes: {
      balance: metricChange(percentageChange(totalBalance, previousBalance), totalBalance >= previousBalance),
      income: metricChange(percentageChange(current.income, previous.income), current.income >= previous.income),
      expenses: metricChange(
        percentageChange(current.expenses, previous.expenses),
        current.expenses <= previous.expenses,
      ),
      savingsRate: metricChange(savingsRate - previousSavingsRate, savingsRate >= previousSavingsRate),
    },
  }
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function nextBucket(date: Date, unit: BucketUnit): Date {
  if (unit === 'day') return new Date(date.getTime() + DAY_MS)
  if (unit === 'week') return new Date(date.getTime() + 7 * DAY_MS)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

/** The list of bucket start instants covering a range. */
function bucketStarts(range: ResolvedRange, unit: BucketUnit): Date[] {
  const starts: Date[] = []
  let cursor = unit === 'month' ? startOfMonthUtc(range.from) : startOfDayUtc(range.from)

  while (cursor.getTime() <= range.to.getTime()) {
    starts.push(cursor)
    cursor = nextBucket(cursor, unit)
  }

  return starts
}

/**
 * The aggregation expression that maps a transaction date onto its bucket.
 *
 * Daily and monthly buckets are calendar aligned. Weekly buckets are
 * seven-day windows counted from the start of the range, which is why they
 * use an offset rather than a calendar truncation.
 */
function bucketExpression(unit: BucketUnit, range: ResolvedRange): Record<string, unknown> {
  if (unit === 'week') {
    return {
      $dateAdd: {
        startDate: range.from,
        unit: 'week',
        amount: {
          $floor: { $divide: [{ $subtract: ['$date', range.from] }, 7 * DAY_MS] },
        },
      },
    }
  }

  return { $dateTrunc: { date: '$date', unit, timezone: 'UTC' } }
}

function bucketKey(date: Date, unit: BucketUnit): string {
  if (unit === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }
  return date.toISOString()
}

function bucketLabel(date: Date, unit: BucketUnit): string {
  if (unit === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  }
  if (unit === 'day' && date.getUTCDate() !== 1) {
    return String(date.getUTCDate())
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Income/expense series for a reporting window.
 *
 * Buckets are daily (7D/30D), weekly (90D) or monthly (12M).
 */
export async function getCashflow(key: RangeKey, now: Date = new Date()): Promise<CashflowPointDto[]> {
  const range = resolveRange(key, now)
  const unit = bucketUnitFor(key)

  const rows = await TransactionModel.aggregate<{
    _id: { bucket: Date; type: string }
    total: number
  }>([
    { $match: { date: { $gte: range.from, $lte: range.to } } },
    {
      $group: {
        _id: {
          bucket: bucketExpression(unit, range),
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
  ]).exec()

  const totals = new Map<string, { income: number; expenses: number }>()
  for (const row of rows) {
    const key = row._id.bucket.toISOString()
    const bucket = totals.get(key) ?? { income: 0, expenses: 0 }
    if (row._id.type === 'income') bucket.income += row.total
    else bucket.expenses += row.total
    totals.set(key, bucket)
  }

  return bucketStarts(range, unit).map((start) => {
    const bucket = totals.get(start.toISOString()) ?? { income: 0, expenses: 0 }
    return {
      key: bucketKey(start, unit),
      label: bucketLabel(start, unit),
      income: Math.round(bucket.income * 100) / 100,
      expenses: Math.round(bucket.expenses * 100) / 100,
    }
  })
}

/** Spend per category within a reporting window. */
export async function getCategoryBreakdown(
  key: RangeKey,
  now: Date = new Date(),
): Promise<CategorySpendDto[]> {
  const range = resolveRange(key, now)

  const rows = await TransactionModel.aggregate<{ _id: string; total: number }>([
    { $match: { type: 'expense', date: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ]).exec()

  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const meta = await resolveCategories(rows.map((row) => row._id))

  return rows
    .map((row) => {
      const categoryMeta = meta.get(row._id)
      return toCategorySpendDto(
        row._id,
        Math.round(row.total * 100) / 100,
        total,
        categoryMeta ?? {
          slug: row._id,
          name: row._id,
          color: '#98a2ae',
          icon: 'Wallet',
        },
      )
    })
    .sort((a, b) => b.amount - a.amount)
}

/** Merchants ranked by spend within a reporting window. */
export async function getTopMerchants(
  key: RangeKey,
  limit = 6,
  now: Date = new Date(),
): Promise<MerchantSpendDto[]> {
  const range = resolveRange(key, now)
  const capped = Math.max(1, Math.min(limit, 50))

  const rows = await TransactionModel.aggregate<{
    _id: string
    total: number
    count: number
    category: string
  }>([
    { $match: { type: 'expense', date: { $gte: range.from, $lte: range.to } } },
    {
      $group: {
        _id: { $ifNull: ['$merchant', '$description'] },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        category: { $first: '$category' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: capped },
  ]).exec()

  const meta = await resolveCategories(rows.map((row) => row.category))

  return rows.map((row) => {
    const categoryMeta = meta.get(row.category)
    return {
      id: row._id,
      name: row._id,
      category: categoryMeta?.name ?? row.category,
      amount: Math.round(row.total * 100) / 100,
      count: row.count,
      color: categoryMeta?.color ?? '#98a2ae',
    }
  })
}
