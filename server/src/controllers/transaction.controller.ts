import type { Request, Response } from 'express'
import type { z } from 'zod'

import { env } from '../config/env.js'
import { currentUser } from '../middleware/authenticate.js'
import { resolveRange } from '../services/reporting-window.js'
import {
  createTransaction as createTransactionService,
  deleteTransaction as deleteTransactionService,
  getTransactionById,
  listTransactions as listTransactionsService,
  updateTransaction as updateTransactionService,
} from '../services/transaction.service.js'
import {
  emitTransactionCreated,
  emitTransactionDeleted,
  emitTransactionUpdated,
} from '../socket.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { buildPaginationMeta } from '../utils/pagination.js'
import { sendNoContent, sendSuccess } from '../utils/response.js'
import { validated } from '../utils/validated.js'
import { idParamSchema } from '../validators/common.js'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js'

type IdParams = z.infer<typeof idParamSchema>

/** `GET /api/transactions` — list with filtering, sorting and pagination. */
export const listTransactions = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const query = validated<ListTransactionsQuery>(request, 'query')

  // A reporting window is resolved by the same code the analytics use, so a
  // list and the totals beside it always cover exactly the same period.
  const range = query.range
    ? resolveRange(query.range, new Date(), query.tz)
    : undefined

  const from = range?.from ?? query.from
  const to = range?.to ?? query.to
  const exclusiveTo = range !== undefined

  const limit = Math.min(query.limit, env.maxPageSize)
  const result = await listTransactionsService(userId, {
    ...query,
    from,
    to,
    exclusiveTo,
    limit,
  })

  const meta = buildPaginationMeta(result.total, {
    page: query.page,
    limit,
    skip: (query.page - 1) * limit,
  })

  sendSuccess(response, result.items, { pagination: meta })
})

/** `GET /api/transactions/:id` — a single transaction. */
export const getTransaction = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const transaction = await getTransactionById(userId, id)

  if (!transaction) {
    throw ApiError.notFound(`No transaction found with id "${id}".`)
  }

  sendSuccess(response, transaction)
})

/** `POST /api/transactions` — create a transaction. */
export const createTransaction = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const input = validated<CreateTransactionInput>(request, 'body')
  const transaction = await createTransactionService(userId, input)

  emitTransactionCreated(userId, transaction)

  sendSuccess(response, transaction, undefined, 201)
})

/** `PATCH /api/transactions/:id` — partially update a transaction. */
export const updateTransaction = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const input = validated<UpdateTransactionInput>(request, 'body')

  const transaction = await updateTransactionService(userId, id, input)

  if (!transaction) {
    throw ApiError.notFound(`No transaction found with id "${id}".`)
  }

  emitTransactionUpdated(userId, transaction)

  sendSuccess(response, transaction)
})

/** `DELETE /api/transactions/:id` — remove a transaction. */
export const deleteTransaction = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const deleted = await deleteTransactionService(userId, id)

  if (!deleted) {
    throw ApiError.notFound(`No transaction found with id "${id}".`)
  }

  emitTransactionDeleted(userId, id)

  sendNoContent(response)
})
