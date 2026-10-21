import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { CategorySpend } from '@/types'

export interface CategoryBreakdownProps {
  data: CategorySpend[]
  loading?: boolean
  className?: string
}

/** Donut chart of spend per category with a ranked legend. */
export function CategoryBreakdown({ data, loading, className }: CategoryBreakdownProps) {
  const total = data.reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {loading ? (
        <div className="flex items-center gap-5">
          <Skeleton className="size-[168px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-3.5 w-full" />
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">No spending in this window.</p>
      ) : (
        <>
          <div className="relative mx-auto size-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.categoryId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-ink-faint">Total spend</span>
              <span className="mt-0.5 text-lg font-semibold text-ink tabular">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <ul className="space-y-2.5">
            {data.slice(0, 6).map((entry) => (
              <li key={entry.categoryId} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{entry.name}</span>
                <span className="text-xs font-medium text-ink tabular">
                  {formatCurrency(entry.amount)}
                </span>
                <span className="w-10 shrink-0 text-right text-[11px] text-ink-faint tabular">
                  {formatPercent(entry.share * 100, 0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

interface CategoryTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; payload?: CategorySpend }>
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]
  if (!entry) return null

  const category = entry.payload

  return (
    <div className="rounded-control border border-line-strong bg-surface-2/95 px-3 py-2 shadow-pop backdrop-blur">
      <p className="text-[11px] text-ink-faint">{entry.name ?? category?.name}</p>
      <p className="mt-0.5 text-xs font-medium text-ink tabular">
        {formatCurrency(typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0))}
      </p>
      {category ? (
        <p className="mt-0.5 text-[11px] text-ink-faint tabular">
          {formatPercent(category.share * 100, 1)} of spend
        </p>
      ) : null}
    </div>
  )
}
