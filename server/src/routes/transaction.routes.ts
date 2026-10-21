import { Router } from 'express'

import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '../controllers/transaction.controller.js'
import { requireAuth } from '../middleware/authenticate.js'
import { csrfProtection } from '../middleware/csrf.js'
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
 * Every route here is private.
 *
 * The middleware order matters:
 *   1. `validate`        — a malformed request is a 422, whatever else is wrong
 *   2. `requireDatabase` — a broken database is a 503, not a fake success
 *   3. `requireAuth`     — an anonymous request is a 401
 *   4. `csrfProtection`  — a forged request is a 403
 *
 * `requireAuth` runs after `requireDatabase` because resolving a session
 * needs the database, and before `csrfProtection` so that a caller without a
 * session is told to sign in instead of being told about tokens.
 */
transactionRouter.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  requireDatabase,
  requireAuth,
  listTransactions,
)
transactionRouter.post(
  '/',
  validate(createTransactionSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  createTransaction,
)

transactionRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  requireDatabase,
  requireAuth,
  getTransaction,
)
transactionRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateTransactionSchema, 'body'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  updateTransaction,
)
transactionRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requireDatabase,
  requireAuth,
  csrfProtection,
  deleteTransaction,
)
