import type { Request, Response } from 'express'
import { z } from 'zod'

import { currentUser } from '../middleware/authenticate.js'
import {
  getCashflow as getCashflowService,
  getCategoryBreakdown as getCategoryBreakdownService,
  getSummary as getSummaryService,
  getTopMerchants as getTopMerchantsService,
  INTERVAL_KEYS,
  RANGE_KEYS,
} from '../services/analytics.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'
import { validated } from '../utils/validated.js'
import { timeZoneSchema } from '../validators/common.js'

export const analyticsQuerySchema = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
  /** The IANA zone the report is calculated in. Defaults to UTC. */
  tz: timeZoneSchema,
})

export const cashflowQuerySchema = analyticsQuerySchema.extend({
  /** The bucket size of the series. Defaults to the range's own granularity. */
  interval: z.enum(INTERVAL_KEYS).optional(),
})

export const merchantsQuerySchema = analyticsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(6),
})

type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
type CashflowQuery = z.infer<typeof cashflowQuerySchema>
type MerchantsQuery = z.infer<typeof merchantsQuerySchema>

/** `GET /api/analytics/summary` — headline metrics for a reporting window. */
export const getSummary = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range, tz } = validated<AnalyticsQuery>(request, 'query')
  const summary = await getSummaryService(userId, range, new Date(), tz)

  sendSuccess(response, summary)
})

/** `GET /api/analytics/cashflow` — income/expense series for a window. */
export const getCashflow = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range, tz, interval } = validated<CashflowQuery>(request, 'query')
  const series = await getCashflowService(userId, range, new Date(), tz, interval)

  sendSuccess(response, series)
})

/** `GET /api/analytics/categories` — spend per category for a window. */
export const getCategoryBreakdown = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range, tz } = validated<AnalyticsQuery>(request, 'query')
  const breakdown = await getCategoryBreakdownService(userId, range, new Date(), tz)

  sendSuccess(response, breakdown)
})

/** `GET /api/analytics/merchants` — top merchants by spend for a window. */
export const getTopMerchants = asyncHandler(async (request: Request, response: Response) => {
  const { id: userId } = currentUser(request)
  const { range, tz, limit } = validated<MerchantsQuery>(request, 'query')
  const merchants = await getTopMerchantsService(userId, range, limit, new Date(), tz)

  sendSuccess(response, merchants)
})
