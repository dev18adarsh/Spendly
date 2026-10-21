import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { getConnectionError, isDatabaseReady } from '../config/database.js'
import { ApiError } from '../utils/api-error.js'

/**
 * Rejects data requests when MongoDB is not connected.
 *
 * Without this guard a query against a disconnected database would surface as
 * an opaque buffering timeout. Here the client is told plainly that the
 * database is unavailable and, when known, why.
 */
export const requireDatabase: RequestHandler = (
  _request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  if (isDatabaseReady()) {
    next()
    return
  }

  const reason = getConnectionError() ?? 'The database connection is not established.'
  next(
    ApiError.databaseUnavailable(
      `The database is unavailable, so this request could not be completed: ${reason}`,
      { databaseStatus: 'disconnected' },
    ),
  )
}
