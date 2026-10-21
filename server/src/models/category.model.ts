import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

import { modelOptions } from './model-options.js'

/** The persisted shape of a category. */
export interface CategoryAttributes {
  slug: string
  name: string
  /** Hex colour used for charts, chips and avatars. */
  color: string
  /** Icon key resolved by the client's `CategoryIcon`. */
  icon: string
  order: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Reference data describing the categories transactions can be filed under.
 * Seeded from `constants/categories.ts` — it is a taxonomy, never sample
 * transaction data.
 */
const categorySchema = new Schema<CategoryAttributes>(
  {
    slug: {
      type: String,
      required: [true, 'slug is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'color is required'],
      trim: true,
    },
    icon: {
      type: String,
      required: [true, 'icon is required'],
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  modelOptions({ timestamps: true }),
)

categorySchema.index({ order: 1 })

export type CategoryDocument = HydratedDocument<CategoryAttributes>

/** A category as stored in MongoDB, including its id. */
export type CategoryLean = CategoryAttributes & { _id: Types.ObjectId }

export const CategoryModel = model<CategoryAttributes>('Category', categorySchema)
