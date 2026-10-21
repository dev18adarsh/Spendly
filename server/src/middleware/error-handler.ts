import type { NextFunction, Request, Response } from 'express'

/** Terminal handler for unmatched routes. */
export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    error: {
      status: 404,
      message: `No route matches ${request.method} ${request.originalUrl}`,
    },
  })
}

/** Centralised error handler. Keeps responses JSON-shaped and never leaks stacks. */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  console.error('[api] Unhandled error:', error)

  response.status(500).json({
    error: {
      status: 500,
      message,
    },
  })
}
