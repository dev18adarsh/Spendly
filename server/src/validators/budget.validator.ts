import { z } from 'zod'

import { CATEGORY_SLUGS } from '../constants/categories.js'

/** Query accepted by `GET /api/budgets`. Defaults to the current month. */
export const listBudgetsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(1970).max(9999).optional(),
})

/** Body accepted by `PUT /api/budgets` (upsert) and `POST /api/budgets`. */
export const upsertBudgetSchema = z
  .object({
    category: z.enum(CATEGORY_SLUGS, { message: 'category is not a known category' }),
    limit: z.coerce
      .number({ message: 'limit must be a number' })
      .min(0, 'limit cannot be negative')
      .finite('limit must be a finite number'),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(1970).max(9999),
  })
  .strict()

/** Body accepted by `PATCH /api/budgets/:id`. */
export const updateBudgetSchema = z
  .object({
    limit: z.coerce
      .number({ message: 'limit must be a number' })
      .min(0, 'limit cannot be negative')
      .finite('limit must be a finite number'),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
