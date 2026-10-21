import { Router } from 'express'

import { analyticsRouter } from './analytics.routes.js'
import { authRouter } from './auth.routes.js'
import { budgetRouter } from './budget.routes.js'
import { categoryRouter } from './category.routes.js'
import { healthRouter } from './health.routes.js'
import { transactionRouter } from './transaction.routes.js'

export const apiRouter = Router()

/** Public — probes and the category taxonomy contain no user data. */
apiRouter.use('/health', healthRouter)
apiRouter.use('/categories', categoryRouter)

/** Public entry points that establish or end a session. */
apiRouter.use('/auth', authRouter)

/** Private — every route below requires a valid session cookie. */
apiRouter.use('/transactions', transactionRouter)
apiRouter.use('/budgets', budgetRouter)
apiRouter.use('/analytics', analyticsRouter)
