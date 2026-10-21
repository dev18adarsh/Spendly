import { Types } from 'mongoose'

import { BudgetModel, OverallBudgetModel } from '../models/budget.model.js'
import { toMoney } from '../models/model-options.js'
import { TransactionModel } from '../models/transaction.model.js'
import type { BudgetDto, OverallBudgetDto } from '../types/api.js'
import { ApiError } from '../utils/api-error.js'
import { currentMonthInZone, monthRangeInZone, resolveTimeZone } from '../utils/timezone.js'
import { resolveCategories } from './category.service.js'
import { fallbackCategoryMeta, toBudgetDto, toOverallBudgetDto } from './mappers.js'
import type {
  OverallBudgetInput,
  UpdateBudgetInput,
  UpsertBudgetInput,
} from '../validators/budget.validator.js'

/**
 * The period a budget belongs to, and the zone its boundaries align to.
 *
 * Field names match the validator output (`tz` after `timeZoneSchema` has
 * resolved it) so a parsed query or body can be passed straight through.
 */
export interface BudgetPeriod {
  month?: number | undefined
  year?: number | undefined
  tz?: string | undefined
}

/** A budget period with its ambiguity resolved. */
export interface ResolvedPeriod {
  /** Calendar month, 1–12. */
  month: number
  year: number
  /** The zone the month's boundaries were aligned to. */
  timeZone: string
  /** Start of the month, inclusive. */
  start: Date
  /** End of the month, exclusive. */
  end: Date
}

/**
 * Resolves the month a request refers to.
 *
 * When the caller does not name a month, the current one is taken from the
 * request's timezone — so "this month" means the account's this month rather
 * than UTC's. The zone is also used to align the month's boundaries, which is
 * what makes months of different lengths and the December-to-January rollover
 * behave: the range is half-open `[start, end)`, so the last instant of a
 * month is never counted twice or dropped.
 */
export function resolvePeriod(period: BudgetPeriod, now: Date = new Date()): ResolvedPeriod {
  const timeZone = resolveTimeZone(period.tz)
  const current = currentMonthInZone(timeZone, now)
  const month = period.month ?? current.month
  const year = period.year ?? current.year
  const { start, end } = monthRangeInZone(year, month, timeZone)

  return { month, year, timeZone, start, end }
}

/**
 * Amount already spent per category for a period.
 * Aggregated from the transactions collection — never from sample data, and
 * always limited to the account that is asking. Income is excluded: a
 * budget limits spending, not earning.
 */
export async function spentByCategory(
  userId: string,
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const rows = await TransactionModel.aggregate<{ _id: string; spent: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        type: 'expense',
        date: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: '$category', spent: { $sum: '$amount' } } },
  ]).exec()

  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row._id, toMoney(row.spent))
  }
  return totals
}

/**
 * Total spent across every category in a period.
 *
 * This is what the overall budget measures against, so it deliberately has no
 * category filter: spending in a category the account never budgeted still
 * counts towards the month's ceiling.
 */
export async function totalSpent(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await TransactionModel.aggregate<{ _id: null; spent: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        type: 'expense',
        date: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, spent: { $sum: '$amount' } } },
  ]).exec()

  return toMoney(rows[0]?.spent ?? 0)
}

export async function listBudgets(
  userId: string,
  period: BudgetPeriod,
): Promise<BudgetDto[]> {
  const resolved = resolvePeriod(period)

  const [rows, spent] = await Promise.all([
    BudgetModel.find({
      userId: new Types.ObjectId(userId),
      month: resolved.month,
      year: resolved.year,
    })
      .sort({ category: 1 })
      .lean()
      .exec(),
    spentByCategory(userId, resolved.start, resolved.end),
  ])

  const meta = await resolveCategories(rows.map((row) => row.category))

  return rows.map((row) =>
    toBudgetDto(
      row,
      meta.get(row.category) ?? fallbackCategoryMeta(row.category),
      spent.get(row.category) ?? 0,
    ),
  )
}

/**
 * Fetches one budget.
 *
 * The owner is part of the query, so another account's budget is not found.
 */
