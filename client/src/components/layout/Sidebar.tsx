import { Database, LogOut, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/layout/BrandMark'
import { NavList } from '@/components/layout/NavList'

export interface SidebarProps {
  /** Rendered inside the mobile drawer instead of the fixed desktop rail. */
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

/**
 * Desktop navigation rail. The same markup is reused by the mobile drawer
 * through the `variant` prop.
 */
export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const isDrawer = variant === 'drawer'

  return (
    <div
      className={isDrawer ? 'flex h-full flex-col' : 'fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-surface lg:flex'}
    >
      <div className="flex h-16 items-center px-5">
        <Link to="/" onClick={onNavigate} className="rounded-md">
          <BrandMark />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Overview
        </p>
        <NavList onNavigate={onNavigate} />

        <div className="mt-6 rounded-card border border-line bg-surface-2 p-3.5">
          <div className="flex items-center gap-2 text-brand">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Preview build</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            You are viewing realistic sample data. Nothing is saved to an account yet.
          </p>
          <Link
            to="/settings"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-brand"
          >
            <Database className="size-3.5" aria-hidden="true" />
            Data source
          </Link>
        </div>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-control px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink-muted">
            AD
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">Alex Doe</p>
            <p className="truncate text-[11px] text-ink-faint">alex@example.com</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
