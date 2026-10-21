import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatSignedPercent } from '@/lib/format'
import type { MetricChange } from '@/types'

export type StatCardTone = 'brand' | 'positive' | 'negative' | 'neutral'

const toneStyles: Record<StatCardTone, { chip: string; icon: string }> = {
  brand: {
    chip: 'bg-brand/12 text-brand ring-brand/20',
    icon: 'text-brand',
  },
  positive: {
    chip: 'bg-positive/12 text-positive ring-positive/20',
    icon: 'text-positive',
  },
  negative: {
    chip: 'bg-negative/12 text-negative ring-negative/20',
    icon: 'text-negative',
  },
  neutral: {
    chip: 'bg-surface-3 text-ink-muted ring-line',
    icon: 'text-ink-muted',
  },
}

export interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: StatCardTone
  /** Period-over-period movement. */
  change?: MetricChange
  /** Supporting copy under the value. */
  hint?: string
  loading?: boolean
  className?: string
}

/** Compact metric tile used across the dashboard header row. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  change,
  hint,
  loading,
  className,
}: StatCardProps) {
  const styles = toneStyles[tone]

  return (
    <div
      className={cn(
        'group rounded-card border border-line bg-surface p-4 transition-[border-color,transform,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elevated',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-ink-faint">{label}</span>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-[9px] ring-1',
            styles.chip,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-ink tabular">{value}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {change ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium tabular',
                  change.isPositive ? 'text-positive' : 'text-negative',
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
            {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
          </div>
        </>
      )}
    </div>
  )
}
