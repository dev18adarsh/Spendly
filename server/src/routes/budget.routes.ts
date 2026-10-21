import { Router } from 'express'

import {
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
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
