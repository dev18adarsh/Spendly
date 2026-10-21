import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Wraps an async handler so rejected promises reach Express' error pipeline
 * instead of becoming unhandled rejections.
 */
export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next)
  }
}
