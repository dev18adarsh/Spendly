import { createContext, useContext } from 'react'

import type { AuthUser } from '@/services/types'

/**
 * Where the app is with respect to authentication.
 *
 * `loading` covers the first check for an existing session, `authenticated`
 * means there is a signed-in account, and `anonymous` means there is not.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  /** The signed-in account, or `null` when nobody is signed in. */
  user: AuthUser | null
  status: AuthStatus
  /**
   * `true` when the session ended on its own — the cookie expired or was
   * revoked — rather than the visitor simply never having signed in.
   */
  sessionExpired: boolean
  /** Signs in with an email address and password. */
  signIn: (email: string, password: string) => Promise<void>
  /** Creates an account and signs in. */
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>
  /** Ends the session. */
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** The authentication state and the actions that change it. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.')
  }
  return context
}
