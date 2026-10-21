import { AlertCircle } from 'lucide-react'

import { ErrorState } from '@/components/ui/ErrorState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import type { Budget } from '@/types'

export interface BudgetOverviewProps {
  budgets: Budget[]
  loading?: boolean
  /** Shown instead of the list when the request failed. */
  error?: Error
  /** Called when the user asks to try again. */
  onRetry?: () => void
  /** How many budgets to display. */
  limit?: number
  className?: string
}

/** Compact list of the most relevant monthly budgets. */
export function BudgetOverview({
  budgets,
  loading,
  error,
  onRetry,
  limit = 5,
  className,
}: BudgetOverviewProps) {
  const visible = budgets.slice(0, limit)

  return (
    <div className={cn('space-y-4', className)}>
      {loading ? (
        Array.from({ length: limit }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))
      ) : error ? (
        <ErrorState
          title="Could not load budgets"
          description={error.message}
          onRetry={onRetry}
          className="px-0 py-8"
        />
      ) : (
        visible.map((budget) => {
          const ratio = budget.limit > 0 ? budget.spent / budget.limit : 0
          const overBudget = ratio > 1
          const nearLimit = !overBudget && ratio >= 0.85

          const tone = overBudget ? 'negative' : nearLimit ? 'warning' : 'positive'

          return (
            <div key={budget.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
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
                  <span className={cn('font-medium', overBudget ? 'text-negative' : 'text-ink-muted')}>
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
        })
      )}
    </div>
  )
}
