import { Router } from 'express'

import { env } from '../config/env.js'
import { login, logout, me, csrfToken, register } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/authenticate.js'
import { csrfProtection } from '../middleware/csrf.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { requireDatabase } from '../middleware/require-database.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../validators/auth.validator.js'

export const authRouter = Router()

/**
 * Limits how often a single address may attempt to sign in.
 *
 * The per-account throttle inside the login flow is the second line of
 * defence; this one protects the server from a broad spray of attempts.
 */
const loginRateLimiter = createRateLimiter({
  name: 'login',
  windowMs: env.rateLimitWindowMs,
  max: env.loginRateLimit,
  keyGenerator: (request) => request.ip ?? 'unknown',
  code: 'LOGIN_RATE_LIMITED',
  message: 'Too many sign-in attempts from this address. Please wait a few minutes and try again.',
})

/** Limits how many accounts a single address may create. */
const registerRateLimiter = createRateLimiter({
  name: 'register',
  windowMs: env.rateLimitWindowMs,
  max: env.registerRateLimit,
  keyGenerator: (request) => request.ip ?? 'unknown',
  code: 'REGISTER_RATE_LIMITED',
  message: 'Too many accounts created from this address. Please try again later.',
})

authRouter.post(
  '/register',
  registerRateLimiter,
  validate(registerSchema, 'body'),
  requireDatabase,
  csrfProtection,
  register,
)

authRouter.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema, 'body'),
  requireDatabase,
  csrfProtection,
  login,
)

authRouter.post('/logout', requireDatabase, csrfProtection, logout)

authRouter.get('/me', requireDatabase, requireAuth, me)

/** Hands the client the CSRF token it has to repeat on every write. */
authRouter.get('/csrf', csrfToken)
