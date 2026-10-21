import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import type { CashflowPoint } from '@/types'

export interface SpendingTrendChartProps {
  data: CashflowPoint[]
  loading?: boolean
  className?: string
}

/**
 * Spending trend over the selected window.
 *
 * The bars are what was spent in each bucket, the line is the running
 * balance at the end of it. Both come from the same aggregation the totals
 * are calculated from, so the chart can never disagree with the cards.
 */
export function SpendingTrendChart({ data, loading, className }: SpendingTrendChartProps) {
  const hasData = data.length > 0

  return (
    <div className={cn('relative', className)}>
      {loading ? (
        <div className="flex h-[240px] flex-col justify-end gap-3">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-line)"
                strokeDasharray="3 3"
                opacity={0.7}
              />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
                minTickGap={24}
                dy={4}
              />

              <YAxis
                yAxisId="spend"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
                tickFormatter={(value: number) => formatCompactCurrency(value)}
                width={56}
              />

              <YAxis yAxisId="balance" hide orientation="right" domain={['auto', 'auto']} />

              <Tooltip
                cursor={{ fill: 'var(--color-surface-3)', fillOpacity: 0.55 }}
                content={(props) => <TrendTooltip {...(props as unknown as TrendTooltipProps)} />}
              />

              <Bar
                yAxisId="spend"
                dataKey="expenses"
                name="Expenses"
                fill="var(--color-negative)"
                fillOpacity={0.75}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                animationDuration={480}
                animationEasing="ease-out"
              />

              <Line
                yAxisId="balance"
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                animationDuration={620}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="flex items-center gap-2 text-xs text-ink-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: 'var(--color-negative)' }}
          />
          Spending
        </li>
        <li className="flex items-center gap-2 text-xs text-ink-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: 'var(--color-brand)' }}
          />
          Running balance
        </li>
      </ul>

      {!loading && !hasData ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint">
          No activity in this window.
        </p>
      ) : null}

      <p className="sr-only">
        Spending trend chart showing expenses per bucket and the running balance.
      </p>
    </div>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: number | string
  dataKey?: string | number
  payload?: CashflowPoint
}

interface TrendTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipEntry[]
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0]?.payload
  const expenses = Number(payload.find((entry) => entry.dataKey === 'expenses')?.value ?? 0)
  const income = point?.income ?? 0

  return (
    <div className="min-w-[184px] rounded-control border border-line-strong bg-surface-2/95 p-3 shadow-pop backdrop-blur">
      <p className="text-[11px] font-medium text-ink-faint">
        {point?.fullLabel ?? String(label ?? '')}
      </p>

      <ul className="mt-2 space-y-1.5">
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: 'var(--color-negative)' }}
            />
            Spent
          </span>
          <span className="text-xs font-medium text-ink tabular">{formatCurrency(expenses)}</span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: 'var(--color-brand)' }}
            />
            Earned
          </span>
          <span className="text-xs font-medium text-ink tabular">{formatCurrency(income)}</span>
        </li>
      </ul>

      {point ? (
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-line pt-2">
          <span className="text-xs text-ink-muted">Balance</span>
          <span className="text-xs font-medium text-ink tabular">
            {formatCurrency(point.balance)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
