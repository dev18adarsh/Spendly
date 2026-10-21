import { Router } from 'express'

import { databaseStatus } from '../db/mongo.js'

export const healthRouter = Router()

/**
 * Liveness/readiness probe.
 *
 * This is the only route the server exposes today — there is no transaction
 * storage yet, so nothing here reports persisted data.
 */
healthRouter.get('/', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'spendly-api',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    database: databaseStatus(),
    timestamp: new Date().toISOString(),
  })
})
