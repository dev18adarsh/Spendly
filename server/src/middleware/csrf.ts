import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { CSRF_COOKIE, CSRF_HEADER, csrfCookieOptions } from '../config/cookies.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/api-error.js'

/** Methods that cannot change state and therefore need no CSRF token. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Compares two strings without leaking their contents through timing. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The CSRF token of this request, creating one when the client has none.
 *
 * The token is only created when the client does not have one yet, so it
 * stays stable for the lifetime of the cookie and the client can keep
 * repeating the same value in the `X-CSRF-Token` header.
 *
 * This runs on every request, which means a visitor who has never signed in
 * already carries a token and can sign in without a chicken-and-egg problem.
 */
export function resolveCsrfToken(request: Request, response: Response): string {
  const existing = (request.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE]
  if (existing) return existing

  const token = randomBytes(32).toString('base64url')
  response.cookie(CSRF_COOKIE, token, csrfCookieOptions())
  return token
}

/**
 * Makes sure the browser holds a CSRF cookie.
 *
 * @see resolveCsrfToken
 */
export const ensureCsrfCookie: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  resolveCsrfToken(request, response)
  next()
}

/**
 * Double-submit CSRF protection.
 *
 * The session is carried by a cookie, and cookies are sent automatically by
 * the browser. That is exactly what makes cross-site request forgery
 * possible, so every state-changing request has to prove it came from the
 * application: it must repeat the value of the readable `spendly_csrf` cookie
 * in the `X-CSRF-Token` header.
 *
 * A cross-site attacker can cause the browser to send the cookie, but it
 * cannot read the cookie's value, so it cannot produce a matching header.
 *
 * The `Origin` header is checked as well when the browser sends one — a
 * second, independent signal that the request came from an allowed origin.
 */
export const csrfProtection: RequestHandler = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    next()
    return
  }

  const origin = request.get('origin')
  if (origin && !env.corsOrigins.includes(origin)) {
    next(
      new ApiError(
        403,
        'ORIGIN_NOT_ALLOWED',
        'This request came from an origin that is not allowed to use the Spendly API.',
      ),
    )
    return
  }

  const cookieToken = (request.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE]
  const headerToken = request.get(CSRF_HEADER)

  if (!cookieToken || !headerToken) {
    next(
      new ApiError(
        403,
        'CSRF_TOKEN_MISSING',
        'This request is missing its security token. Refresh the page and try again.',
      ),
    )
    return
  }

  if (!safeEqual(cookieToken, headerToken)) {
    next(
      new ApiError(
        403,
        'CSRF_TOKEN_INVALID',
        'This request could not be verified. Refresh the page and try again.',
      ),
    )
    return
  }

  next()
}
