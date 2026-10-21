import { Router } from 'express'

import { listCategories } from '../controllers/category.controller.js'
import { requireDatabase } from '../middleware/require-database.js'

export const categoryRouter = Router()

categoryRouter.get('/', requireDatabase, listCategories)
