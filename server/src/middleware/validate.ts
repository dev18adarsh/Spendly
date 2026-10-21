import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { z } from 'zod'

import { ApiError } from '../utils/api-error.js'
import { toFieldIssues } from '../validators/common.js'

export type ValidationSource = 'body' | 'query' | 'params'

/**
 * Validates one part of the request against a Zod schema.
 *
 * Parsed output is stored on `request.validated` — `req.query` is read-only in
 * Express 5, and keeping validated data separate makes it explicit which
 * input a handler is allowed to trust.
 */
export function validate(schema: z.ZodTypeAny, source: ValidationSource = 'body'): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request[source])

    if (!result.success) {
      next(ApiError.validation('Request validation failed.', toFieldIssues(result.error)))
      return
    }

    request.validated = { ...request.validated, [source]: result.data }
    next()
  }
}
