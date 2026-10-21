import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/layout/BrandMark'

export interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  /** Links rendered under the form, e.g. "no account yet?". */
  footer?: ReactNode
}

/**
 * The shell around the sign-in and sign-up screens.
 *
 * It uses the same surfaces, spacing and typography as the rest of the app,
 * but drops the navigation rail — there is nothing to navigate to before
 * somebody is signed in.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <div aria-hidden="true" className="ambient-glow pointer-events-none fixed inset-0" />

      <div className="relative w-full max-w-[420px]">
        <div className="flex justify-center">
          <Link to="/" aria-label="Spendly home" className="rounded-control">
            <BrandMark />
          </Link>
        </div>

        <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="text-sm leading-relaxed text-ink-faint">{subtitle}</p>
          </div>

          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-ink-faint">{footer}</div> : null}
      </div>
    </div>
  )
}
