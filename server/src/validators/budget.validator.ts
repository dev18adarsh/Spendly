import { z } from 'zod'

import { CATEGORY_SLUGS } from '../constants/categories.js'
import { timeZoneSchema } from './common.js'

const limitSchema = z.coerce
  .number({ message: 'limit must be a number' })
  .min(0, 'limit cannot be negative')
  .finite('limit must be a finite number')

/**
 * Which month a budget refers to, and the zone its boundaries align to.
 *
 * `month`/`year` are optional everywhere: when they are left out the server
 * resolves them from `tz`, so "this month" means the caller's this month
 * rather than UTC's. `tz` itself is a display preference and falls back to
 * UTC when it cannot be understood — see `timeZoneSchema`.
 */
const periodFields = {
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(1970).max(9999).optional(),
  tz: timeZoneSchema,
}

/** Query accepted by `GET /api/budgets`. Defaults to the current month in `tz`. */
export const listBudgetsQuerySchema = z.object(periodFields)

/** Query accepted by `GET`/`DELETE /api/budgets/overall`. */
export const overallBudgetQuerySchema = z.object(periodFields)

/** Body accepted by `PUT /api/budgets` (upsert) and `POST /api/budgets`. */
export const upsertBudgetSchema = z
  .object({
    category: z.enum(CATEGORY_SLUGS, { message: 'category is not a known category' }),
    limit: limitSchema,
    ...periodFields,
  })
  .strict()

/** Body accepted by `PUT /api/budgets/overall`. */
export const overallBudgetSchema = z
  .object({
    limit: limitSchema,
    ...periodFields,
  })
  .strict()

/** Body accepted by `PATCH /api/budgets/:id`. */
export const updateBudgetSchema = z
  .object({
    limit: limitSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>
export type OverallBudgetQuery = z.infer<typeof overallBudgetQuerySchema>
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>
export type OverallBudgetInput = z.infer<typeof overallBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
