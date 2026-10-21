import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue, type AuthStatus } from '@/auth/AuthContext'
import { config } from '@/config/env'
import { authApi, DEMO_USER, SESSION_EXPIRED_EVENT } from '@/services'

/**
 * Holds the authentication state for the whole app.
 *
 * The session lives in an HTTP-only cookie, so there is no token to keep in
 * memory or to persist — the app only ever knows *who* is signed in, and
 * asks the API to work that out.
 *
 * Two data sources are supported:
 *   - `api`  — the real thing: the provider asks the API who the caller is
 *   - `mock` — the sample-data build, where the demo identity is handed out
 *     straight away so the preview keeps working without a server
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemo = config.dataSource !== 'api'

  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionExpired, setSessionExpired] = useState(false)

  // Restore the session on first load. The cookie is sent automatically, so
  // this is a single request that answers "is anybody signed in?".
  useEffect(() => {
    const controller = new AbortController()

    authApi
      .me(controller.signal)
      .then((current) => {
        if (controller.signal.aborted) return
        setUser(current)
        setStatus(current ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // The API is unreachable — treat the visitor as anonymous rather than
        // locking the app behind an error screen.
        setUser(null)
        setStatus('anonymous')
      })

    return () => controller.abort()
  }, [])

  // A 401 from anywhere in the app means the session is gone. Sign out so
  // the protected routes send the visitor back to the sign-in screen.
  const userRef = useRef<AuthContextValue['user']>(null)
  userRef.current = user

  useEffect(() => {
    const onExpired = () => {
      // Only an actual session can expire — a 401 while nobody was signed in
      // is just an anonymous request.
      if (userRef.current) setSessionExpired(true)
      setUser(null)
      setStatus('anonymous')
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const account = await authApi.login({ email, password })
    setUser(account)
    setStatus('authenticated')
    setSessionExpired(false)
  }, [])

  const signUp = useCallback(async (input: { name: string; email: string; password: string }) => {
    const account = await authApi.register(input)
    setUser(account)
    setStatus('authenticated')
    setSessionExpired(false)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      if (isDemo) {
        // The demo build has no server-side session to end, but it should
        // still look the way the user expects.
        setUser(DEMO_USER)
        setStatus('authenticated')
        return
      }

      setUser(null)
      setStatus('anonymous')
      setSessionExpired(false)
    }
  }, [isDemo])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionExpired, signIn, signUp, signOut }),
    [user, status, sessionExpired, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
