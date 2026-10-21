import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { SESSION_COOKIE } from '../config/cookies.js'
import { resolveSession } from '../services/session.service.js'
import { toUserDto } from '../services/mappers.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js'

/**
 * Reads the session cookie from the request.
 *
 * `request.cookies` is populated by `cookie-parser`, which the app mounts
 * before any route.
 */
export function readSessionToken(request: Request): string {
  const value = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
  return typeof value === 'string' ? value : ''
}

/**
 * Rejects requests that do not carry a valid session.
 *
 * The session cookie is the only thing that identifies the caller, so this
 * middleware is the single gate in front of every private route. It runs
 * *after* `requireDatabase`, because resolving a session needs the database.
 */
export const requireAuth: RequestHandler = asyncHandler(
  async (request: Request, _response: Response, next: NextFunction) => {
    const token = readSessionToken(request)

    if (!token) {
      next(ApiError.unauthorized('Sign in to continue.'))
      return
    }

    const session = await resolveSession(token)

    if (!session) {
      // The token was unknown, expired or revoked. Either way the caller is
      // anonymous — the reason is not disclosed.
      next(
        new ApiError(
          401,
          'SESSION_EXPIRED',
          'Your session has expired. Sign in again to continue.',
        ),
      )
      return
    }

    request.user = toUserDto(session.user)
    next()
  },
)

/**
 * The account behind the current request.
 *
 * Throws when used on a route that is not protected by `requireAuth` — that
 * is a programming error, not a client error.
 */
export function currentUser(request: Request): NonNullable<Request['user']> {
  if (!request.user) {
    throw new ApiError(500, 'AUTH_CONTEXT_MISSING', 'The authenticated user is not available.')
  }
  return request.user
}
