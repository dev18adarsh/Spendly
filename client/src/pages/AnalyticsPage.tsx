import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Flame, Receipt, TrendingUp } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatCurrency, formatPercent } from '@/lib/format'
import { api } from '@/services'
import { DATE_RANGES, DEFAULT_INTERVAL, INTERVALS, type DateRangeKey } from '@/services/types'

const rangeOptions = DATE_RANGES.map((range) => ({
  value: range.key,
  label: range.shortLabel,
  title: range.label,
}))

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeKey>('12m')

  // The window's own default granularity keeps the insights honest: a month
  // is a meaningful unit for a year, a day for a week.
  const interval = DEFAULT_INTERVAL[range]
  const intervalLabel =
    INTERVALS.find((option) => option.key === interval)?.label.toLowerCase() ?? 'period'

  const cashflow = useAsyncData((signal) => api.getCashflow(range, interval, signal), [range])
  const breakdown = useAsyncData((signal) => api.getCategoryBreakdown(range, signal), [range])
  const summary = useAsyncData((signal) => api.getSummary(range, signal), [range])
  const merchants = useAsyncData(
    (signal) => api.getTopMerchants(range, 6, signal),
    [range],
  )

  const insights = useMemo(() => {
    const points = cashflow.data ?? []
    const categories = breakdown.data ?? []

    const averageSpend =
      points.length > 0 ? points.reduce((sum, point) => sum + point.expenses, 0) / points.length : 0

    const peak = points.reduce<(typeof points)[number] | null>(
      (best, point) => (best === null || point.expenses > best.expenses ? point : best),
      null,
    )

    const topCategory = categories[0]

    return {
      averageSpend,
      peakLabel: peak?.fullLabel ?? peak?.label ?? '—',
      peakAmount: peak?.expenses ?? 0,
      topCategoryName: topCategory?.name ?? '—',
      topCategoryAmount: topCategory?.amount ?? 0,
    }
  }, [cashflow.data, breakdown.data])

  const merchantList = merchants.data ?? []
  const period = summary.data?.period

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Patterns behind your spending, drawn from your transactions."
        actions={
          <SegmentedControl
            options={rangeOptions}
            value={range}
            onChange={setRange}
            ariaLabel="Reporting period"
          />
        }
      />

      <section aria-label="Analytics highlights" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average spend"
          value={formatCurrency(insights.averageSpend)}
          icon={TrendingUp}
          tone="neutral"
          hint={`per ${intervalLabel}`}
          loading={cashflow.isLoading}
        />
        <StatCard
          label="Peak period"
          value={insights.peakLabel}
          icon={Flame}
          tone="negative"
          hint={`${formatCurrency(insights.peakAmount)} spent`}
          loading={cashflow.isLoading}
        />
        <StatCard
          label="Top category"
          value={insights.topCategoryName}
          icon={Receipt}
          tone="brand"
          hint={`${formatCurrency(insights.topCategoryAmount)} spent`}
          loading={breakdown.isLoading}
        />
        <StatCard
          label="Net savings"
          value={formatCurrency(summary.data?.balance ?? 0)}
          icon={(summary.data?.balance ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={(summary.data?.balance ?? 0) >= 0 ? 'positive' : 'negative'}
          hint={`${formatPercent(summary.data?.savingsRate ?? 0)} of income`}
          loading={summary.isLoading}
        />
      </section>

      <section aria-label="Cashflow trend" className="mt-3">
        <Card>
          <CardHeader
            title="Cashflow trend"
            description={
              period
                ? `Income against expenses · ${period.label.toLowerCase()}.`
                : 'Income against expenses across the selected window.'
            }
          />
          <div className="px-5 pb-5">
            {cashflow.isError ? (
              <ErrorState
                title="Could not load the trend"
                description={cashflow.error?.message}
                onRetry={cashflow.refetch}
              />
            ) : (
              <SpendingChart data={cashflow.data ?? []} loading={cashflow.isLoading} />
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Breakdown" className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Spend by category" description="Share of total spend" />
          <div className="px-5 pb-5">
            <CategoryBreakdown data={breakdown.data ?? []} loading={breakdown.isLoading} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Top merchants" description="Where the most money went" />
          <div className="px-5 pb-5">
            {merchants.isError ? (
              <ErrorState
                title="Could not load merchants"
                description={merchants.error?.message}
                onRetry={merchants.refetch}
              />
            ) : merchants.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : merchantList.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">No merchant activity yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {merchantList.map((merchant) => (
                  <li key={merchant.id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${merchant.color} 16%, transparent)`,
                        color: merchant.color,
                      }}
                    >
                      {merchant.name.slice(0, 1).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{merchant.name}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {merchant.category} · {merchant.count}{' '}
                        {merchant.count === 1 ? 'payment' : 'payments'}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-medium text-ink tabular">
                      {formatCurrency(merchant.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>
    </>
  )
}
