import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../utils/api-error.js'

/** Terminal handler for unmatched routes. */
export function notFoundHandler(request: Request, _response: Response, next: NextFunction): void {
  next(ApiError.notFound(`No route matches ${request.method} ${request.originalUrl}`))
}
