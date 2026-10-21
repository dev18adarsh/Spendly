import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'

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
import { useToast } from '@/components/ui/Toast'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useCategories } from '@/hooks/useCategories'
import { notifyDataChanged } from '@/hooks/useDataRevision'
import { cn } from '@/lib/cn'
import { formatCurrency, formatPercent } from '@/lib/format'
import { api, ApiError } from '@/services'
import type { Budget } from '@/types'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function getMonthName(month: number): string {
  const index = Math.max(0, Math.min(11, month - 1))
  return MONTH_NAMES[index] ?? 'Month'
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function BudgetsPage() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(() => now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(() => now.getFullYear())

  // Modal states
  const [composerOpen, setComposerOpen] = useState(false)
  const [overallModalOpen, setOverallModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null)
  const [deletingOverallOpen, setDeletingOverallOpen] = useState(false)

  // Fetch category budgets for the selected month/year
  const {
    data: budgetsData,
    error: budgetsError,
    isLoading: budgetsLoading,
    isError: budgetsIsError,
    refetch: refetchBudgets,
  } = useAsyncData(
    (signal) => api.getBudgets({ month: selectedMonth, year: selectedYear }, signal),
    [selectedMonth, selectedYear],
  )

  // Fetch overall budget for the selected month/year
  const {
    data: overallBudgetData,
    error: overallError,
    isLoading: overallLoading,
    isError: overallIsError,
    refetch: refetchOverall,
  } = useAsyncData(
    (signal) => api.getOverallBudget({ month: selectedMonth, year: selectedYear }, signal),
    [selectedMonth, selectedYear],
  )

  const budgets = budgetsData ?? []
  const overallBudget = overallBudgetData ?? null
  const isLoading = budgetsLoading || overallLoading
  const hasError = budgetsIsError || overallIsError
  const activeError = budgetsError ?? overallError

  const refetchAll = () => {
    refetchBudgets()
    refetchOverall()
  }

  // Navigation handlers
  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((prev) => prev - 1)
    } else {
      setSelectedMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((prev) => prev + 1)
    } else {
      setSelectedMonth((prev) => prev + 1)
    }
  }

  const handleCurrentMonth = () => {
    const today = new Date()
    setSelectedMonth(today.getMonth() + 1)
    setSelectedYear(today.getFullYear())
  }

  const isCurrentMonth =
    selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()

  const monthName = getMonthName(selectedMonth)
  const monthLabel = `${monthName} ${selectedYear}`
  const daysCount = getDaysInMonth(selectedYear, selectedMonth)
  const monthShort = monthName.slice(0, 3)
  const monthRangeText = `${monthShort} 1 – ${monthShort} ${daysCount}, ${selectedYear}`

  // Category totals
  const categoryTotals = useMemo(
    () =>
      budgets.reduce(
        (acc, budget) => ({
          limit: acc.limit + budget.limit,
          spent: acc.spent + budget.spent,
        }),
        { limit: 0, spent: 0 },
      ),
    [budgets],
  )

  // Overall calculations
  const totalBudgeted = overallBudget ? overallBudget.limit : categoryTotals.limit
  const totalSpent = overallBudget ? overallBudget.spent : categoryTotals.spent
  const remainingBudget = totalBudgeted - totalSpent

  // Over-budget and approaching budgets
  const overCategoryBudgets = useMemo(
    () =>
      budgets.filter(
        (b) => b.status === 'over' || (b.limit > 0 && b.spent > b.limit) || (b.limit === 0 && b.spent > 0),
      ),
    [budgets],
  )

  const approachingCategoryBudgets = useMemo(
    () =>
      budgets.filter(
        (b) =>
          b.status === 'approaching' ||
          (b.limit > 0 && b.spent < b.limit && b.spent / b.limit >= 0.85),
      ),
    [budgets],
  )

  const isOverallOver = overallBudget?.status === 'over' || (overallBudget && overallBudget.spent > overallBudget.limit)
  const isOverallApproaching =
    overallBudget?.status === 'approaching' ||
    (overallBudget && !isOverallOver && overallBudget.spent / overallBudget.limit >= 0.85)

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Set your overall monthly spending target and optional category limits."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Wallet className="size-4" aria-hidden="true" />}
              onClick={() => setOverallModalOpen(true)}
            >
              {overallBudget ? 'Edit overall budget' : 'Set overall budget'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setComposerOpen(true)}
            >
              New category budget
            </Button>
          </div>
        }
      />

      {/* Month navigation bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft className="size-4" aria-hidden="true" />}
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          />
          <div className="flex items-center gap-2 px-1">
            <Calendar className="size-4 text-brand" aria-hidden="true" />
            <h2 className="text-base font-semibold text-ink">{monthLabel}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronRight className="size-4" aria-hidden="true" />}
            onClick={handleNextMonth}
            aria-label="Next month"
          />
          {!isCurrentMonth ? (
            <Button variant="ghost" size="sm" onClick={handleCurrentMonth} className="text-xs">
              Today
            </Button>
          ) : null}
        </div>

        <span className="text-xs text-ink-faint">
          Period: <span className="font-medium text-ink-muted">{monthRangeText}</span>
        </span>
      </div>

      {/* Summary statistics */}
      <section aria-label="Budget summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Total budgeted"
          value={formatCurrency(totalBudgeted)}
          loading={isLoading}
          icon={Wallet}
          subtext={
            overallBudget
              ? `Overall ceiling${budgets.length > 0 ? ` · ${budgets.length} category limits` : ''}`
              : `${budgets.length} category ${budgets.length === 1 ? 'limit' : 'limits'}`
          }
        />
        <SummaryTile
          label="Total spent"
          value={formatCurrency(totalSpent)}
          loading={isLoading}
          icon={PiggyBank}
          subtext={`Expenses for ${getMonthName(selectedMonth)}`}
        />
        <SummaryTile
          label="Remaining"
          value={formatCurrency(Math.max(remainingBudget, 0))}
          loading={isLoading}
          icon={AlertTriangle}
          tone={remainingBudget < 0 ? 'negative' : 'positive'}
          subtext={
            remainingBudget < 0
              ? `${formatCurrency(Math.abs(remainingBudget))} over budget`
              : 'Left to spend'
          }
        />
      </section>

      {/* Overall monthly spending budget card */}
      <section aria-label="Overall monthly budget" className="mt-4">
        {isLoading ? (
          <Card className="p-5">
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </Card>
        ) : overallBudget ? (
          <Card className="border-brand/20 bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-control bg-brand/10 text-brand">
                    <Wallet className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink">Overall monthly spending budget</h3>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  Ceiling on all expenses for {monthLabel} across every category.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    isOverallOver
                      ? 'negative'
                      : isOverallApproaching
                        ? 'warning'
                        : 'positive'
                  }
                >
                  {isOverallOver
                    ? 'Ceiling exceeded'
                    : isOverallApproaching
                      ? 'Approaching limit (85%+)'
                      : 'On track'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil className="size-3.5" aria-hidden="true" />}
                  onClick={() => setOverallModalOpen(true)}
                  aria-label="Edit overall budget limit"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="size-3.5 text-negative" aria-hidden="true" />}
                  onClick={() => setDeletingOverallOpen(true)}
                  aria-label="Remove overall budget"
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight tabular',
                  isOverallOver ? 'text-negative' : 'text-ink',
                )}
              >
                {formatCurrency(overallBudget.spent)}
              </span>
              <span className="text-sm font-medium text-ink-faint tabular">
                of {formatCurrency(overallBudget.limit)}
              </span>
            </div>

            <ProgressBar
              value={overallBudget.spent}
              max={overallBudget.limit}
              tone={
                isOverallOver
                  ? 'negative'
                  : isOverallApproaching
                    ? 'warning'
                    : 'positive'
              }
              className="mt-3"
              label={`Overall budget progress for ${monthLabel}`}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
              <span>
                {isOverallOver ? (
                  <span className="font-semibold text-negative">
                    {formatCurrency(Math.abs(overallBudget.remaining))} over monthly budget
                  </span>
                ) : (
                  <span className="font-medium text-positive">
                    {formatCurrency(overallBudget.remaining)} left to spend this month
                  </span>
                )}
              </span>
              <span className="tabular">{formatPercent(overallBudget.percentUsed, 1)} used</span>
            </div>
          </Card>
        ) : (
          <Card className="border-dashed border-line p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-ink-muted" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">
                    No overall budget set for {monthLabel}
                  </h3>
                </div>
                <p className="text-xs text-ink-faint">
                  Set an overall monthly spending ceiling to track your total expenses, with or without category limits.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setOverallModalOpen(true)}
              >
                Set monthly budget
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Visual alert banners for approaching and exceeded limits */}
      {overCategoryBudgets.length > 0 || isOverallOver ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-3 rounded-card border border-negative/25 bg-negative/10 px-4 py-3 text-sm text-negative"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">
              Budget exceeded in {monthLabel}
            </p>
            <p className="text-xs text-negative/90 leading-relaxed">
              {isOverallOver ? 'Overall monthly budget has been exceeded. ' : ''}
              {overCategoryBudgets.length > 0
                ? `${overCategoryBudgets.length} ${overCategoryBudgets.length === 1 ? 'category is' : 'categories are'} over limit: ${overCategoryBudgets.map((b) => `${b.name} (${formatCurrency(b.spent)} of ${formatCurrency(b.limit)})`).join(', ')}.`
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      {(approachingCategoryBudgets.length > 0 || isOverallApproaching) && !isOverallOver ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-3 rounded-card border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">
              Approaching budget limit (85%+ used)
            </p>
            <p className="text-xs text-warning/90 leading-relaxed">
              {isOverallApproaching ? 'Overall budget is close to its limit. ' : ''}
              {approachingCategoryBudgets.length > 0
                ? `${approachingCategoryBudgets.length} ${approachingCategoryBudgets.length === 1 ? 'category has' : 'categories have'} used 85% or more: ${approachingCategoryBudgets.map((b) => `${b.name} (${formatPercent(b.percentUsed, 0)})`).join(', ')}.`
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      {/* Category Budgets Grid */}
      <section aria-label="Category budgets" className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Category budgets ({budgets.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="p-5">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : hasError ? (
          <Card>
            <ErrorState
              title="Could not load budgets"
              description={activeError?.message}
              onRetry={refetchAll}
            />
          </Card>
        ) : budgets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wallet className="size-5" aria-hidden="true" />}
              title={`No category budgets for ${monthLabel}`}
              description="Create a category budget to track limits for specific expenses like Food, Shopping, or Transport."
              action={
                <Button variant="primary" size="sm" onClick={() => setComposerOpen(true)}>
                  Create category budget
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => {
              const ratio = budget.limit > 0 ? budget.spent / budget.limit : 0
              const over = budget.status === 'over' || ratio > 1 || (budget.limit === 0 && budget.spent > 0)
              const near = !over && (budget.status === 'approaching' || ratio >= 0.85)
              const tone = over ? 'negative' : near ? 'warning' : 'positive'

              return (
                <Card key={budget.id} interactive className="flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: budget.color }}
                        />
                        <h3 className="truncate text-sm font-semibold text-ink">{budget.name}</h3>
                      </div>

                      <Badge tone={tone}>
                        {over
                          ? 'Over budget'
                          : near
                            ? `${formatPercent(budget.percentUsed ?? ratio * 100, 0)} (Near limit)`
                            : formatPercent(budget.percentUsed ?? ratio * 100, 0)}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'text-xl font-bold tracking-tight tabular',
                          over ? 'text-negative' : 'text-ink',
                        )}
                      >
                        {formatCurrency(budget.spent)}
                      </span>
                      <span className="text-xs font-medium text-ink-faint tabular">
                        of {formatCurrency(budget.limit)}
                      </span>
                    </div>

                    <ProgressBar
                      value={budget.spent}
                      max={budget.limit}
                      tone={tone}
                      className="mt-3"
                      label={`${budget.name} budget for ${monthLabel}`}
                    />

                    <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                      <span>
                        {over ? (
                          <span className="font-medium text-negative">
                            {formatCurrency(Math.abs(budget.remaining))} over limit
                          </span>
                        ) : (
                          <span className="font-medium text-ink-muted">
                            {formatCurrency(budget.remaining)} remaining
                          </span>
                        )}
                      </span>
                      <span>Resets monthly</span>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-line/60 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil className="size-3.5" aria-hidden="true" />}
                      onClick={() => setEditingBudget(budget)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="size-3.5 text-negative" aria-hidden="true" />}
                      onClick={() => setDeletingBudget(budget)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Composer Modal for New Category Budget */}
      <BudgetComposer
        open={composerOpen}
        month={selectedMonth}
        year={selectedYear}
        existingBudgets={budgets}
        onClose={() => setComposerOpen(false)}
      />

      {/* Edit Category Budget Modal */}
      <EditBudgetModal
        budget={editingBudget}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => setEditingBudget(null)}
      />

      {/* Delete Category Budget Confirmation Modal */}
      <DeleteBudgetDialog
        budget={deletingBudget}
        monthLabel={monthLabel}
        onClose={() => setDeletingBudget(null)}
      />

      {/* Set/Edit Overall Monthly Budget Modal */}
      <OverallBudgetModal
        open={overallModalOpen}
        initialLimit={overallBudget?.limit}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => setOverallModalOpen(false)}
      />

      {/* Delete Overall Monthly Budget Confirmation Modal */}
      <DeleteOverallBudgetDialog
        open={deletingOverallOpen}
        month={selectedMonth}
        year={selectedYear}
        monthLabel={monthLabel}
        onClose={() => setDeletingOverallOpen(false)}
      />
    </>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  loading: boolean
  icon: typeof Wallet
  subtext?: string
  tone?: 'positive' | 'negative'
}

function SummaryTile({ label, value, loading, icon: Icon, subtext, tone }: SummaryTileProps) {
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
        <p className="mt-2 text-xl font-bold tracking-tight text-ink tabular">{value}</p>
      )}
      {subtext ? <p className="mt-1 text-[11px] text-ink-faint truncate">{subtext}</p> : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Category Budget Composer (Create)                                  */
/* ------------------------------------------------------------------ */

interface BudgetComposerProps {
  open: boolean
  month: number
  year: number
  existingBudgets: Budget[]
  onClose: () => void
}

function BudgetComposer({ open, month, year, existingBudgets, onClose }: BudgetComposerProps) {
  const categories = useCategories()
  const toast = useToast()

  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const monthName = getMonthName(month)

  useEffect(() => {
    if (!open) return
    setCategoryId('')
    setLimit('')
    setError(null)
    setLimitError(undefined)
    setSubmitting(false)
  }, [open])

  const existingCategoryMap = useMemo(
    () => new Map(existingBudgets.map((b) => [b.categoryId, b.limit])),
    [existingBudgets],
  )

  const categoryOptions = useMemo(
    () =>
      categories.categories
        .filter((category) => category.id !== 'income')
        .map((category) => {
          const currentLimit = existingCategoryMap.get(category.id)
          return {
            value: category.id,
            label:
              currentLimit !== undefined
                ? `${category.name} (Currently ${formatCurrency(currentLimit)})`
                : category.name,
          }
        }),
    [categories.categories, existingCategoryMap],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setError(null)

    if (!categoryId) {
      setError('Choose a category.')
      return
    }

    const amount = Number(limit.trim().replace(',', '.'))
    if (!limit.trim() || !Number.isFinite(amount) || amount < 0) {
      setLimitError('Enter a limit of 0 or more.')
      return
    }
    setLimitError(undefined)

    setSubmitting(true)

    try {
      const created = await api.createBudget({
        categoryId,
        limit: amount,
        month,
        year,
      })

      notifyDataChanged()
      toast.success(
        'Budget saved',
        `${created.name} · ${formatCurrency(created.limit)} for ${monthName} ${year}`,
      )
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while saving the budget. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New category budget"
      description={`Set a monthly ceiling for a category for ${monthName} ${year}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="budget-composer-form"
            disabled={submitting}
            icon={
              submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : undefined
            }
          >
            {submitting ? 'Saving…' : 'Save budget'}
          </Button>
        </>
      }
    >
      <form id="budget-composer-form" className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Select
          label="Category"
          options={categoryOptions}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          placeholder={categories.isLoading ? 'Loading categories…' : 'Choose a category'}
          disabled={categories.isLoading || categories.isError}
          required
        />

        <Input
          label="Monthly limit"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          error={limitError}
          autoComplete="off"
          required
        />

        {error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Edit Category Budget Modal                                         */
/* ------------------------------------------------------------------ */

interface EditBudgetModalProps {
  budget: Budget | null
  month: number
  year: number
  onClose: () => void
}

function EditBudgetModal({ budget, month, year, onClose }: EditBudgetModalProps) {
  const toast = useToast()
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const open = budget !== null
  const monthName = getMonthName(month)

  useEffect(() => {
    if (budget) {
      setLimit(String(budget.limit))
      setError(null)
      setLimitError(undefined)
      setSubmitting(false)
    }
  }, [budget])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!budget || submitting) return

    const amount = Number(limit.trim().replace(',', '.'))
    if (!limit.trim() || !Number.isFinite(amount) || amount < 0) {
      setLimitError('Enter a limit of 0 or more.')
      return
    }
    setLimitError(undefined)
    setError(null)
    setSubmitting(true)

    try {
      const updated = await api.updateBudget(budget.id, amount)
      notifyDataChanged()
      toast.success('Budget updated', `${updated.name} · ${formatCurrency(updated.limit)}`)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while updating the budget. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${budget?.name ?? ''} budget`}
      description={`Update the spending limit for ${monthName} ${year}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="edit-budget-form"
            disabled={submitting}
            icon={
              submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : undefined
            }
          >
            {submitting ? 'Updating…' : 'Update limit'}
          </Button>
        </>
      }
    >
      <form id="edit-budget-form" className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Monthly limit"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          error={limitError}
          autoComplete="off"
          required
        />

        {error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Delete Category Budget Dialog                                      */
/* ------------------------------------------------------------------ */

interface DeleteBudgetDialogProps {
  budget: Budget | null
  monthLabel: string
  onClose: () => void
}

function DeleteBudgetDialog({ budget, monthLabel, onClose }: DeleteBudgetDialogProps) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = budget !== null

  async function handleDelete() {
    if (!budget || deleting) return

    setDeleting(true)
    setError(null)

    try {
      await api.deleteBudget(budget.id)
      notifyDataChanged()
      toast.success('Budget deleted', `${budget.name} budget removed`)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while deleting the budget.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={deleting ? () => undefined : onClose}
      title="Delete budget?"
      description={`Are you sure you want to delete the ${budget?.name ?? ''} budget for ${monthLabel}? Your transactions will not be deleted.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleting}
            icon={
              deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )
            }
          >
            {deleting ? 'Deleting…' : 'Delete budget'}
          </Button>
        </>
      }
    >
      {error ? (
        <div
          role="alert"
          className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{error}</p>
        </div>
      ) : null}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Overall Monthly Budget Modal (Set or Edit)                         */
/* ------------------------------------------------------------------ */

interface OverallBudgetModalProps {
  open: boolean
  initialLimit?: number
  month: number
  year: number
  onClose: () => void
}

function OverallBudgetModal({
  open,
  initialLimit,
  month,
  year,
  onClose,
}: OverallBudgetModalProps) {
  const toast = useToast()
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const monthName = getMonthName(month)

  useEffect(() => {
    if (!open) return
    setLimit(initialLimit !== undefined ? String(initialLimit) : '')
    setError(null)
    setLimitError(undefined)
    setSubmitting(false)
  }, [open, initialLimit])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const amount = Number(limit.trim().replace(',', '.'))
    if (!limit.trim() || !Number.isFinite(amount) || amount < 0) {
      setLimitError('Enter a limit of 0 or more.')
      return
    }
    setLimitError(undefined)
    setError(null)
    setSubmitting(true)

    try {
      const saved = await api.saveOverallBudget({
        limit: amount,
        month,
        year,
      })

      notifyDataChanged()
      toast.success(
        'Overall budget saved',
        `${formatCurrency(saved.limit)} monthly ceiling for ${monthName} ${year}`,
      )
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while saving overall budget. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialLimit !== undefined ? 'Edit overall budget' : 'Set overall monthly budget'}
      description={`Set an overall spending limit for ${monthName} ${year} across all expenses.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="overall-budget-form"
            disabled={submitting}
            icon={
              submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : undefined
            }
          >
            {submitting ? 'Saving…' : 'Save overall budget'}
          </Button>
        </>
      }
    >
      <form id="overall-budget-form" className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Overall spending ceiling"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          error={limitError}
          autoComplete="off"
          required
        />

        <p className="text-xs text-ink-faint">
          This ceiling applies to your total spending in {monthName} {year}, calculated from all expense transactions. Income is excluded.
        </p>

        {error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Delete Overall Budget Dialog                                       */
/* ------------------------------------------------------------------ */

interface DeleteOverallBudgetDialogProps {
  open: boolean
  month: number
  year: number
  monthLabel: string
  onClose: () => void
}

function DeleteOverallBudgetDialog({
  open,
  month,
  year,
  monthLabel,
  onClose,
}: DeleteOverallBudgetDialogProps) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (deleting) return

    setDeleting(true)
    setError(null)

    try {
      await api.deleteOverallBudget({ month, year })
      notifyDataChanged()
      toast.success('Overall budget removed', `Overall budget for ${monthLabel} deleted`)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while deleting overall budget.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={deleting ? () => undefined : onClose}
      title="Remove overall budget?"
      description={`Are you sure you want to remove the overall monthly spending budget for ${monthLabel}? Your category budgets and transactions will remain intact.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleting}
            icon={
              deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )
            }
          >
            {deleting ? 'Removing…' : 'Remove overall budget'}
          </Button>
        </>
      }
    >
      {error ? (
        <div
          role="alert"
          className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{error}</p>
        </div>
      ) : null}
    </Modal>
  )
}
