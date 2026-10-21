import type { Request, Response } from 'express'
import { z } from 'zod'

import { currentUser } from '../middleware/authenticate.js'
import {
  getCashflow as getCashflowService,
  getCategoryBreakdown as getCategoryBreakdownService,
  getSummary as getSummaryService,
  getTopMerchants as getTopMerchantsService,
  RANGE_KEYS,
} from '../services/analytics.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'
import { validated } from '../utils/validated.js'

export const analyticsQuerySchema = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
})

export const merchantsQuerySchema = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
  limit: z.coerce.number().int().min(1).max(50).default(6),
})

type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
type MerchantsQuery = z.infer<typeof merchantsQuerySchema>

/** `GET /api/analytics/summary` — headline metrics for a reporting window. */
export const getSummary = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range } = validated<AnalyticsQuery>(request, 'query')
  const summary = await getSummaryService(userId, range)

  sendSuccess(response, summary)
})

/** `GET /api/analytics/cashflow` — income/expense series for a window. */
export const getCashflow = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range } = validated<AnalyticsQuery>(request, 'query')
  const series = await getCashflowService(userId, range)

  sendSuccess(response, series)
})

/** `GET /api/analytics/categories` — spend per category for a window. */
export const getCategoryBreakdown = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range } = validated<AnalyticsQuery>(request, 'query')
  const breakdown = await getCategoryBreakdownService(userId, range)

  sendSuccess(response, breakdown)
})

/** `GET /api/analytics/merchants` — top merchants by spend for a window. */
export const getTopMerchants = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range, limit } = validated<MerchantsQuery>(request, 'query')
  const merchants = await getTopMerchantsService(userId, range, limit)

  sendSuccess(response, merchants)
})
