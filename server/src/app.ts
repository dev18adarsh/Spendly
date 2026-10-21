import cors from 'cors'
import express, { type Express } from 'express'

import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { apiRouter } from './routes/index.js'

/**
 * Builds the Express application.
 * Kept separate from the server bootstrap so it can be mounted in tests.
 */
export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/', (_request, response) => {
    response.json({
      name: 'Spendly API',
      version: '0.1.0',
      docs: '/api/health',
    })
  })

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
