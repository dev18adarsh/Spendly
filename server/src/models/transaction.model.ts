import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

import { CATEGORY_SLUGS, type CategorySlug } from '../constants/categories.js'
import {
  PAYMENT_METHODS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type PaymentMethod,
  type TransactionStatus,
  type TransactionType,
} from '../constants/payment-methods.js'
import { modelOptions, toMoney } from './model-options.js'

/**
 * The persisted shape of a transaction.
 *
 * Declared explicitly so the model, the services and the API all agree on one
 * contract instead of relying on schema inference.
 */
export interface TransactionAttributes {
  /** Always positive — `type` carries the direction. */
  amount: number
  type: TransactionType
  category: CategorySlug
  description: string
  /** Optional counterparty, e.g. "Blue Bottle Coffee". */
  merchant?: string
  notes?: string
  date: Date
  /** Optional settlement method. */
  paymentMethod?: PaymentMethod
  status: TransactionStatus
  createdAt: Date
  updatedAt: Date
}

const transactionSchema = new Schema<TransactionAttributes>(
  {
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0, 'amount cannot be negative'],
      set: (value: number) => (typeof value === 'number' ? toMoney(value) : value),
    },
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: { values: TRANSACTION_TYPES, message: 'type must be "income" or "expense"' },
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      enum: { values: CATEGORY_SLUGS, message: 'category is not a known category' },
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      maxlength: [200, 'description cannot exceed 200 characters'],
    },
    merchant: {
      type: String,
      trim: true,
      maxlength: [120, 'merchant cannot exceed 120 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'notes cannot exceed 500 characters'],
    },
    date: {
      type: Date,
      required: [true, 'date is required'],
      default: () => new Date(),
    },
    paymentMethod: {
      type: String,
      enum: { values: PAYMENT_METHODS, message: 'paymentMethod is not supported' },
    },
    status: {
      type: String,
      enum: { values: TRANSACTION_STATUSES, message: 'status is not supported' },
      default: 'cleared',
    },
  },
  modelOptions({ timestamps: true }),
)

transactionSchema.index({ date: -1 })
transactionSchema.index({ category: 1, date: -1 })
transactionSchema.index({ type: 1, date: -1 })

export type TransactionDocument = HydratedDocument<TransactionAttributes>

/** A transaction as stored in MongoDB, including its id. */
export type TransactionLean = TransactionAttributes & { _id: Types.ObjectId }

export const TransactionModel = model<TransactionAttributes>('Transaction', transactionSchema)
