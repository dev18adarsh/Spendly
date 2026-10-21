import { findCategoryDefinition } from '../constants/categories.js'
import type { TransactionStatus, TransactionType } from '../constants/payment-methods.js'
import type { BudgetDto, CategoryDto, CategorySpendDto, TransactionDto } from '../types/api.js'

/**
 * Presentation metadata for a category slug.
 *
 * Resolution goes through the category service, which caches the rows from
 * the `categories` collection. The static definitions are only a fallback for
 * the rare case where the lookup has not been warmed yet.
 */
export interface CategoryMeta {
  slug: string
  name: string
  color: string
  icon: string
}

const FALLBACK_COLOR = '#98a2ae'

export function fallbackCategoryMeta(slug: string): CategoryMeta {
  const definition = findCategoryDefinition(slug)
  return {
    slug,
    name: definition?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    color: definition?.color ?? FALLBACK_COLOR,
    icon: definition?.icon ?? 'Wallet',
  }
}

/**
 * Structural shapes the mappers accept.
 *
 * They are deliberately looser than the Mongoose models so both lean results
 * (`_id` present) and serialised documents (`_id` renamed to `id`) can be
 * mapped by the same function.
 */
export interface TransactionSource {
  _id?: unknown
  id?: unknown
  amount: number
  type: string
  category: string
  description: string
  merchant?: string | undefined
  notes?: string | undefined
  date: Date | string
  paymentMethod?: string | undefined
  status?: string | undefined
  createdAt?: Date | string | undefined
  updatedAt?: Date | string | undefined
}

export interface BudgetSource {
  _id?: unknown
  id?: unknown
  category: string
  limit: number
  month: number
  year: number
  createdAt?: Date | string | undefined
  updatedAt?: Date | string | undefined
}

export interface CategorySource {
  _id?: unknown
  id?: unknown
  slug: string
  name: string
  color: string
  icon: string
  order: number
}

/** Reads the document id from either `_id` or the serialised `id` field. */
function resolveId(source: { _id?: unknown; id?: unknown }): string {
  const value = source._id ?? source.id
  return value === undefined ? '' : String(value)
}

function toIso(value: Date | string | undefined, fallback: string): string {
  if (value === undefined) return fallback
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

export function toTransactionDto(transaction: TransactionSource, meta: CategoryMeta): TransactionDto {
  const date = toIso(transaction.date, new Date(0).toISOString())

  return {
    id: resolveId(transaction),
    amount: transaction.amount,
    type: transaction.type as TransactionType,
    category: transaction.category,
    categoryName: meta.name,
    categoryColor: meta.color,
    categoryIcon: meta.icon,
    description: transaction.description,
    merchant: transaction.merchant ?? null,
    notes: transaction.notes ?? null,
    date,
    paymentMethod: transaction.paymentMethod ?? null,
    status: (transaction.status ?? 'cleared') as TransactionStatus,
    createdAt: toIso(transaction.createdAt, date),
    updatedAt: toIso(transaction.updatedAt, date),
  }
}

export function toBudgetDto(budget: BudgetSource, meta: CategoryMeta, spent: number): BudgetDto {
  const createdAt = toIso(budget.createdAt, new Date(0).toISOString())

  return {
    id: resolveId(budget),
    category: budget.category,
    categoryName: meta.name,
    categoryColor: meta.color,
    categoryIcon: meta.icon,
    limit: budget.limit,
    spent,
    month: budget.month,
    year: budget.year,
    period: 'monthly',
    createdAt,
    updatedAt: toIso(budget.updatedAt, createdAt),
  }
}

export function toCategoryDto(category: CategorySource): CategoryDto {
  return {
    id: category.slug,
    slug: category.slug,
    name: category.name,
    color: category.color,
    icon: category.icon,
    order: category.order,
  }
}

export function toCategorySpendDto(
  categoryId: string,
  amount: number,
  total: number,
  meta: CategoryMeta,
): CategorySpendDto {
  return {
    categoryId,
    name: meta.name,
    amount,
    share: total > 0 ? amount / total : 0,
    color: meta.color,
  }
}
