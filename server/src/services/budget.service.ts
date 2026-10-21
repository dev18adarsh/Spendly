import { BudgetModel } from '../models/budget.model.js'
import { TransactionModel } from '../models/transaction.model.js'
import type { BudgetDto } from '../types/api.js'
import { ApiError } from '../utils/api-error.js'
import { resolveCategories } from './category.service.js'
import { toBudgetDto } from './mappers.js'
import type { UpdateBudgetInput, UpsertBudgetInput } from '../validators/budget.validator.js'

export interface ListBudgetsOptions {
  month?: number | undefined
  year?: number | undefined
}

/**
 * Start (inclusive) and end (exclusive) of a calendar month in UTC.
 *
 * Budget periods are UTC-based so a month means the same thing regardless of
 * where the request originates.
 */
export function monthRangeUtc(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
  }
}

/**
 * Amount already spent per category for a calendar month.
 * Aggregated from the transactions collection — never from sample data.
 */
export async function spentByCategory(
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const { start, end } = monthRangeUtc(year, month)

  const rows = await TransactionModel.aggregate<{ _id: string; spent: number }>([
    { $match: { type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', spent: { $sum: '$amount' } } },
  ]).exec()

  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row._id, row.spent)
  }
  return totals
}

export async function listBudgets(options: ListBudgetsOptions): Promise<BudgetDto[]> {
  const now = new Date()
  const month = options.month ?? now.getUTCMonth() + 1
  const year = options.year ?? now.getUTCFullYear()

  const [rows, spent] = await Promise.all([
    BudgetModel.find({ month, year }).sort({ category: 1 }).lean().exec(),
    spentByCategory(year, month),
  ])

  const meta = await resolveCategories(rows.map((row) => row.category))

  return rows.map((row) => {
    const categoryMeta = meta.get(row.category)
    return toBudgetDto(
      row,
      categoryMeta ?? {
        slug: row.category,
        name: row.category,
        color: '#98a2ae',
        icon: 'Wallet',
      },
      spent.get(row.category) ?? 0,
    )
  })
}

export async function getBudgetById(id: string): Promise<BudgetDto | null> {
  const row = await BudgetModel.findById(id).lean().exec()
  if (!row) return null

  const [spent, meta] = await Promise.all([
    spentByCategory(row.year, row.month),
    resolveCategories([row.category]),
  ])

  const categoryMeta = meta.get(row.category)
  if (!categoryMeta) return null

  return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
}

/** Creates the budget or updates its limit if it already exists. */
export async function upsertBudget(input: UpsertBudgetInput): Promise<BudgetDto> {
  const row = await BudgetModel.findOneAndUpdate(
    { category: input.category, month: input.month, year: input.year },
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
    spentByCategory(row.year, row.month),
    resolveCategories([row.category]),
  ])

  const categoryMeta = meta.get(row.category)
  if (!categoryMeta) {
    throw new ApiError(500, 'BUDGET_WRITE_FAILED', 'The budget could not be saved.')
  }

  return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
}

export async function updateBudgetById(
  id: string,
  input: UpdateBudgetInput,
): Promise<BudgetDto | null> {
  const row = await BudgetModel.findByIdAndUpdate(
    id,
    { $set: { limit: input.limit } },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!row) return null

  const [spent, meta] = await Promise.all([
    spentByCategory(row.year, row.month),
    resolveCategories([row.category]),
  ])

  const categoryMeta = meta.get(row.category)
  if (!categoryMeta) return null

  return toBudgetDto(row, categoryMeta, spent.get(row.category) ?? 0)
}

export async function deleteBudget(id: string): Promise<boolean> {
  const result = await BudgetModel.findByIdAndDelete(id).exec()
  return result !== null
}
