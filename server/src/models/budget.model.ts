import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

import { CATEGORY_SLUGS, type CategorySlug } from '../constants/categories.js'
import { modelOptions, toMoney } from './model-options.js'

/** The persisted shape of a monthly budget. */
export interface BudgetAttributes {
  category: CategorySlug
  /** Monthly spend limit for the category. */
  limit: number
  /** Calendar month, 1–12. */
  month: number
  year: number
  createdAt: Date
  updatedAt: Date
}

const budgetSchema = new Schema<BudgetAttributes>(
  {
    category: {
      type: String,
      required: [true, 'category is required'],
      enum: { values: CATEGORY_SLUGS, message: 'category is not a known category' },
    },
    limit: {
      type: Number,
      required: [true, 'limit is required'],
      min: [0, 'limit cannot be negative'],
      set: (value: number) => (typeof value === 'number' ? toMoney(value) : value),
    },
    month: {
      type: Number,
      required: [true, 'month is required'],
      min: [1, 'month must be between 1 and 12'],
      max: [12, 'month must be between 1 and 12'],
    },
    year: {
      type: Number,
      required: [true, 'year is required'],
      min: [1970, 'year must be a valid calendar year'],
      max: [9999, 'year must be a valid calendar year'],
    },
  },
  modelOptions({ timestamps: true }),
)

/** One budget per category per calendar month. */
budgetSchema.index({ category: 1, month: 1, year: 1 }, { unique: true })
budgetSchema.index({ year: 1, month: 1 })

export type BudgetDocument = HydratedDocument<BudgetAttributes>

/** A budget as stored in MongoDB, including its id. */
export type BudgetLean = BudgetAttributes & { _id: Types.ObjectId }

export const BudgetModel = model<BudgetAttributes>('Budget', budgetSchema)
