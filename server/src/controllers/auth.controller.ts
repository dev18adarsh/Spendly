import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'

import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from '../config/cookies.js'
import { currentUser, readSessionToken } from '../middleware/authenticate.js'
import { resolveCsrfToken } from '../middleware/csrf.js'
import {
  assertLoginAllowed,
  clearFailedLogins,
  recordFailedLogin,
} from '../services/login-throttle.service.js'
import { dummyPasswordHash, verifyPassword } from '../services/password.service.js'
import { createSession, destroySession } from '../services/session.service.js'
import { createUser, findUserByEmail } from '../services/user.service.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendNoContent, sendSuccess } from '../utils/response.js'
import { validated } from '../utils/validated.js'
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js'

/** The message used for every failed sign-in, whatever the cause. */
const INVALID_CREDENTIALS = 'That email address and password do not match an account.'

/**
 * Issues the session and CSRF cookies.
 *
 * The session cookie is HTTP-only — the browser attaches it to every request
 * but no script can read it. The CSRF cookie is deliberately readable so the
 * client can copy it into the `X-CSRF-Token` header.
 *
 * The CSRF token is *not* rotated here: a client that is already holding one
 * keeps it, so a token fetched before signing in stays valid afterwards. The
 * session itself is new on every sign-in, which is what has to be rotated.
 */
function issueSessionCookies(request: Request, response: Response, token: string): void {
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions())

  const existing = (request.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE]
  if (!existing) {
    response.cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), csrfCookieOptions())
  }
}

/**
 * Removes the session cookie.
 *
 * The CSRF cookie is deliberately left alone: it is not a credential and it
 * is not tied to the session, so keeping it means the client stays usable
 * straight after signing out (and signing back in).
 */
function clearSessionCookies(response: Response): void {
  response.clearCookie(SESSION_COOKIE, clearCookieOptions())
}

/** `POST /api/auth/register` — create an account and sign in. */
export const register = asyncHandler(async (request: Request, response: Response) => {
  const input = validated<RegisterInput>(request, 'body')

  const user = await createUser({
    email: input.email,
    name: input.name,
    password: input.password,
  })

  const session = await createSession(user.id, {
    userAgent: request.get('user-agent')?.slice(0, 256),
    ip: request.ip,
  })

  issueSessionCookies(request, response, session.token)

  sendSuccess(response, user, undefined, 201)
})

/** `POST /api/auth/login` — exchange credentials for a session cookie. */
export const login = asyncHandler(async (request: Request, response: Response) => {
  const { email, password } = validated<LoginInput>(request, 'body')

  assertLoginAllowed(email)

  const account = await findUserByEmail(email)

  if (!account) {
    // Hash something anyway so the response time does not reveal whether the
    // address is registered.
    await verifyPassword(password, await dummyPasswordHash())
    recordFailedLogin(email)
    throw new ApiError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS)
  }

  const matches = await verifyPassword(password, account.passwordHash)

  if (!matches) {
    recordFailedLogin(email)
    throw new ApiError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS)
  }

  clearFailedLogins(email)

  const session = await createSession(account.id, {
    userAgent: request.get('user-agent')?.slice(0, 256),
    ip: request.ip,
  })

  issueSessionCookies(request, response, session.token)

  sendSuccess(response, {
    id: account.id,
    email: account.email,
    name: account.name,
    createdAt: account.createdAt.toISOString(),
  })
})

/** `POST /api/auth/logout` — revoke the session and clear the cookies. */
export const logout = asyncHandler(async (request: Request, response: Response) => {
  const token = readSessionToken(request)

  // Always succeed: signing out of an expired session is not an error.
  if (token) await destroySession(token)

  clearSessionCookies(response)

  sendNoContent(response)
})

/** `GET /api/auth/me` — the account behind the current session. */
export const me = asyncHandler(async (request: Request, response: Response) => {
  sendSuccess(response, currentUser(request))
})

/**
 * `GET /api/auth/csrf` — the current CSRF token.
 *
 * The client calls this once to learn the value it has to repeat in the
 * `X-CSRF-Token` header. The token is not a secret — it is a
 * double-submit value, and the protection comes from the fact that a
 * cross-site attacker cannot read it.
 */
export const csrfToken = (request: Request, response: Response): void => {
  sendSuccess(response, { csrfToken: resolveCsrfToken(request, response) })
}
