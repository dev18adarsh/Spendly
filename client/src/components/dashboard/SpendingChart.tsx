import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import type { CashflowPoint } from '@/types'

export interface SpendingChartProps {
  data: CashflowPoint[]
  loading?: boolean
  className?: string
}

const SERIES = [
  { key: 'income', label: 'Income', color: 'var(--color-brand)' },
  { key: 'expenses', label: 'Expenses', color: 'var(--color-negative)' },
] as const

/**
 * Income vs. expenses over the selected window.
 * Income is filled in mint, expenses in rose, both with a soft gradient.
 */
export function SpendingChart({ data, loading, className }: SpendingChartProps) {
  const hasData = data.length > 0

  const gradientIds = useMemo(
    () => ({
      income: 'spendly-gradient-income',
      expenses: 'spendly-gradient-expenses',
    }),
    [],
  )

  return (
    <div className={cn('relative', className)}>
      {loading ? (
        <div className="flex h-[268px] flex-col justify-end gap-3">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      ) : (
        <div className="h-[268px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientIds.income} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={gradientIds.expenses} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-negative)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-negative)" stopOpacity={0} />
                </linearGradient>
              </defs>

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
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }}
                tickFormatter={(value: number) => formatCompactCurrency(value)}
                width={56}
              />

              <Tooltip
                cursor={{ stroke: 'var(--color-line-strong)', strokeWidth: 1 }}
                content={(props) => <CashflowTooltip {...(props as unknown as CashflowTooltipProps)} />}
              />

              {SERIES.map((series) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  fill={`url(#${gradientIds[series.key]})`}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-xs text-ink-muted">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </li>
        ))}
      </ul>

      {!loading && !hasData ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint">
          No activity in this window.
        </p>
      ) : null}

      <p className="sr-only">
        Cashflow chart comparing income and expenses over the selected period.
      </p>
    </div>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: number | string
  dataKey?: string | number
}

interface CashflowTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipEntry[]
}

function CashflowTooltip({ active, payload, label }: CashflowTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="min-w-[168px] rounded-control border border-line-strong bg-surface-2/95 p-3 shadow-pop backdrop-blur">
      <p className="text-[11px] font-medium text-ink-faint">{label}</p>

      <ul className="mt-2 space-y-1.5">
        {payload.map((entry, index) => {
          const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0)
          const isIncome = entry.dataKey === 'income'
          const color = isIncome ? 'var(--color-brand)' : 'var(--color-negative)'

          return (
            <li
              key={`${String(entry.dataKey)}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {entry.name ?? (isIncome ? 'Income' : 'Expenses')}
              </span>
              <span className="text-xs font-medium text-ink tabular">{formatCurrency(value)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
