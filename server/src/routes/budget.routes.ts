import { Router } from 'express'

import {
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
  updateBudget,
  upsertBudget,
} from '../controllers/budget.controller.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema } from '../validators/common.js'
import {
  listBudgetsQuerySchema,
  updateBudgetSchema,
  upsertBudgetSchema,
} from '../validators/budget.validator.js'

export const budgetRouter = Router()

budgetRouter.get('/', validate(listBudgetsQuerySchema, 'query'), requireDatabase, listBudgets)
budgetRouter.post('/', validate(upsertBudgetSchema, 'body'), requireDatabase, createBudget)
budgetRouter.put('/', validate(upsertBudgetSchema, 'body'), requireDatabase, upsertBudget)

budgetRouter.get('/:id', validate(idParamSchema, 'params'), requireDatabase, getBudget)
budgetRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateBudgetSchema, 'body'),
  requireDatabase,
  updateBudget,
)
budgetRouter.delete('/:id', validate(idParamSchema, 'params'), requireDatabase, deleteBudget)
