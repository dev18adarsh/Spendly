import { useCallback, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { BalanceCard } from '@/components/dashboard/BalanceCard'
import { BudgetOverview } from '@/components/dashboard/BudgetOverview'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { SpendingTrendChart } from '@/components/dashboard/SpendingTrendChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { useTransactionComposer } from '@/components/transactions/TransactionComposer'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatCurrency, formatPercent, formatPeriodRange } from '@/lib/format'
import {
  DATE_RANGES,
  DEFAULT_INTERVAL,
  INTERVALS,
  INTERVALS_BY_RANGE,
  type DateRangeKey,
  type IntervalKey,
} from '@/services/types'
import type { Transaction } from '@/types'

const rangeOptions = DATE_RANGES.map((range) => ({
  value: range.key,
  label: range.shortLabel,
  title: range.label,
}))

export function DashboardPage() {
  const [range, setRange] = useState<DateRangeKey>('30d')
  const [intervalKey, setIntervalKey] = useState<IntervalKey>(DEFAULT_INTERVAL['30d'])
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  const composer = useTransactionComposer()
  const { summary, cashflow, breakdown, transactions, budgets, categories, balanceSeries } =
    useDashboardData(range, intervalKey)

  /**
   * Switches the reporting window.
   *
   * The window changes shape, so the chosen bucket size may no longer fit it
   * — a three year window cannot be read per day. When that happens the
   * selector falls back to the bucket size the window was designed for.
   */
  const changeRange = useCallback((next: DateRangeKey) => {
    setRange(next)
    setIntervalKey((current) =>
      INTERVALS_BY_RANGE[next].includes(current) ? current : DEFAULT_INTERVAL[next],
    )
  }, [])

  const rangeLabel = DATE_RANGES.find((option) => option.key === range)?.label ?? 'Last 30 days'
  const period = summary.data?.period
  const periodLabel = period?.label ?? rangeLabel
  const periodRange = period ? formatPeriodRange(period.from, period.to) : ''

  const intervalOptions = useMemo(
    () =>
      INTERVALS.filter((option) => INTERVALS_BY_RANGE[range].includes(option.key)).map(
        (option) => ({ value: option.key, label: option.label, title: option.title }),
      ),
    [range],
  )

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A calm view of your money, updated as you spend."
        actions={
          <SegmentedControl
            options={rangeOptions}
            value={range}
            onChange={changeRange}
            ariaLabel="Reporting period"
          />
        }
      />

      {/* The exact window every figure below is calculated over. */}
      <p className="-mt-3 mb-4 text-xs text-ink-faint">
        Reporting period:{' '}
        <span className="font-medium text-ink-muted">{periodLabel}</span>
        {periodRange ? (
          <>
            {' · '}
            <time dateTime={period?.from}>{periodRange}</time>
          </>
        ) : null}
        {period ? (
          <>
            {' · '}
            {period.days} {period.days === 1 ? 'day' : 'days'} in {period.timeZone}
          </>
        ) : null}
      </p>

      {/*
        A failed request must never be dressed up as real numbers, so the
        metrics are hidden entirely and the error explains what happened.
      */}
      {summary.isError ? (
        <Card className="mb-6">
          <ErrorState
            title="Could not load your dashboard"
            description={summary.error?.message}
            onRetry={summary.refetch}
          />
        </Card>
      ) : null}

      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total balance"
          value={formatCurrency(summary.data?.balance ?? 0)}
          icon={Wallet}
          tone="brand"
          change={summary.data?.changes.net}
          hint={periodLabel.toLowerCase()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Income"
          value={formatCurrency(summary.data?.income ?? 0)}
          icon={ArrowUpRight}
          tone="positive"
          change={summary.data?.changes.income}
          hint={periodLabel.toLowerCase()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(summary.data?.expenses ?? 0)}
          icon={ArrowDownRight}
          tone="negative"
          change={summary.data?.changes.expenses}
          hint={periodLabel.toLowerCase()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Savings rate"
          value={formatPercent(summary.data?.savingsRate ?? 0)}
          icon={PiggyBank}
          tone="neutral"
          change={summary.data?.changes.savingsRate}
          hint="of income retained"
          loading={summary.isLoading}
        />
      </section>

      <section
        aria-label="Balance and cashflow"
        className="mt-3 grid gap-3 lg:grid-cols-3"
      >
        <BalanceCard
          balance={summary.data?.allTimeBalance ?? 0}
          change={summary.data?.changes.balance}
          income={summary.data?.income ?? 0}
          expenses={summary.data?.expenses ?? 0}
          periodLabel={periodLabel}
          series={balanceSeries}
          loading={summary.isLoading}
        />

        <Card className="lg:col-span-2">
          <CardHeader
            title="Cashflow"
            description={`Income and expenses · ${periodLabel.toLowerCase()}`}
          />
          <div className="px-5 pb-5">
            {cashflow.isError ? (
              <ErrorState
                title="Could not load the cashflow"
                description={cashflow.error?.message}
                onRetry={cashflow.refetch}
              />
            ) : (
              <SpendingChart data={cashflow.data ?? []} loading={cashflow.isLoading} />
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Spending trend" className="mt-3">
        <Card>
          <CardHeader
            title="Spending trend"
            description={`How spending moved across ${periodLabel.toLowerCase()}.`}
            actions={
              intervalOptions.length > 1 ? (
                <SegmentedControl
                  options={intervalOptions}
                  value={intervalKey}
                  onChange={setIntervalKey}
                  ariaLabel="Trend granularity"
                />
              ) : null
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
              <SpendingTrendChart data={cashflow.data ?? []} loading={cashflow.isLoading} />
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Activity and insights" className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions
            transactions={transactions.data ?? []}
            categories={categories.byId}
            loading={transactions.isLoading}
            error={transactions.error}
            onRetry={transactions.refetch}
            onEdit={(transaction) => composer.open(transaction)}
            onDelete={setPendingDelete}
          />
        </div>

        <div className="grid gap-3">
          <Card>
            <CardHeader title="Spend by category" description={periodLabel} />
            <div className="px-5 pb-5">
              <CategoryBreakdown
                data={breakdown.data ?? []}
                loading={breakdown.isLoading}
                error={breakdown.error}
                onRetry={breakdown.refetch}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Budget progress" description="This month" />
            <div className="px-5 pb-5">
              <BudgetOverview
                budgets={budgets.data ?? []}
                loading={budgets.isLoading}
                error={budgets.error}
                onRetry={budgets.refetch}
              />
            </div>
          </Card>
        </div>
      </section>

      <DeleteTransactionDialog
        transaction={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}
