import { Router } from 'express'

import {
  analyticsQuerySchema,
  getCashflow,
  getCategoryBreakdown,
  getSummary,
  getTopMerchants,
  merchantsQuerySchema,
} from '../controllers/analytics.controller.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'

export const analyticsRouter = Router()

analyticsRouter.get(
  '/summary',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  getSummary,
)
analyticsRouter.get(
  '/cashflow',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  getCashflow,
)
analyticsRouter.get(
  '/categories',
  validate(analyticsQuerySchema, 'query'),
  requireDatabase,
  getCategoryBreakdown,
)
analyticsRouter.get(
  '/merchants',
  validate(merchantsQuerySchema, 'query'),
  requireDatabase,
  getTopMerchants,
)
