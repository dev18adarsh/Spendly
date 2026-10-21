import { env } from '../config/env.js'
import { ApiError } from '../utils/api-error.js'

/**
 * Per-account login throttling.
 *
 * The IP-based limiter in `middleware/rate-limit.ts` protects the server as a
 * whole. This one protects a single account: after a number of *failed*
 * sign-in attempts the account is locked for a while.
 *
 * Only failures count. A successful sign-in clears the counter, so a shared
 * address (an office, a mobile carrier) cannot lock a legitimate user out —
 * and a wrong password can never lock a victim out permanently.
 */
interface AttemptState {
  failures: number
  firstFailureAt: number
  blockedUntil: number
}

const attempts = new Map<string, AttemptState>()

/** Normalises the key so casing and padding do not create separate buckets. */
function keyFor(email: string): string {
  return email.trim().toLowerCase()
}

/** Records a failed sign-in and returns the new failure count. */
export function recordFailedLogin(email: string): number {
  const key = keyFor(email)
  const now = Date.now()
  const state = attempts.get(key)

  if (!state || now - state.firstFailureAt > env.loginAttemptWindowMs) {
    attempts.set(key, { failures: 1, firstFailureAt: now, blockedUntil: 0 })
    return 1
  }

  state.failures += 1

  if (state.failures >= env.loginAttemptLimit) {
    state.blockedUntil = now + env.loginAttemptWindowMs
  }

  return state.failures
}

/** Clears the failure counter after a successful sign-in. */
export function clearFailedLogins(email: string): void {
  attempts.delete(keyFor(email))
}

/** True while the account is locked out. */
export function isLoginBlocked(email: string): boolean {
  const state = attempts.get(keyFor(email))
  if (!state) return false
  if (state.blockedUntil <= Date.now()) return false
  return true
}

/** Seconds the caller has to wait before trying again. */
export function loginRetryAfterSeconds(email: string): number {
  const state = attempts.get(keyFor(email))
  if (!state) return 0
  return Math.max(1, Math.ceil((state.blockedUntil - Date.now()) / 1000))
}

/**
 * Throws a `429` when the account is temporarily locked.
 *
 * The message deliberately does not say whether the account exists.
 */
export function assertLoginAllowed(email: string): void {
  if (!isLoginBlocked(email)) return

  throw new ApiError(
    429,
    'LOGIN_RATE_LIMITED',
    'Too many failed sign-in attempts for this account. Please wait a few minutes and try again.',
    { retryAfterSeconds: loginRetryAfterSeconds(email) },
  )
}

/** Clears every counter. Used by the test suite. */
export function resetLoginThrottle(): void {
  attempts.clear()
}