export async function getBudgetById(
  userId: string,
  id: string,
  period: BudgetPeriod = {},
): Promise<BudgetDto | OverallBudgetDto | null> {
  const row = await BudgetModel.findOne({ _id: id, userId: new Types.ObjectId(userId) })
    .lean()
    .exec()

  if (row) {
    // The month comes from the stored budget — a caller cannot ask for a
    // different period's spend against a budget it does not own.
    const resolved = resolvePeriod({ ...period, month: row.month, year: row.year })

    const [spent, meta] = await Promise.all([
      spentByCategory(userId, resolved.start, resolved.end),
      resolveCategories([row.category]),
    ])

    const categoryMeta = meta.get(row.category)
    if (!categoryMeta) return null

    return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
  }

  const overallRow = await OverallBudgetModel.findOne({
    _id: id,
    userId: new Types.ObjectId(userId),
  })
    .lean()
    .exec()

  if (!overallRow) return null

  const resolved = resolvePeriod({ ...period, month: overallRow.month, year: overallRow.year })
  const spent = await totalSpent(userId, resolved.start, resolved.end)
  return toOverallBudgetDto(overallRow, spent)
}

/** Creates the budget or updates its limit if it already exists. */
export async function upsertBudget(userId: string, input: UpsertBudgetInput): Promise<BudgetDto> {
  const resolved = resolvePeriod(input)

  const row = await BudgetModel.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      category: input.category,
      month: resolved.month,
      year: resolved.year,
    },
    { $set: { limit: input.limit } },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean()

  if (!row) {
    throw new ApiError(500, 'BUDGET_WRITE_FAILED', 'The budget could not be saved.')
  }

  const [spent, meta] = await Promise.all([
    spentByCategory(userId, resolved.start, resolved.end),
    resolveCategories([row.category]),
  ])

  const categoryMeta = meta.get(row.category)
  if (!categoryMeta) {
    throw new ApiError(500, 'BUDGET_WRITE_FAILED', 'The budget could not be saved.')
  }

  return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
}

export async function updateBudgetById(
  userId: string,
  id: string,
  input: UpdateBudgetInput,
  period: BudgetPeriod = {},
): Promise<BudgetDto | OverallBudgetDto | null> {
  const row = await BudgetModel.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId) },
    { $set: { limit: input.limit } },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (row) {
    const resolved = resolvePeriod({ ...period, month: row.month, year: row.year })

    const [spent, meta] = await Promise.all([
      spentByCategory(userId, resolved.start, resolved.end),
      resolveCategories([row.category]),
    ])

    const categoryMeta = meta.get(row.category)
    if (!categoryMeta) return null

    return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
  }

  const overallRow = await OverallBudgetModel.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId) },
    { $set: { limit: input.limit } },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!overallRow) return null

  const resolved = resolvePeriod({ ...period, month: overallRow.month, year: overallRow.year })
  const spent = await totalSpent(userId, resolved.start, resolved.end)
  return toOverallBudgetDto(overallRow, spent)
}

export async function deleteBudget(userId: string, id: string): Promise<boolean> {
  const result = await BudgetModel.findOneAndDelete({
    _id: id,
    userId: new Types.ObjectId(userId),
  }).exec()
  if (result) return true

  const overallResult = await OverallBudgetModel.findOneAndDelete({
    _id: id,
    userId: new Types.ObjectId(userId),
  }).exec()
  return overallResult !== null
}

/**
 * The overall monthly budget for a period.
 *
 * Returns `null` when the account has not set one, so the UI can offer to
 * create it rather than showing a zero limit as if it were deliberate.
 */
export async function getOverallBudget(
  userId: string,
  period: BudgetPeriod,
): Promise<OverallBudgetDto | null> {
  const resolved = resolvePeriod(period)

  const [row, spent] = await Promise.all([
    OverallBudgetModel.findOne({
      userId: new Types.ObjectId(userId),
      month: resolved.month,
      year: resolved.year,
    })
      .lean()
      .exec(),
    totalSpent(userId, resolved.start, resolved.end),
  ])

  if (!row) return null

  return toOverallBudgetDto(row, spent)
}

/** Creates the overall budget, or updates it if one already exists. */
export async function saveOverallBudget(
  userId: string,
  input: OverallBudgetInput,
): Promise<OverallBudgetDto> {
  const resolved = resolvePeriod(input)

  const row = await OverallBudgetModel.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      month: resolved.month,
      year: resolved.year,
    },
    { $set: { limit: input.limit } },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean()

  if (!row) {
    throw new ApiError(500, 'BUDGET_WRITE_FAILED', 'The budget could not be saved.')
  }

  const spent = await totalSpent(userId, resolved.start, resolved.end)

  return toOverallBudgetDto(row, spent)
}

export async function deleteOverallBudget(userId: string, period: BudgetPeriod): Promise<boolean> {
  const resolved = resolvePeriod(period)

  const result = await OverallBudgetModel.findOneAndDelete({
    userId: new Types.ObjectId(userId),
    month: resolved.month,
    year: resolved.year,
  }).exec()

  return result !== null
}
