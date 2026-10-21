import type { SchemaOptions } from 'mongoose'

/**
 * Shared Mongoose options.
 *
 * Every document is serialised with `_id` exposed as `id` and internal fields
 * removed, so API responses stay consistent across models.
 */
export const idTransform = {
  transform: (_document: unknown, returned: Record<string, unknown>): Record<string, unknown> => {
    returned.id = String(returned._id)
    delete returned._id
    delete returned.__v
    return returned
  },
} as const

export function modelOptions(extra: SchemaOptions = {}): SchemaOptions {
  return {
    versionKey: false,
    toJSON: idTransform,
    toObject: idTransform,
    ...extra,
  }
}

/** Rounds a monetary value to two decimal places. */
export function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
