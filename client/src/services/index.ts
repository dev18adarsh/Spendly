import { config } from '@/config/env'

import { createHttpAuthClient, createHttpClient } from './http'
import { mockAuthApi } from './mock/auth'
import { mockApi } from './mock/client'
import type { AuthApi, SpendlyApi } from './types'

export { configureMockApi } from './mock/client'
export { ApiError, createHttpAuthClient, createHttpClient, SESSION_EXPIRED_EVENT } from './http'
export { DEMO_USER } from './mock/auth'
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

/**
 * The authentication endpoints.
 *
 * The session itself lives in an HTTP-only cookie, so this client never sees
 * or stores a credential.
 */
export const authApi: AuthApi =
  config.dataSource === 'api' ? createHttpAuthClient(config.apiBaseUrl) : mockAuthApi
