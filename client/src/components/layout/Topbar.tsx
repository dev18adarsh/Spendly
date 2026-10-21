import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Info, Menu, Plus, Search } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { cn } from '@/lib/cn'
import { initialsOf } from '@/lib/user'

import { navigation } from './navigation'

/** Sticky application header with search, actions and the mobile drawer trigger. */
export function Topbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  useLockBodyScroll(drawerOpen)

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  const activeItem = navigation.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
  )

  return (
    <>
      <header className="glass-panel sticky top-0 z-20 border-b border-line">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="rounded-control p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-ink">{activeItem?.label ?? 'Spendly'}</p>
            <p className="truncate text-xs text-ink-faint">{activeItem?.description}</p>
          </div>

          <div className="relative ml-auto hidden w-full max-w-xs md:block lg:ml-auto">
            <label htmlFor="global-search" className="sr-only">
              Search transactions
            </label>
            <Input
              id="global-search"
              type="search"
              placeholder="Search transactions…"
              className="h-9 pl-9"
              icon={<Search className="size-4" aria-hidden="true" />}
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Search"
              icon={<Search className="size-4" aria-hidden="true" />}
            />

            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications, 3 unread"
              className="relative"
              icon={<Bell className="size-4" aria-hidden="true" />}
            >
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 size-1.5 rounded-full bg-brand ring-2 ring-surface"
              />
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="ml-1"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setComposerOpen(true)}
            >
              <span className="hidden sm:inline">New transaction</span>
              <span className="sm:hidden">New</span>
            </Button>

            <Link
              to="/settings"
              aria-label="Open profile settings"
              className="ml-1 hidden size-8 items-center justify-center rounded-full border border-line bg-surface-3 text-[11px] font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:flex"
            >
              {user ? initialsOf(user.name) : 'SP'}
            </Link>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <TransactionComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </>
  )
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-[286px] max-w-[85vw] border-r border-line bg-surface shadow-pop animate-drawer-in"
      >
        <Sidebar variant="drawer" onNavigate={onClose} />
      </div>
    </div>
  )
}

interface TransactionComposerProps {
  open: boolean
  onClose: () => void
}

const categoryOptions = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'transport', label: 'Transport' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'housing', label: 'Housing' },
  { value: 'health', label: 'Health' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'subscriptions', label: 'Subscriptions' },
]

/**
 * Placeholder composer. The form is intentionally inert — the sample data
 * source is read-only, so the modal explains that nothing is persisted yet.
 */
function TransactionComposer({ open, onClose }: TransactionComposerProps) {
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) setSubmitted(false)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New transaction"
      description="Capture a spend and categorise it."
      footer={
        submitted ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="transaction-form">
              Save transaction
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div
          role="status"
          className={cn(
            'flex gap-3 rounded-control border border-info/25 bg-info/10 p-3.5 text-sm text-info',
          )}
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            This preview build reads from sample data only — nothing was saved. Once the API is
            connected this form will post a real transaction.
          </p>
        </div>
      ) : (
        <form
          id="transaction-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <Input label="Merchant" placeholder="e.g. Blue Bottle Coffee" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
            <Select label="Category" options={categoryOptions} placeholder="Choose a category" required />
          </div>
          <Input label="Date" type="date" required />
          <Input label="Note" placeholder="Optional" />
        </form>
      )}
    </Modal>
  )
}
