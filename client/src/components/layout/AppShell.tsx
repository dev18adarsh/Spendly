import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { TransactionComposerProvider } from '@/components/transactions/TransactionComposer'

/**
 * Application chrome: fixed navigation rail on desktop, drawer + sticky
 * header on smaller viewports.
 */
export function AppShell() {
  return (
    <TransactionComposerProvider>
      <div className="relative min-h-dvh bg-canvas">
        <div aria-hidden="true" className="ambient-glow pointer-events-none fixed inset-0" />

        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:border focus:border-line-strong focus:bg-surface-3 focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>

        <Sidebar />

        <div className="relative lg:pl-[264px]">
          <Topbar />

          <main
            id="main-content"
            className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </TransactionComposerProvider>
  )
}
