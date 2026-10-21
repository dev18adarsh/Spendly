import { z } from 'zod'

import { CATEGORY_SLUGS } from '../constants/categories.js'
import {
  PAYMENT_METHODS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '../constants/payment-methods.js'
import { RANGE_KEYS } from '../services/reporting-window.js'
import { optionalDateSchema, timeZoneSchema } from './common.js'

/** Body accepted by `POST /api/transactions`. */
export const createTransactionSchema = z
  .object({
    amount: z.coerce
      .number({ message: 'amount must be a number' })
      .positive('amount must be greater than 0')
      .finite('amount must be a finite number'),
    type: z.enum(TRANSACTION_TYPES, { message: 'type must be "income" or "expense"' }),
    category: z.enum(CATEGORY_SLUGS, { message: 'category is not a known category' }),
    description: z
      .string({ message: 'description is required' })
      .trim()
      .min(1, 'description cannot be empty')
      .max(200, 'description cannot exceed 200 characters'),
    merchant: z
      .string()
      .trim()
      .min(1, 'merchant cannot be empty')
      .max(120, 'merchant cannot exceed 120 characters')
      .optional(),
    notes: z.string().trim().max(500, 'notes cannot exceed 500 characters').optional(),
    date: optionalDateSchema,
    paymentMethod: z.enum(PAYMENT_METHODS, { message: 'paymentMethod is not supported' }).optional(),
    status: z.enum(TRANSACTION_STATUSES, { message: 'status is not supported' }).optional(),
  })
  .strict()

/** Body accepted by `PATCH /api/transactions/:id`. */
export const updateTransactionSchema = createTransactionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

/**
 * Query accepted by `GET /api/transactions`.
 * Supports filtering by date range, type and category, plus pagination.
 */
export const listTransactionsQuerySchema = z
  .object({
    /** Inclusive lower bound on the transaction date. */
    from: optionalDateSchema,
    /** Inclusive upper bound on the transaction date. */
    to: optionalDateSchema,
    /**
     * A reporting window.
     *
     * When present it wins over `from`/`to` and resolves to exactly the same
     * boundaries the analytics endpoints use, so a list and the totals
     * beside it always cover the same period.
     */
    range: z.enum(RANGE_KEYS).optional(),
    /** The IANA zone a reporting window is calculated in. */
    tz: timeZoneSchema,
    type: z.enum(TRANSACTION_TYPES).optional(),
    category: z.enum(CATEGORY_SLUGS).optional(),
    /** Free-text match against description and merchant. */
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).default(20),
    sort: z
      .enum(['date', '-date', 'amount', '-amount', 'createdAt', '-createdAt'])
      .default('-date'),
  })
  .refine((value) => !(value.from && value.to) || value.from <= value.to, {
    message: 'from must not be later than to',
    path: ['from'],
  })

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>
