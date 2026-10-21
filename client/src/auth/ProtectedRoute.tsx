import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/AuthContext'
import { BrandMark } from '@/components/layout/BrandMark'

/**
 * The placeholder shown while the app works out whether somebody is signed
 * in. It is deliberately quiet — a full-page spinner on every reload would
 * be noisy.
 */
export function AuthLoadingScreen() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas">
      <div aria-hidden="true" className="ambient-glow pointer-events-none fixed inset-0" />
      <div className="relative flex flex-col items-center gap-4">
        <BrandMark />
        <p className="text-sm text-ink-faint" role="status" aria-live="polite">
          Checking your session…
        </p>
      </div>
    </div>
  )
}

/**
 * Wraps every screen that needs a signed-in account.
 *
 * An anonymous visitor is sent to the sign-in screen, with the page they
 * wanted kept in the navigation state so they land back on it afterwards.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, sessionExpired } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <AuthLoadingScreen />

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
          reason: sessionExpired ? 'expired' : 'required',
        }}
      />
    )
  }

  return <>{children}</>
}

/**
 * Wraps the sign-in and sign-up screens.
 *
 * Someone who is already signed in has no business on these pages, so they
 * are sent back to the dashboard.
 */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <AuthLoadingScreen />

  if (status === 'authenticated') return <Navigate to="/" replace />

  return <>{children}</>
}
