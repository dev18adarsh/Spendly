import { AlertCircle, ArrowRight, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { Budget, OverallBudget } from '@/types'

export interface BudgetOverviewProps {
  budgets: Budget[]
  overallBudget?: OverallBudget | null
  loading?: boolean
  /** Shown instead of the list when the request failed. */
  error?: Error
  /** Called when the user asks to try again. */
  onRetry?: () => void
  /** How many category budgets to display. */
  limit?: number
  className?: string
}

/** Comprehensive summary card of monthly budgets for the dashboard. */
export function BudgetOverview({
  budgets,
  overallBudget,
  loading,
  error,
  onRetry,
  limit = 4,
  className,
}: BudgetOverviewProps) {
  const visible = budgets.slice(0, limit)
  const hasOverall = Boolean(overallBudget)
  const hasCategories = budgets.length > 0

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="space-y-2 rounded-control bg-surface-2/40 p-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-3 pt-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load budgets"
        description={error.message}
        onRetry={onRetry}
        className="px-0 py-8"
      />
    )
  }

  if (!hasOverall && !hasCategories) {
    return (
      <EmptyState
        icon={<Wallet className="size-5" aria-hidden="true" />}
        title="No budgets set"
        description="Set a monthly spending budget to track how far you stretch your money."
        action={
          <Button variant="secondary" size="sm" to="/budgets">
            Create a budget
          </Button>
        }
        className="py-6"
      />
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {overallBudget ? (
        <div className="rounded-control border border-line bg-surface-2/40 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">Overall monthly budget</span>
            <Badge
              tone={
                overallBudget.status === 'over'
                  ? 'negative'
                  : overallBudget.status === 'approaching'
                    ? 'warning'
                    : 'positive'
              }
            >
              {overallBudget.status === 'over'
                ? 'Over budget'
                : overallBudget.status === 'approaching'
                  ? 'Approaching limit'
                  : 'On track'}
            </Badge>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'text-base font-semibold tabular',
                overallBudget.status === 'over' ? 'text-negative' : 'text-ink',
              )}
            >
              {formatCurrency(overallBudget.spent)}
            </span>
            <span className="text-xs text-ink-faint tabular">
              of {formatCurrency(overallBudget.limit)}
            </span>
          </div>

          <ProgressBar
            value={overallBudget.spent}
            max={overallBudget.limit}
            tone={
              overallBudget.status === 'over'
                ? 'negative'
                : overallBudget.status === 'approaching'
                  ? 'warning'
                  : 'positive'
            }
            size="sm"
            className="mt-2"
            label="Overall monthly spending"
          />

          <p className="mt-2 text-[11px] text-ink-muted">
            {overallBudget.remaining < 0
              ? `${formatCurrency(Math.abs(overallBudget.remaining))} over limit`
              : `${formatCurrency(overallBudget.remaining)} remaining`}
            {' · '}
            {formatPercent(overallBudget.percentUsed, 0)} used
          </p>
        </div>
      ) : null}

      {hasCategories ? (
        <div className="space-y-3">
          {hasOverall ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide uppercase text-ink-faint">
                Category limits
              </span>
              <Link
                to="/budgets"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                View all <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          {visible.map((budget) => {
            const ratio = budget.limit > 0 ? budget.spent / budget.limit : 0
            const overBudget = budget.status === 'over' || ratio > 1
            const nearLimit = !overBudget && (budget.status === 'approaching' || ratio >= 0.85)
            const tone = overBudget ? 'negative' : nearLimit ? 'warning' : 'positive'

            return (
              <div key={budget.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: budget.color }}
                    />
                    <span className="truncate text-xs font-medium text-ink">{budget.name}</span>
                    {overBudget ? (
                      <AlertCircle
                        className="size-3.5 shrink-0 text-negative"
                        aria-label="Over budget"
                      />
                    ) : null}
                  </span>

                  <span className="shrink-0 text-[11px] text-ink-faint tabular">
                    <span
                      className={cn(
                        'font-medium',
                        overBudget ? 'text-negative' : 'text-ink-muted',
                      )}
                    >
                      {formatCurrency(budget.spent)}
                    </span>
                    {' / '}
                    {formatCurrency(budget.limit)}
                  </span>
                </div>

                <ProgressBar
                  value={budget.spent}
                  max={budget.limit}
                  tone={tone}
                  size="sm"
                  label={`${budget.name} budget`}
                />
              </div>
            )
          })}
        </div>
      ) : (
        hasOverall && (
          <p className="text-xs text-ink-faint">
            No category limits set for this month.{' '}
            <Link to="/budgets" className="text-brand hover:underline">
              Add category limits
            </Link>
          </p>
        )
      )}
    </div>
  )
}

