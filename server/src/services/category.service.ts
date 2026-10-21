import { CATEGORY_DEFINITIONS } from '../constants/categories.js'
import { CategoryModel } from '../models/category.model.js'
import type { CategoryDto } from '../types/api.js'
import { fallbackCategoryMeta, toCategoryDto, type CategoryMeta } from './mappers.js'

/**
 * Category lookups.
 *
 * Categories are reference data: the collection is seeded from the canonical
 * taxonomy and then read (and cached) to enrich transactions and budgets with
 * their display name, colour and icon.
 */

const CACHE_TTL_MS = 30_000

let cache: Map<string, CategoryMeta> | null = null
let cachedAt = 0

export function invalidateCategoryCache(): void {
  cache = null
  cachedAt = 0
}

/**
 * Inserts any missing categories and refreshes their display attributes.
 * Safe to run repeatedly — it never duplicates rows.
 */
export async function seedCategories(): Promise<number> {
  const operations = CATEGORY_DEFINITIONS.map((definition) =>
    CategoryModel.updateOne(
      { slug: definition.slug },
      {
        $set: {
          name: definition.name,
          color: definition.color,
          icon: definition.icon,
          order: definition.order,
        },
      },
      { upsert: true },
    ),
  )

  const results = await Promise.all(operations)
  invalidateCategoryCache()

  return results.reduce((total, result) => total + (result.upsertedCount ?? 0), 0)
}

export async function getCategoryMap(): Promise<Map<string, CategoryMeta>> {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache

  const rows = await CategoryModel.find().lean().exec()
  const map = new Map<string, CategoryMeta>()

  for (const row of rows) {
    map.set(row.slug, {
      slug: row.slug,
      name: row.name,
      color: row.color,
      icon: row.icon,
    })
  }

  cache = map
  cachedAt = Date.now()
  return map
}

export async function resolveCategory(slug: string): Promise<CategoryMeta> {
  const map = await getCategoryMap()
  return map.get(slug) ?? fallbackCategoryMeta(slug)
}

export async function resolveCategories(slugs: string[]): Promise<Map<string, CategoryMeta>> {
  const map = await getCategoryMap()
  const resolved = new Map<string, CategoryMeta>()

  for (const slug of new Set(slugs)) {
    resolved.set(slug, map.get(slug) ?? fallbackCategoryMeta(slug))
  }

  return resolved
}

export async function listCategories(): Promise<CategoryDto[]> {
  const rows = await CategoryModel.find().sort({ order: 1, slug: 1 }).lean().exec()
  return rows.map((row) => toCategoryDto(row))
}
