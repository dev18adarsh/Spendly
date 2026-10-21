/**
 * Runtime configuration.
 *
 * `VITE_DATA_SOURCE` selects where the UI reads from:
 *   - `mock` (default) → sample data in `src/data/mock`
 *   - `api`            → the Express API (see `src/services/http.ts`)
 *
 * No value is persisted anywhere; switching the source only changes where the
 * read-only sample data comes from.
 */
export type DataSource = 'mock' | 'api'

const rawSource = import.meta.env.VITE_DATA_SOURCE

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  dataSource: (rawSource === 'api' ? 'api' : 'mock') as DataSource,
} as const
