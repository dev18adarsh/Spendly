import type { Request } from 'express'

import type { ValidationSource } from '../middleware/validate.js'

/**
 * Reads the output of the validation middleware for a given request part.
 *
 * Controllers only ever consume data that has passed its schema.
 */
export function validated<T>(request: Request, source: ValidationSource): T {
  return request.validated[source] as T
}
