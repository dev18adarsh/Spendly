import { useState } from 'react'
import { AlertTriangle, Info, Plus, PiggyBank, Wallet } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAsyncData } from '@/hooks/useAsyncData'
import { cn } from '@/lib/cn'
import { formatCurrency, formatPercent } from '@/lib/format'
import { api } from '@/services'

export function BudgetsPage() {
  const [composerOpen, setComposerOpen] = useState(false)
  const { data, error, isLoading, isError, refetch } = useAsyncData(
    (signal) => api.getBudgets(signal),
    [],
  )

  const budgets = data ?? []

  const totals = budgets.reduce(
    (accumulator, budget) => ({
      limit: accumulator.limit + budget.limit,
      spent: accumulator.spent + budget.spent,
    }),
    { limit: 0, spent: 0 },
  )

  const overBudget = budgets.filter((budget) => budget.limit > 0 && budget.spent > budget.limit)

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly limits per category, with a live view of how far you have stretched them."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setComposerOpen(true)}
          >
            New budget
          </Button>
        }
      />

      <section aria-label="Budget summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Total budgeted"
          value={formatCurrency(totals.limit)}
          loading={isLoading}
          icon={Wallet}
        />
        <SummaryTile
          label="Total spent"
          value={formatCurrency(totals.spent)}
          loading={isLoading}
          icon={PiggyBank}
        />
        <SummaryTile
          label="Remaining"
          value={formatCurrency(Math.max(totals.limit - totals.spent, 0))}
          loading={isLoading}
          icon={AlertTriangle}
          tone={totals.spent > totals.limit ? 'negative' : 'positive'}
        />
      </section>

      {overBudget.length > 0 ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-card border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            {overBudget.length} {overBudget.length === 1 ? 'budget is' : 'budgets are'} over the limit
            this month — {overBudget.map((budget) => budget.name).join(', ')}.
          </p>
        </div>
      ) : null}

      <section aria-label="Budget list" className="mt-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <div className="space-y-3 p-5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card>
            <ErrorState
              title="Could not load budgets"
              description={error?.message}
              onRetry={refetch}
            />
          </Card>
        ) : budgets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wallet className="size-5" aria-hidden="true" />}
              title="No budgets yet"
              description="Create a budget to keep an eye on your monthly category limits."
              action={
                <Button variant="primary" size="sm" onClick={() => setComposerOpen(true)}>
                  Create a budget
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => {
              const ratio = budget.limit > 0 ? budget.spent / budget.limit : 0
              const over = ratio > 1
              const near = !over && ratio >= 0.85

              return (
                <Card key={budget.id} interactive className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: budget.color }}
                      />
                      <h2 className="truncate text-sm font-medium text-ink">{budget.name}</h2>
                    </div>

                    <Badge tone={over ? 'negative' : near ? 'warning' : 'positive'}>
                      {over ? 'Over' : formatPercent(ratio * 100, 0)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-lg font-semibold tracking-tight tabular',
                        over ? 'text-negative' : 'text-ink',
                      )}
                    >
                      {formatCurrency(budget.spent)}
                    </span>
                    <span className="text-xs text-ink-faint tabular">
                      of {formatCurrency(budget.limit)}
                    </span>
                  </div>

                  <ProgressBar
                    value={budget.spent}
                    max={budget.limit}
                    tone={over ? 'negative' : near ? 'warning' : 'positive'}
                    className="mt-3"
                    label={`${budget.name} budget`}
                  />

                  <p className="mt-3 text-[11px] text-ink-faint">
                    {over
                      ? `${formatCurrency(budget.spent - budget.limit)} over budget`
                      : `${formatCurrency(budget.limit - budget.spent)} left · resets monthly`}
                  </p>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <BudgetComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  loading: boolean
  icon: typeof Wallet
  tone?: 'positive' | 'negative'
}

function SummaryTile({ label, value, loading, icon: Icon, tone }: SummaryTileProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-faint">{label}</span>
        <Icon
          className={cn(
            'size-4',
            tone === 'negative'
              ? 'text-negative'
              : tone === 'positive'
                ? 'text-positive'
                : 'text-ink-faint',
          )}
          aria-hidden="true"
        />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-28" />
      ) : (
        <p className="mt-2 text-xl font-semibold tracking-tight text-ink tabular">{value}</p>
      )}
    </Card>
  )
}

const budgetCategoryOptions = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'transport', label: 'Transport' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'housing', label: 'Housing' },
  { value: 'health', label: 'Health' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'subscriptions', label: 'Subscriptions' },
]

/** Placeholder composer — budgets are read-only until the API is connected. */
function BudgetComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false)

  return (
    <Modal
      open={open}
      onClose={() => {
        setSubmitted(false)
        onClose()
      }}
      title="New budget"
      description="Set a monthly ceiling for a category."
      footer={
        submitted ? (
          <Button
            variant="secondary"
            onClick={() => {
              setSubmitted(false)
              onClose()
            }}
          >
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="budget-form">
              Create budget
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="flex gap-3 rounded-control border border-info/25 bg-info/10 p-3.5 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            Budgets are not saved yet — this preview build reads from sample data only.
          </p>
        </div>
      ) : (
        <form
          id="budget-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <Select
            label="Category"
            options={budgetCategoryOptions}
            placeholder="Choose a category"
            required
          />
          <Input
            label="Monthly limit"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            min="0"
            step="1"
            required
          />
        </form>
      )}
    </Modal>
  )
}
