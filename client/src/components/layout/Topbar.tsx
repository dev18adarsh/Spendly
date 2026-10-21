import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, Plus, Search } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { useTransactionComposer } from '@/components/transactions/TransactionComposer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'
import { initialsOf } from '@/lib/user'

import { navigation } from './navigation'

/** Sticky application header with search, actions and the mobile drawer trigger. */
export function Topbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const composer = useTransactionComposer()

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

  /** The header search hands the term over to the transaction list. */
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = search.trim()
    navigate(term ? `/transactions?search=${encodeURIComponent(term)}` : '/transactions')
  }

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

          <form
            className="relative ml-auto hidden w-full max-w-xs md:block lg:ml-auto"
            onSubmit={handleSearch}
            role="search"
          >
            <label htmlFor="global-search" className="sr-only">
              Search transactions
            </label>
            <Input
              id="global-search"
              type="search"
              placeholder="Search transactions…"
              className="h-9 pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              icon={<Search className="size-4" aria-hidden="true" />}
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Search"
              onClick={() => navigate('/transactions')}
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
              onClick={() => composer.open()}
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
