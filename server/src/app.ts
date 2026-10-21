import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { ensureCsrfCookie } from './middleware/csrf.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { apiRouter } from './routes/index.js'

/**
 * Builds the Express application.
 * Kept separate from the server bootstrap so it can be mounted in tests.
 */
export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(helmet())

  app.use(
    cors({
      // Only the configured frontend origins may call the API from a browser.
      // The list is explicit — `*` is never used, because credentialed
      // requests are not allowed to use a wildcard origin.
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token'],
    }),
  )

  // The session cookie is read by the authentication middleware.
  app.use(cookieParser())

  // Every visitor carries a CSRF token, so signing in never deadlocks on
  // "the client has no token yet".
  app.use(ensureCsrfCookie)

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/', (_request, response) => {
    response.json({
      success: true,
      data: {
        name: 'Spendly API',
        version: '0.3.0',
        environment: env.nodeEnv,
        endpoints: {
          health: '/api/health',
          readiness: '/api/health/ready',
          auth: '/api/auth',
          transactions: '/api/transactions',
          budgets: '/api/budgets',
          categories: '/api/categories',
          analytics: '/api/analytics/summary',
        },
      },
    })
  })

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
