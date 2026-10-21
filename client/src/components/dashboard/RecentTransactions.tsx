import { Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TransactionRow } from '@/components/dashboard/TransactionRow'
import { TransactionRowActions } from '@/components/transactions/TransactionRowActions'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { formatRelativeTime } from '@/lib/format'
import type { Category, Transaction } from '@/types'

export interface RecentTransactionsProps {
  transactions: Transaction[]
  categories: Map<string, Category>
  loading?: boolean
  error?: Error
  onRetry?: () => void
  /** Opens a transaction in the editor. */
  onEdit?: (transaction: Transaction) => void
  /** Opens the delete confirmation. */
  onDelete?: (transaction: Transaction) => void
}

export function RecentTransactions({
  transactions,
  categories,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
}: RecentTransactionsProps) {
  const latest = transactions[0]
  const showActions = Boolean(onEdit && onDelete)

  return (
    <Card flush>
      <CardHeader
        title="Recent transactions"
        description={
          latest && !loading
            ? `Latest activity · ${formatRelativeTime(latest.date)}`
            : 'Your most recent account activity'
        }
        actions={<ViewAllLink />}
        className="border-b border-line"
      />

      {loading ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load transactions"
          description={error.message}
          onRetry={onRetry}
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-5" aria-hidden="true" />}
          title="No transactions yet"
          description="Add your first transaction and it will show up here."
        />
      ) : (
        <ul className="divide-y divide-line">
          {transactions.map((transaction) => {
            const category = categories.get(transaction.categoryId)
            return (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categoryIcon={category?.icon}
                categoryColor={category?.color}
                showDate
                actions={
                  showActions ? (
                    <TransactionRowActions
                      transaction={transaction}
                      onEdit={onEdit!}
                      onDelete={onDelete!}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function ViewAllLink() {
  return (
    <Link
      to="/transactions"
      className="rounded-control px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      View all
    </Link>
  )
}
