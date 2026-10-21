import mongoose from 'mongoose'

import { env } from '../config/env.js'

/**
 * MongoDB Atlas connection helper.
 *
 * The connection is optional: when `MONGODB_URI` is not configured the server
 * still boots and reports `disconnected` on the health probe. No data is
 * written anywhere until the transaction routes are implemented.
 */
export async function connectToDatabase(): Promise<boolean> {
  if (!env.mongoUri) {
    console.warn(
      '[db] MONGODB_URI is not set — starting without a database connection. ' +
        'Copy .env.example to .env and add your MongoDB Atlas URI to enable it.',
    )
    return false
  }

  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: 10_000,
    })
    console.log(`[db] Connected to MongoDB Atlas (database "${env.mongoDbName}").`)
    return true
  } catch (error) {
    console.error('[db] Failed to connect to MongoDB Atlas:', error)
    return false
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

/** `connected` / `disconnected` / `connecting` / `disconnecting`. */
export function databaseStatus(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  return states[mongoose.connection.readyState] ?? 'unknown'
}
