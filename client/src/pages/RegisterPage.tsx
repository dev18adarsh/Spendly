import { useState, type FormEvent } from 'react'
import { AlertCircle, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthContext'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/services'

/**
 * The registration screen.
 *
 * The password rules are spelled out up front so nobody has to guess why a
 * password was refused; the API enforces the same rules.
 */
export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim() || !password) {
      setError('Fill in every field to create your account.')
      return
    }

    if (password.length < 8) {
      setError('Passwords must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      await signUp({ name: name.trim(), email: email.trim(), password })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while creating your account. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking your spending in a couple of minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:text-brand-soft">
            Sign in
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Alex Doe"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Use at least 8 characters, including a letter and a number."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Type it once more"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
          icon={submitting ? undefined : <UserPlus className="size-4" aria-hidden="true" />}
        >
          {submitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
