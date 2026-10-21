import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { ApiError } from '../utils/api-error.js'

export interface RateLimitOptions {
  /** Length of the window in milliseconds. */
  windowMs: number
  /** Requests allowed per key within the window. */
  max: number
  /** Identifies the bucket a request belongs to. */
  keyGenerator: (request: Request) => string
  /** Stable error code returned when the limit is hit. */
  code: string
  /** Message returned when the limit is hit. */
  message: string
  /** Name of the bucket, used in log messages. */
  name: string
}

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Buckets are kept in memory.
 *
 * That is deliberate and honest: the limiter protects a single instance,
 * which is what a single-node deployment needs. Behind a load balancer the
 * limit has to move into shared storage (Redis) to be exact — the counter
 * here is not a substitute for that.
 */
const buckets = new Map<string, Bucket>()

/** Removes buckets whose window has passed. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

let lastSweep = 0

function sweepIfDue(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  sweep(now)
}

/**
 * A fixed-window rate limiter.
 *
 * Exceeding the limit answers with `429 Too Many Requests` and a
 * `Retry-After` header telling the client how long to wait.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now()
    sweepIfDue(now)

    const key = `${options.name}:${options.keyGenerator(request)}`
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    if (bucket.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      response.setHeader('Retry-After', String(retryAfterSeconds))
      next(
        new ApiError(
          429,
          options.code,
          options.message,
          { retryAfterSeconds },
        ),
      )
      return
    }

    bucket.count += 1
    next()
  }
}

/** Clears every bucket. Used by the test suite. */
export function resetRateLimits(): void {
  buckets.clear()
}
