import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Plus, Receipt, Search, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { TransactionRow } from '@/components/dashboard/TransactionRow'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { TransactionRowActions } from '@/components/transactions/TransactionRowActions'
import { useTransactionComposer } from '@/components/transactions/TransactionComposer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { useCategories } from '@/hooks/useCategories'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatCurrency, formatMediumDate } from '@/lib/format'
import { api } from '@/services'
import { DATE_RANGES, type DateRangeKey } from '@/services/types'
import type { Transaction, TransactionType } from '@/types'

type TypeFilter = TransactionType | 'all'

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
]

const rangeOptions = DATE_RANGES.map((range) => ({
  value: range.key,
  label: range.shortLabel,
  title: range.label,
}))

const VALID_RANGES = new Set<string>(DATE_RANGES.map((range) => range.key))
const VALID_TYPES = new Set<string>(['all', 'income', 'expense'])

export function TransactionsPage() {
  const [params, setParams] = useSearchParams()
  const categories = useCategories()
  const composer = useTransactionComposer()
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)

  // The filters live in the URL, so a shared link keeps them and a refresh
  // does not lose them.
  const search = params.get('search') ?? ''
  const categoryId = params.get('category') ?? 'all'
  const type = readType(params.get('type'))
  const range = readRange(params.get('range'))

  function updateParam(key: string, value: string, fallback: string) {
    const next = new URLSearchParams(params)
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  // The request waits until the user stops typing.
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, error, isLoading, isError, refetch } = useAsyncData(
    (signal) => api.getTransactions({ search: debouncedSearch, categoryId, type, range }, signal),
    [debouncedSearch, categoryId, type, range],
  )

  const transactions = data ?? []

  const totals = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const transaction of transactions) {
      if (transaction.type === 'income') income += transaction.amount
      else expenses += transaction.amount
    }
    return { income, expenses, net: income - expenses }
  }, [transactions])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof transactions>()
    for (const transaction of transactions) {
      const key = new Date(transaction.date).toDateString()
      const bucket = groups.get(key)
      if (bucket) bucket.push(transaction)
      else groups.set(key, [transaction])
    }
    return Array.from(groups.entries())
  }, [transactions])

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories.categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories.categories],
  )

  const hasFilters = search !== '' || categoryId !== 'all' || type !== 'all'

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every movement across your accounts, newest first."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              options={rangeOptions}
              value={range}
              onChange={(value) => updateParam('range', value, '30d')}
              ariaLabel="Reporting period"
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => composer.open()}
            >
              New transaction
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_auto]">
          <Input
            id="transaction-search"
            name="search"
            label="Search"
            placeholder="Search merchant, category or note…"
            value={search}
            onChange={(event) => updateParam('search', event.target.value, '')}
            icon={<Search className="size-4" aria-hidden="true" />}
          />

          <Select
            id="transaction-filter-category"
            name="category"
            label="Category"
            options={categoryOptions}
            value={categoryId}
            onChange={(event) => updateParam('category', event.target.value, 'all')}
          />

          <div className="flex flex-col justify-end gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Type</span>
            <SegmentedControl
              options={typeOptions}
              value={type}
              onChange={(value) => updateParam('type', value, 'all')}
              ariaLabel="Transaction type"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-3">
          {isLoading ? (
            // While the request is in flight the totals are unknown — showing
            // them as zero would read like an empty account.
            <span className="text-xs text-ink-faint">Loading transactions…</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Receipt className="size-3.5 text-ink-faint" aria-hidden="true" />
                {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <ArrowUpRight className="size-3.5 text-positive" aria-hidden="true" />
                <span className="tabular">{formatCurrency(totals.income)}</span> in
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <ArrowDownRight className="size-3.5 text-negative" aria-hidden="true" />
                <span className="tabular">{formatCurrency(totals.expenses)}</span> out
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <SlidersHorizontal className="size-3.5 text-ink-faint" aria-hidden="true" />
                Net <span className="font-medium text-ink tabular">{formatCurrency(totals.net)}</span>
              </span>
            </>
          )}
        </div>
      </Card>

      <Card flush>
        {isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load transactions"
            description={error?.message}
            onRetry={refetch}
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" aria-hidden="true" />}
            title={hasFilters ? 'No matching transactions' : 'No transactions in this period'}
            description={
              hasFilters
                ? 'Try a different search term, category or date range.'
                : 'Add your first transaction to start tracking your spending.'
            }
            action={
              hasFilters ? undefined : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="size-4" aria-hidden="true" />}
                  onClick={() => composer.open()}
                >
                  New transaction
                </Button>
              )
            }
          />
        ) : (
          <div>
            {grouped.map(([day, items]) => {
              const first = items[0]
              if (!first) return null

              return (
                <section key={day}>
                  <h2 className="sticky top-16 z-10 border-b border-line bg-surface-2/80 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint backdrop-blur">
                    {formatMediumDate(first.date)}
                  </h2>
                  <ul className="divide-y divide-line">
                    {items.map((transaction) => {
                      const category = categories.byId.get(transaction.categoryId)
                      return (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          categoryIcon={category?.icon}
                          categoryColor={category?.color}
                          showDate
                          actions={
                            <TransactionRowActions
                              transaction={transaction}
                              onEdit={(target) => composer.open(target)}
                              onDelete={setPendingDelete}
                            />
                          }
                        />
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Card>

      <DeleteTransactionDialog
        transaction={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}

/** Reads the type filter from the URL, ignoring anything unexpected. */
function readType(value: string | null): TypeFilter {
  if (value && VALID_TYPES.has(value)) return value as TypeFilter
  return 'all'
}

/** Reads the reporting window from the URL, ignoring anything unexpected. */
function readRange(value: string | null): DateRangeKey {
  if (value && VALID_RANGES.has(value)) return value as DateRangeKey
  return '30d'
}
