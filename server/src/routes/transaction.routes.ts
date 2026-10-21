import { Router } from 'express'

import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '../controllers/transaction.controller.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema } from '../validators/common.js'
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from '../validators/transaction.validator.js'

export const transactionRouter = Router()

/**
 * `requireDatabase` runs *after* validation on every route: a malformed
 * request is still reported as a 422, while a well-formed request against a
 * broken database is reported as a 503 with the connection error — never as
 * an empty result.
 */
transactionRouter.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  requireDatabase,
  listTransactions,
)
transactionRouter.post(
  '/',
  validate(createTransactionSchema, 'body'),
  requireDatabase,
  createTransaction,
)

transactionRouter.get('/:id', validate(idParamSchema, 'params'), requireDatabase, getTransaction)
transactionRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateTransactionSchema, 'body'),
  requireDatabase,
  updateTransaction,
)
transactionRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requireDatabase,
  deleteTransaction,
)
