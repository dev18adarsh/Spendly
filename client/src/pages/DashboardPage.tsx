import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { BalanceCard } from '@/components/dashboard/BalanceCard'
import { BudgetOverview } from '@/components/dashboard/BudgetOverview'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatCurrency, formatPercent } from '@/lib/format'
import { DATE_RANGES, type DateRangeKey } from '@/services/types'

const rangeOptions = DATE_RANGES.map((range) => ({
  value: range.key,
  label: range.shortLabel,
  title: range.label,
}))

export function DashboardPage() {
  const [range, setRange] = useState<DateRangeKey>('30d')
  const { summary, cashflow, breakdown, transactions, budgets, categories, balanceSeries } =
    useDashboardData(range)

  const hasSummaryError = summary.isError
  const rangeLabel = DATE_RANGES.find((option) => option.key === range)?.label ?? 'Last 30 days'

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A calm view of your money, updated as you spend."
        actions={
          <SegmentedControl
            options={rangeOptions}
            value={range}
            onChange={setRange}
            ariaLabel="Reporting period"
          />
        }
      />

      {hasSummaryError ? (
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
          value={formatCurrency(summary.data?.totalBalance ?? 0)}
          icon={Wallet}
          tone="brand"
          change={summary.data?.changes.balance}
          hint="across 2 accounts"
          loading={summary.isLoading}
        />
        <StatCard
          label="Income"
          value={formatCurrency(summary.data?.income ?? 0)}
          icon={ArrowUpRight}
          tone="positive"
          change={summary.data?.changes.income}
          hint={rangeLabel.toLowerCase()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(summary.data?.expenses ?? 0)}
          icon={ArrowDownRight}
          tone="negative"
          change={summary.data?.changes.expenses}
          hint={rangeLabel.toLowerCase()}
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
          balance={summary.data?.totalBalance ?? 0}
          change={summary.data?.changes.balance}
          series={balanceSeries}
          loading={summary.isLoading}
        />

        <Card className="lg:col-span-2">
          <CardHeader
            title="Cashflow"
            description={`Income and expenses · ${rangeLabel.toLowerCase()}`}
          />
          <div className="px-5 pb-5">
            <SpendingChart data={cashflow.data ?? []} loading={cashflow.isLoading} />
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
          />
        </div>

        <div className="grid gap-3">
          <Card>
            <CardHeader title="Spend by category" description={rangeLabel} />
            <div className="px-5 pb-5">
              <CategoryBreakdown data={breakdown.data ?? []} loading={breakdown.isLoading} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Budget progress" description="This month" />
            <div className="px-5 pb-5">
              <BudgetOverview budgets={budgets.data ?? []} loading={budgets.isLoading} />
            </div>
          </Card>
        </div>
      </section>
    </>
  )
}
