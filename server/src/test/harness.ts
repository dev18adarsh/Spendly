import type { Express } from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

export interface TestHarness {
  app: Express
  stop: () => Promise<void>
}

/**
 * Boots the API against a throwaway in-memory MongoDB.
 *
 * The environment is configured *before* the application modules are imported
 * so `config/env.ts` picks up the test URI.
 */
export async function createTestHarness(): Promise<TestHarness> {
  const mongo = await MongoMemoryServer.create()

  process.env.NODE_ENV = 'test'
  process.env.MONGODB_URI = mongo.getUri()
  process.env.MONGODB_DB_NAME = 'spendly_test'
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '5000'

  const { createApp } = await import('../app.js')
  const { connectToDatabase } = await import('../config/database.js')
  const { seedCategories } = await import('../services/category.service.js')

  await connectToDatabase()
  await seedCategories()

  return {
    app: createApp(),
    stop: async () => {
      await mongoose.disconnect()
      await mongo.stop()
    },
  }
}

/** Removes every document so each test starts from a known state. */
export async function resetCollections(): Promise<void> {
  const { TransactionModel } = await import('../models/transaction.model.js')
  const { BudgetModel } = await import('../models/budget.model.js')
  await Promise.all([TransactionModel.deleteMany({}), BudgetModel.deleteMany({})])
}

export interface TransactionInput {
  amount: number
  /** Kept as `string` so tests can submit invalid values on purpose. */
  type: string
  category: string
  description: string
  merchant?: string
  date?: string
  paymentMethod?: string
  notes?: string
}

export function transactionPayload(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: 42.5,
    type: 'expense',
    category: 'food',
    description: 'Groceries',
    ...overrides,
  }
}
