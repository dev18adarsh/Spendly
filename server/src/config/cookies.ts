import type { CookieOptions } from 'express'

import { env } from './env.js'

/**
 * Cookie names used by the authentication flow.
 *
 * The session cookie holds an opaque token and is HTTP-only, so JavaScript
 * (including any script that manages to run on the page) cannot read it.
 *
 * The CSRF cookie holds a *double-submit* token: it is deliberately readable
 * by the client so it can be copied into the `X-CSRF-Token` header, and it is
 * never a credential on its own — without the session cookie it grants
 * nothing.
 */
export const SESSION_COOKIE = 'spendly_session'
export const CSRF_COOKIE = 'spendly_csrf'

/** Header the client copies the CSRF cookie into. */
export const CSRF_HEADER = 'x-csrf-token'

function baseOptions(): CookieOptions {
  const secure = env.cookieSameSite === 'none' ? true : env.cookieSecure
  const options: CookieOptions = {
    path: '/',
    sameSite: env.cookieSameSite,
    secure,
  }

  if (env.cookieDomain) options.domain = env.cookieDomain
  return options
}

/** Options for the HTTP-only session cookie. */
export function sessionCookieOptions(): CookieOptions {
  return {
    ...baseOptions(),
    httpOnly: true,
    maxAge: env.sessionTtlMs,
  }
}

/** Options for the readable CSRF cookie. */
export function csrfCookieOptions(): CookieOptions {
  return {
    ...baseOptions(),
    httpOnly: false,
    maxAge: env.sessionTtlMs,
  }
}

/** Options used to clear a cookie — the values must match the ones it was set with. */
export function clearCookieOptions(): CookieOptions {
  const options = baseOptions()
  // `maxAge: 0` is what actually expires the cookie; Express also honours an
  // explicit past `expires`.
  options.maxAge = 0
  options.expires = new Date(0)
  return options
}
