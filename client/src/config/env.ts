/**
 * Runtime configuration.
 *
 * `VITE_DATA_SOURCE` selects where the UI reads from:
 *   - `mock` (default) → sample data in `src/data/mock`
 *   - `api`            → the Express API (see `src/services/http.ts`)
 *
 * Only these two public values are exposed to the browser — database
 * credentials and other secrets stay on the server.
 */
export type DataSource = 'mock' | 'api'

const rawSource = import.meta.env.VITE_DATA_SOURCE

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  dataSource: (rawSource === 'api' ? 'api' : 'mock') as DataSource,
} as const
