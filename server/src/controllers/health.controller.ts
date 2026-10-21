import type { Request, Response } from 'express'

import {
  databaseStatus,
  getConnectionAttemptAt,
  getConnectionError,
  isDatabaseReady,
} from '../config/database.js'
import { env } from '../config/env.js'
import { sendSuccess } from '../utils/response.js'

const SERVICE_NAME = 'spendly-api'
const SERVICE_VERSION = '0.2.0'

function databaseReport(): Record<string, unknown> {
  return {
    status: databaseStatus(),
    name: env.mongoDbName,
    /** The reason the last connection attempt failed, if any. */
    error: getConnectionError(),
    lastAttemptAt: getConnectionAttemptAt(),
  }
}

/**
 * `GET /api/health` — liveness probe.
 *
 * Always answers 200 while the process is running, and reports the database
 * connection state (including the connection error) in the body.
 */
export function health(_request: Request, response: Response): void {
  sendSuccess(response, {
    status: 'ok',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    database: databaseReport(),
    timestamp: new Date().toISOString(),
  })
}

/**
 * `GET /api/health/ready` — readiness probe.
 *
 * Answers 503 when MongoDB is not connected, so orchestrators do not route
 * traffic to an instance that cannot serve data.
 */
export function readiness(_request: Request, response: Response): void {
  const ready = isDatabaseReady()

  sendSuccess(
    response,
    {
      status: ready ? 'ready' : 'not_ready',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      database: databaseReport(),
      timestamp: new Date().toISOString(),
    },
    undefined,
    ready ? 200 : 503,
  )
}
