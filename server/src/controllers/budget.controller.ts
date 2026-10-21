import type { Request, Response } from 'express'
import type { z } from 'zod'

import { currentUser } from '../middleware/authenticate.js'
import {
  deleteBudget as deleteBudgetService,
  deleteOverallBudget as deleteOverallBudgetService,
  getBudgetById,
  getOverallBudget as getOverallBudgetService,
  listBudgets as listBudgetsService,
  saveOverallBudget as saveOverallBudgetService,
  updateBudgetById,
  upsertBudget as upsertBudgetService,
} from '../services/budget.service.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendNoContent, sendSuccess } from '../utils/response.js'
import { validated } from '../utils/validated.js'
import { idParamSchema } from '../validators/common.js'
import type {
  ListBudgetsQuery,
  OverallBudgetInput,
  OverallBudgetQuery,
  UpdateBudgetInput,
  UpsertBudgetInput,
} from '../validators/budget.validator.js'

type IdParams = z.infer<typeof idParamSchema>

/** `GET /api/budgets` — monthly budgets with the amount already spent. */
export const listBudgets = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const query = validated<ListBudgetsQuery>(request, 'query')
  const budgets = await listBudgetsService(userId, query)

  sendSuccess(response, budgets)
})

/** `GET /api/budgets/:id` — a single budget. */
export const getBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const budget = await getBudgetById(userId, id)

  if (!budget) {
    throw ApiError.notFound(`No budget found with id "${id}".`)
  }

  sendSuccess(response, budget)
})

/** `POST /api/budgets` — create a budget, or update it if it already exists. */
export const createBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const input = validated<UpsertBudgetInput>(request, 'body')
  const budget = await upsertBudgetService(userId, input)

  sendSuccess(response, budget, undefined, 201)
})

/** `PUT /api/budgets` — upsert a budget by category, month and year. */
export const upsertBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const input = validated<UpsertBudgetInput>(request, 'body')
  const budget = await upsertBudgetService(userId, input)

  sendSuccess(response, budget)
})

/** `PATCH /api/budgets/:id` — update a budget's limit. */
export const updateBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const input = validated<UpdateBudgetInput>(request, 'body')

  const budget = await updateBudgetById(userId, id, input)

  if (!budget) {
    throw ApiError.notFound(`No budget found with id "${id}".`)
  }

  sendSuccess(response, budget)
})

/** `DELETE /api/budgets/:id` — remove a budget. */
export const deleteBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { id } = validated<IdParams>(request, 'params')
  const deleted = await deleteBudgetService(userId, id)

  if (!deleted) {
    throw ApiError.notFound(`No budget found with id "${id}".`)
  }

  sendNoContent(response)
})

/** `GET /api/budgets/overall` — overall monthly spending budget. */
export const getOverallBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const query = validated<OverallBudgetQuery>(request, 'query')
  const budget = await getOverallBudgetService(userId, query)

  sendSuccess(response, budget)
})

/** `PUT /api/budgets/overall` — set or update the overall monthly spending budget. */
export const saveOverallBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const input = validated<OverallBudgetInput>(request, 'body')
  const budget = await saveOverallBudgetService(userId, input)

  sendSuccess(response, budget)
})

/** `DELETE /api/budgets/overall` — remove the overall monthly budget for a period. */
export const deleteOverallBudget = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const query = validated<OverallBudgetQuery>(request, 'query')
  const deleted = await deleteOverallBudgetService(userId, query)

  if (!deleted) {
    throw ApiError.notFound('No overall budget found for this period.')
  }

  sendNoContent(response)
})

