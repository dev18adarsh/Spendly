/**
 * CSRF token handling for the browser client.
 *
 * The API protects every state-changing request with a *double-submit*
 * token: a readable cookie (`spendly_csrf`) whose value the client repeats
 * in the `X-CSRF-Token` header. A cross-site attacker can make the browser
 * send the cookie, but it cannot read the value, so it cannot forge the
 * header.
 *
 * The token is not a secret and is never written to `localStorage` — it lives
 * in a cookie the browser manages.
 */

const CSRF_COOKIE = 'spendly_csrf'

/** Header the token is repeated in. */
export const CSRF_HEADER = 'X-CSRF-Token'

let cachedToken: string | null = null

/** Reads a cookie the browser exposes to scripts. */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null

  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.split('=')
    if (key?.trim() === name) {
      return decodeURIComponent(rest.join('='))
    }
  }

  return null
}

/** The token to send with the next write, if it is already known. */
export function currentCsrfToken(): string | null {
  if (cachedToken) return cachedToken

  const fromCookie = readCookie(CSRF_COOKIE)
  if (fromCookie) {
    cachedToken = fromCookie
    return cachedToken
  }

  return null
}

/** Remembers a token that was fetched from the API. */
export function rememberCsrfToken(token: string): void {
  cachedToken = token || null
}

/** Drops the cached token — used when a request was rejected because of it. */
export function forgetCsrfToken(): void {
  cachedToken = null
}
