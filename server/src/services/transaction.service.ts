import { Types, type QueryFilter } from 'mongoose'

import type { CategorySlug } from '../constants/categories.js'
import type { TransactionType } from '../constants/payment-methods.js'
import type { TransactionAttributes } from '../models/transaction.model.js'
import { TransactionModel } from '../models/transaction.model.js'
import type { TransactionDto } from '../types/api.js'
import { ApiError } from '../utils/api-error.js'
import { resolveCategories } from './category.service.js'
import { fallbackCategoryMeta, toTransactionDto } from './mappers.js'
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js'

export interface ListTransactionsOptions {
  from?: Date | undefined
  to?: Date | undefined
  type?: TransactionType
  category?: CategorySlug
  search?: string
  page: number
  limit: number
  sort: string
}

export interface ListTransactionsResult {
  items: TransactionDto[]
  total: number
}

/** Escapes user input so it can be embedded safely in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFilter(userId: string, options: ListTransactionsOptions): QueryFilter<TransactionAttributes> {
  const filter: QueryFilter<TransactionAttributes> = { userId: new Types.ObjectId(userId) }

  if (options.from || options.to) {
    filter.date = {}
    if (options.from) filter.date.$gte = options.from
    if (options.to) filter.date.$lte = options.to
  }

  if (options.type) filter.type = options.type
  if (options.category) filter.category = options.category

  if (options.search) {
    const pattern = new RegExp(escapeRegExp(options.search), 'i')
    filter.$or = [{ description: pattern }, { merchant: pattern }]
  }

  return filter
}

function buildSort(sort: string): Record<string, 1 | -1> {
  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort
  return { [field]: descending ? -1 : 1 }
}

/** Lists transactions with optional filters, sorted and paginated. */
export async function listTransactions(
  userId: string,
  options: ListTransactionsOptions,
): Promise<ListTransactionsResult> {
  const filter = buildFilter(userId, options)
  const skip = (options.page - 1) * options.limit

  const [rows, total] = await Promise.all([
    TransactionModel.find(filter)
      .sort(buildSort(options.sort))
      .skip(skip)
      .limit(options.limit)
      .lean()
      .exec(),
    TransactionModel.countDocuments(filter).exec(),
  ])

  const meta = await resolveCategories(rows.map((row) => row.category))

  return {
    items: rows.map((row) => {
      const categoryMeta = meta.get(row.category) ?? fallbackCategoryMeta(row.category)
      return toTransactionDto(row, categoryMeta)
    }),
    total,
  }
}

/**
 * Fetches one transaction.
 *
 * The owner is part of the query, so another account's transaction is simply
 * not found — the id alone never grants access.
 */
export async function getTransactionById(
  userId: string,
  id: string,
): Promise<TransactionDto | null> {
  const row = await TransactionModel.findOne({
    _id: id,
    userId: new Types.ObjectId(userId),
  })
    .lean()
    .exec()
  if (!row) return null

  const meta = await resolveCategories([row.category])
  const categoryMeta = meta.get(row.category) ?? fallbackCategoryMeta(row.category)

  return toTransactionDto(row, categoryMeta)
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  const created = await TransactionModel.create({
    ...input,
    userId: new Types.ObjectId(userId),
    date: input.date ?? new Date(),
    status: input.status ?? 'cleared',
  })

  const meta = await resolveCategories([created.category])
  const categoryMeta = meta.get(created.category) ?? fallbackCategoryMeta(created.category)

  return toTransactionDto(created, categoryMeta)
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionDto | null> {
  const updated = await TransactionModel.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId) },
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!updated) return null

  const meta = await resolveCategories([updated.category])
  const categoryMeta = meta.get(updated.category) ?? fallbackCategoryMeta(updated.category)

  return toTransactionDto(updated, categoryMeta)
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const result = await TransactionModel.findOneAndDelete({
    _id: id,
    userId: new Types.ObjectId(userId),
  }).exec()
  return result !== null
}

/** Throws a 404 when the transaction does not exist — or is not yours. */
export async function requireTransaction(userId: string, id: string): Promise<TransactionDto> {
  const transaction = await getTransactionById(userId, id)
  if (!transaction) {
    throw ApiError.notFound(`No transaction found with id "${id}".`)
  }
  return transaction
}
