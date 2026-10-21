import { Router } from 'express'

import { healthRouter } from './health.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)

/*
 * Planned routes — intentionally not implemented yet.
 * The client reads from sample data until these land:
 *
 *   GET /api/summary?range=30d
 *   GET /api/analytics/cashflow?range=12m
 *   GET /api/analytics/categories?range=30d
 *   GET /api/analytics/merchants?range=30d
 *   GET /api/transactions?search=&categoryId=&type=&range=
 *   GET /api/budgets
 *   GET /api/categories
 *
 * See `client/src/services/http.ts` for the exact client-side contract.
 */
