import { ArrowDownRight, ArrowUpRight, Landmark, TrendingUp, Wallet } from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency, formatSignedPercent } from '@/lib/format'
import type { MetricChange } from '@/types'

export interface BalanceCardProps {
  balance: number
  change?: MetricChange
  /** Recent balance values used for the trend line. */
  series?: number[]
  loading?: boolean
}

const accounts = [
  { id: 'checking', label: 'Everyday checking', value: 12480.62, icon: Wallet },
  { id: 'savings', label: 'High-yield savings', value: 9230.8, icon: Landmark },
]

/** Hero card showing the headline balance and the accounts behind it. */
export function BalanceCard({ balance, change, series = [], loading }: BalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-faint">Total balance</p>

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
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-[8px] bg-surface-3 text-ink-faint">
                <account.icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-ink-faint">{account.label}</p>
                <p className="text-xs font-medium text-ink tabular">
                  {formatCurrency(account.value)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <TrendingUp className="size-3" aria-hidden="true" />
          Sample balance — connect an account to see live figures.
        </p>
      </div>
    </div>
  )
}
