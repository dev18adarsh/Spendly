import { Types } from 'mongoose'

import { TransactionModel } from '../models/transaction.model.js'
import type {
  CashflowPointDto,
  CategorySpendDto,
  MerchantSpendDto,
  MetricChangeDto,
  ReportingPeriodDto,
  SummaryDto,
} from '../types/api.js'
import { DEFAULT_TIME_ZONE } from '../utils/timezone.js'
import { resolveCategories } from './category.service.js'
import { toCategorySpendDto } from './mappers.js'
import {
  buildBuckets,
  DEFAULT_INTERVAL,
  KEY_FORMAT,
  resolveRange,
  type IntervalKey,
  type RangeKey,
  type ResolvedRange,
} from './reporting-window.js'

export {
  DEFAULT_INTERVAL,
  INTERVAL_KEYS,
  INTERVALS_BY_RANGE,
  isIntervalKey,
  isRangeKey,
  RANGE_DAYS,
  RANGE_KEYS,
  RANGE_LABELS,
  RANGE_MONTHS,
  resolveRange,
} from './reporting-window.js'
export type {
  BucketDescriptor,
  IntervalKey,
  RangeKey,
  ResolvedRange,
} from './reporting-window.js'

/**
 * The calculation rules the dashboard relies on.
 *
 * Every window is a half-open interval `[from, to)`:
 *
 * - **income** — the sum of every `income` transaction inside the window.
 * - **expenses** — the sum of every `expense` transaction inside the window.
 * - **balance** — `income - expenses` for the window. It is the money the
 *   window itself produced, so it always moves with the charts.
 * - **all-time balance** — `income - expenses` over every transaction that
 *   was recorded before the window closed. It is the running balance the
 *   chart's sparkline ends on.
 * - **savings rate** — `balance / income * 100`, or `0` when there was no
 *   income in the window.
 *
 * Amounts are stored in the major unit of the currency and rounded to two
 * decimals only when they leave the server.
 */

interface Totals {
  income: number
  expenses: number
}

/**
 * Income and expense totals inside a window.
 *
 * `from` is inclusive, `to` is exclusive. Passing neither returns the totals
 * for every transaction on record.
 */
