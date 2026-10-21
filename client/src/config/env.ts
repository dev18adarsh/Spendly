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
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL

function resolveSocketUrl(): string | undefined {
  if (rawSocketUrl && typeof rawSocketUrl === 'string') return rawSocketUrl
  if (rawApiBaseUrl.startsWith('http://') || rawApiBaseUrl.startsWith('https://')) {
    try {
      return new URL(rawApiBaseUrl).origin
    } catch {
      // fall back to default
    }
  }
  return undefined
}

export const config = {
  apiBaseUrl: rawApiBaseUrl,
  socketUrl: resolveSocketUrl(),
  dataSource: (rawSource === 'api' ? 'api' : 'mock') as DataSource,
} as const
