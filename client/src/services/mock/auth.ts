import type { AuthApi, AuthUser } from '@/services/types'

/**
 * Mock authentication for the sample-data build.
 *
 * With `VITE_DATA_SOURCE=mock` the app runs against bundled sample data and
 * never talks to a server. There is no account to create, so the demo
 * identity is handed out straight away and signing out is a no-op.
 */

export const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'alex@example.com',
  name: 'Alex Doe',
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const mockAuthApi: AuthApi = {
  async register() {
    return DEMO_USER
  },
  async login() {
    return DEMO_USER
  },
  async logout() {
    // Nothing to revoke — the demo build has no server-side session.
  },
  async me() {
    return DEMO_USER
  },
}
