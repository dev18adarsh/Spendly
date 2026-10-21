import { z } from 'zod'

import { resolveTimeZone } from '../utils/timezone.js'

/** Turns empty query strings into `undefined` instead of an invalid date. */
export const optionalDateSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.date().optional(),
)

/**
 * The IANA timezone a report is calculated in.
 *
 * The value is a display preference, so an unusable one is replaced with
 * UTC rather than rejected — the server must never fail a report because a
 * browser sent a zone this runtime does not know.
 */
export const timeZoneSchema = z
  .string()
  .max(64, 'tz is too long')
  .optional()
  .transform((value) => resolveTimeZone(value))

/** Query parameters shared by every list endpoint. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
})

/** Route parameter carrying a MongoDB document id. */
export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required').max(64, 'id is too long'),
})

/** A `{ field: message }` map of validation issues, safe to return to clients. */
export interface FieldIssue {
  field: string
  message: string
}

export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '_root',
    message: issue.message,
  }))
}
