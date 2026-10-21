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
 * Today it resolves to the mock implementation (sample data, no network, no
 * persistence). Setting `VITE_DATA_SOURCE=api` swaps in the Express client
 * without touching a single component.
 */
export const api: SpendlyApi = config.dataSource === 'api' ? createHttpClient(config.apiBaseUrl) : mockApi
