import { useState, type FormEvent } from 'react'
import { AlertCircle, LogIn } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/services'

/** Where to go after a successful sign-in. */
interface LoginLocationState {
  from?: string
  reason?: string
}

/**
 * The sign-in screen.
 *
 * The API decides whether the credentials are acceptable; this form only
 * checks that both fields were filled in and then shows whatever the server
 * said.
 */
export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const state = (location.state ?? {}) as LoginLocationState
  const expired = state.reason === 'expired'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email address and password to continue.')
      return
    }

    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
      navigate(state.from ?? '/', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while signing in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Spendly?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-soft">
            Create an account
          </Link>
        </>
      }
    >
      {expired ? (
        <div
          role="status"
          className="mb-5 flex gap-3 rounded-control border border-warning/25 bg-warning/10 p-3.5 text-sm text-warning"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            Your session has expired. Sign in again to continue where you left off.
          </p>
        </div>
      ) : null}

      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          block
          className="mt-1"
          icon={submitting ? undefined : <LogIn className="size-4" aria-hidden="true" />}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
