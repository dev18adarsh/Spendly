import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency, formatSignedPercent } from '@/lib/format'
import type { MetricChange } from '@/types'

export interface BalanceCardProps {
  /**
   * The balance of the whole ledger — the net of every transaction recorded
   * before the reporting window closed.
   */
  balance: number
  change?: MetricChange
  /** Income of the reporting window. */
  income?: number
  /** Expenses of the reporting window. */
  expenses?: number
  /** The window the income and expenses belong to. */
  periodLabel?: string
  /** Recent balance values used for the trend line. */
  series?: number[]
  loading?: boolean
}

/**
 * Hero card showing the balance of the ledger.
 *
 * Every figure comes from the transactions themselves: the headline is the
 * net of the whole ledger and the two lines below it are the income and the
 * expenses of the selected window.
 */
export function BalanceCard({
  balance,
  change,
  income = 0,
  expenses = 0,
  periodLabel,
  series = [],
  loading,
}: BalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-faint">All-time balance</p>

            {loading ? (
              <Skeleton className="mt-3 h-9 w-48" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular sm:text-4xl">
                {formatCurrency(balance)}
              </p>
            )}
          </div>

          {change ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular',
                change.isPositive
                  ? 'bg-positive/12 text-positive ring-1 ring-positive/20'
                  : 'bg-negative/12 text-negative ring-1 ring-negative/20',
              )}
            >
              {change.value >= 0 ? (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              )}
              {formatSignedPercent(change.value)}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <Sparkline data={series} className="h-16" stroke="var(--color-brand)" />
        </div>

        <div className="mt-4 grid gap-2.5 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <p className="truncate text-[11px] text-ink-faint">Income{periodLabel ? ` · ${periodLabel}` : ''}</p>
            <p className="text-xs font-medium text-ink tabular">{formatCurrency(income)}</p>
          </div>
          <div>
            <p className="truncate text-[11px] text-ink-faint">Expenses{periodLabel ? ` · ${periodLabel}` : ''}</p>
            <p className="text-xs font-medium text-ink tabular">{formatCurrency(expenses)}</p>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <TrendingUp className="size-3" aria-hidden="true" />
          Net of every transaction on record.
        </p>
      </div>
    </div>
  )
}
