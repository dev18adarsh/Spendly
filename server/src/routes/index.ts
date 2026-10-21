import { Router } from 'express'

import { analyticsRouter } from './analytics.routes.js'
import { budgetRouter } from './budget.routes.js'
import { categoryRouter } from './category.routes.js'
import { healthRouter } from './health.routes.js'
import { transactionRouter } from './transaction.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/transactions', transactionRouter)
apiRouter.use('/budgets', budgetRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/analytics', analyticsRouter)
