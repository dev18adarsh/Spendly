import mongoose from 'mongoose'

import { env, redactUri } from './env.js'

/**
 * MongoDB (Atlas) connection management.
 *
 * The connection state is tracked explicitly so the API can report *why* it is
 * unavailable instead of failing requests with a generic 500 or, worse,
 * answering with fabricated data.
 */

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

let lastConnectionError: string | null = null
let lastConnectionAttemptAt: string | null = null

mongoose.set('strictQuery', true)

mongoose.connection.on('error', (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  lastConnectionError = message
  console.error('[db] Connection error:', message)
})

mongoose.connection.on('disconnected', () => {
  console.warn('[db] Connection lost - the API will answer data requests with 503.')
})

/** `disconnected` / `connecting` / `connected` / `disconnecting`. */
export function databaseStatus(): ConnectionState {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected'
    case 1:
      return 'connected'
    case 2:
      return 'connecting'
    case 3:
      return 'disconnecting'
    default:
      return 'disconnected'
  }
}

/** True only when MongoDB is actually usable. */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1
}

/**
 * The last connection failure, if any.
 *
 * Surfaced by the health endpoint and by the `DATABASE_UNAVAILABLE` error
 * returned from data routes while the database is down.
 */
export function getConnectionError(): string | null {
  return lastConnectionError
}

export function getConnectionAttemptAt(): string | null {
  return lastConnectionAttemptAt
}

/**
 * Connects to MongoDB Atlas.
 *
 * Throws with the underlying driver error when the connection cannot be
 * established — callers decide whether that is fatal (production bootstrap)
 * or degraded (development server that still serves `/api/health`).
 */
export async function connectToDatabase(): Promise<void> {
  if (!env.mongoUri) {
    lastConnectionAttemptAt = new Date().toISOString()
    lastConnectionError =
      'MONGODB_URI is not configured. Copy .env.example to .env and add your MongoDB Atlas URI.'
    throw new Error(lastConnectionError)
  }

  lastConnectionAttemptAt = new Date().toISOString()
  lastConnectionError = null

  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    })
    console.log(
      `[db] Connected to MongoDB (database "${env.mongoDbName}", source "${redactUri(env.mongoUri)}").`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastConnectionError = message
    throw new Error(`Failed to connect to MongoDB: ${message}`)
  }
}

/** Re-attempts a previously failed connection. */
export async function reconnectToDatabase(): Promise<void> {
  await connectToDatabase()
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}
