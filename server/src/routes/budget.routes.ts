import { Router } from 'express'

import {
  createBudget,
  deleteBudget,
  deleteOverallBudget,
  getBudget,
  getOverallBudget,
  listBudgets,
  saveOverallBudget,
  updateBudget,
  upsertBudget,
} from '../controllers/budget.controller.js'
import { requireAuth } from '../middleware/authenticate.js'
import { csrfProtection } from '../middleware/csrf.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema } from '../validators/common.js'
import {
  listBudgetsQuerySchema,
  overallBudgetQuerySchema,
  overallBudgetSchema,
  updateBudgetSchema,
  upsertBudgetSchema,
} from '../validators/budget.validator.js'

export const budgetRouter = Router()

/** Budgets are private — see `transaction.routes.ts` for the middleware order. */
budgetRouter.get(
  '/',
  validate(listBudgetsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  listBudgets,
)
budgetRouter.post(
  '/',
  validate(upsertBudgetSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  createBudget,
)
budgetRouter.put(
  '/',
  validate(upsertBudgetSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  upsertBudget,
)

/** Overall monthly spending budget */
budgetRouter.get(
  '/overall',
  validate(overallBudgetQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  getOverallBudget,
)
budgetRouter.put(
  '/overall',
  validate(overallBudgetSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  saveOverallBudget,
)
budgetRouter.post(
  '/overall',
  validate(overallBudgetSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  saveOverallBudget,
)
budgetRouter.delete(
  '/overall',
  validate(overallBudgetQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  deleteOverallBudget,
)


budgetRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  requireDatabase,
  requireAuth,
  getBudget,
)
budgetRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateBudgetSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  updateBudget,
)
budgetRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  deleteBudget,
)
