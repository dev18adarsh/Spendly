import { Router } from 'express'

import {
  analyticsQuerySchema,
  getCashflow,
  getCategoryBreakdown,
  getSummary,
  getTopMerchants,
  merchantsQuerySchema,
} from '../controllers/analytics.controller.js'
import { requireAuth } from '../middleware/authenticate.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'

export const analyticsRouter = Router()

/** Analytics are private — they only ever aggregate the caller's own data. */
analyticsRouter.get(
  '/summary',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  getSummary,
)
analyticsRouter.get(
  '/cashflow',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  getCashflow,
)
analyticsRouter.get(
  '/categories',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  getCategoryBreakdown,
)
analyticsRouter.get(
  '/merchants',
  validate(merchantsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  getTopMerchants,
)