async function totalsBetween(
  userId: string,
  from?: Date,
  to?: Date,
): Promise<Totals> {
  const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) }
  if (from || to) {
    const date: Record<string, Date> = {}
    if (from) date.$gte = from
    if (to) date.$lt = to
    match.date = date
  }

  const rows = await TransactionModel.aggregate<{ _id: string; total: number }>([
    { $match: match },
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

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toPeriodDto(range: ResolvedRange): ReportingPeriodDto {
  return {
    key: range.key,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days,
    label: range.label,
    timeZone: range.timeZone,
  }
}

/**
 * Headline metrics for a reporting window.
 *
 * The window is half-open (`[from, to)`) and expressed in the requested
 * timezone, so a transaction on the very first day belongs to the window and
 * the previous window ends exactly where this one begins.
 */
export async function getSummary(
  userId: string,
  key: RangeKey,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<SummaryDto> {
  const range = resolveRange(key, now, timeZone)

  const [current, previous, allTime, beforeWindow] = await Promise.all([
    totalsBetween(userId, range.from, range.to),
    totalsBetween(userId, range.previousFrom, range.from),
    totalsBetween(userId, undefined, range.to),
    totalsBetween(userId, undefined, range.from),
  ])

  const balance = current.income - current.expenses
  const allTimeBalance = allTime.income - allTime.expenses
  const previousBalance = beforeWindow.income - beforeWindow.expenses
  const previousWindowBalance = previous.income - previous.expenses

  const savingsRate = current.income > 0 ? (balance / current.income) * 100 : 0
  const previousSavingsRate =
    previous.income > 0 ? ((previous.income - previous.expenses) / previous.income) * 100 : 0

  return {
    balance: round2(balance),
    allTimeBalance: round2(allTimeBalance),
    income: round2(current.income),
    expenses: round2(current.expenses),
    savingsRate: round2(savingsRate),
    period: toPeriodDto(range),
    changes: {
      balance: metricChange(
        percentageChange(allTimeBalance, previousBalance),
        allTimeBalance >= previousBalance,
      ),
      net: metricChange(
        percentageChange(balance, previousWindowBalance),
        balance >= previousWindowBalance,
      ),
      income: metricChange(
        percentageChange(current.income, previous.income),
        current.income >= previous.income,
      ),
      expenses: metricChange(
        percentageChange(current.expenses, previous.expenses),
        current.expenses <= previous.expenses,
      ),
      savingsRate: metricChange(
        savingsRate - previousSavingsRate,
        savingsRate >= previousSavingsRate,
      ),
    },
  }
}

/**
 * Income and expense series for a reporting window.
 *
 * The buckets are calendar aligned in the requested timezone — a "week" is
 * the local Sunday-to-Saturday week, a "month" the local calendar month.
 * Every point also carries the running balance at the end of its bucket, so
 * the client never has to derive one.
 */
export async function getCashflow(
  userId: string,
  key: RangeKey,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
  interval?: IntervalKey,
): Promise<CashflowPointDto[]> {
  const range = resolveRange(key, now, timeZone)
  const unit = interval ?? DEFAULT_INTERVAL[key]
  const buckets = buildBuckets(range, unit)

  // `$dateTrunc` snaps a transaction onto the calendar bucket it belongs to
  // in the requested timezone; `$dateToString` turns that instant into a
  // stable key the bucket list can be matched against.
  const bucketExpression: Record<string, unknown> = {
    $dateTrunc: { date: '$date', unit, timezone: range.timeZone },
  }
  const keyExpression: Record<string, unknown> = {
    $dateToString: {
      date: bucketExpression,
      format: KEY_FORMAT[unit],
      timezone: range.timeZone,
    },
  }

  const [rows, opening] = await Promise.all([
    TransactionModel.aggregate<{ _id: { key: string; type: string }; total: number }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: {
            key: keyExpression,
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
    ]).exec(),
    totalsBetween(userId, undefined, range.from),
  ])

  const totals = new Map<string, { income: number; expenses: number }>()
  for (const row of rows) {
    const bucket = totals.get(row._id.key) ?? { income: 0, expenses: 0 }
    if (row._id.type === 'income') bucket.income += row.total
    else bucket.expenses += row.total
    totals.set(row._id.key, bucket)
  }

  // The balance starts from everything that happened before the window and
  // rolls forward with the net of every bucket.
  let running = opening.income - opening.expenses

  return buckets.map((bucket) => {
    const totalsForBucket = totals.get(bucket.key) ?? { income: 0, expenses: 0 }
    running += totalsForBucket.income - totalsForBucket.expenses

    return {
      key: bucket.key,
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      income: round2(totalsForBucket.income),
      expenses: round2(totalsForBucket.expenses),
      balance: round2(running),
    }
  })
}

/** Spend per category within a reporting window. */
export async function getCategoryBreakdown(
  userId: string,
  key: RangeKey,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<CategorySpendDto[]> {
  const range = resolveRange(key, now, timeZone)

  const rows = await TransactionModel.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        type: 'expense',
        date: { $gte: range.from, $lt: range.to },
      },
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ]).exec()

  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const meta = await resolveCategories(rows.map((row) => row._id))

  return rows
    .map((row) => {
      const categoryMeta = meta.get(row._id)
      return toCategorySpendDto(
        row._id,
        round2(row.total),
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
  userId: string,
  key: RangeKey,
  limit = 6,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<MerchantSpendDto[]> {
  const range = resolveRange(key, now, timeZone)
  const capped = Math.max(1, Math.min(limit, 50))

  const rows = await TransactionModel.aggregate<{
    _id: string
    total: number
    count: number
    category: string
  }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        type: 'expense',
        date: { $gte: range.from, $lt: range.to },
      },
    },
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
      amount: round2(row.total),
      count: row.count,
      color: categoryMeta?.color ?? '#98a2ae',
    }
  })
}
