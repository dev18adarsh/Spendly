import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, useRouteError, Link } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const TransactionsPage = lazy(() =>
  import('@/pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })),
)
const BudgetsPage = lazy(() =>
  import('@/pages/BudgetsPage').then((module) => ({ default: module.BudgetsPage })),
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)

/** Placeholder rendered while a route chunk is downloading. */
function RouteFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-3 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
      <span className="sr-only">Loading page…</span>
    </div>
  )
}

function withSuspense(node: ReactNode): ReactNode {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>
}

/** Rendered when a route throws while loading. */
function RouteError() {
  const error = useRouteError()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-ink">This page could not be loaded</p>
        <p className="max-w-sm text-sm text-ink-faint">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" to="/">
          Back to dashboard
        </Button>
        <Link
          to="/settings"
          className="text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline"
        >
          Settings
        </Link>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'transactions', element: withSuspense(<TransactionsPage />) },
      { path: 'budgets', element: withSuspense(<BudgetsPage />) },
      { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])
