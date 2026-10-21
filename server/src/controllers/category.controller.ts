import type { Request, Response } from 'express'

import { listCategories as listCategoriesService } from '../services/category.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

/** `GET /api/categories` — the category taxonomy. */
export const listCategories = asyncHandler(async (_request: Request, response: Response) => {
  const categories = await listCategoriesService()
  sendSuccess(response, categories)
})
