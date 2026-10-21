import { config } from '@/config/env'

import { createHttpClient } from './http'
import { mockApi } from './mock/client'
import type { SpendlyApi } from './types'

export { configureMockApi } from './mock/client'
export { ApiError, createHttpClient } from './http'
export type * from './types'

/**
 * The single data source the UI depends on.
 *
 * It resolves to the mock implementation by default (sample data, no network).
 * Setting `VITE_DATA_SOURCE=api` swaps in the Express client — which reads
 * live transactions, budgets and analytics from MongoDB — without touching a
 * single component.
 */
export const api: SpendlyApi = config.dataSource === 'api' ? createHttpClient(config.apiBaseUrl) : mockApi
