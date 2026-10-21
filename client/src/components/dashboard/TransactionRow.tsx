import type { ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'

import { CategoryAvatar } from '@/components/ui/CategoryAvatar'
import { cn } from '@/lib/cn'
import { formatCurrency, formatMediumDate, formatRelativeTime, formatShortDate } from '@/lib/format'
import type { Transaction } from '@/types'

export interface TransactionRowProps {
  transaction: Transaction
  /** Icon key for the category, when the taxonomy has been loaded. */
  categoryIcon?: string
  /** Hex colour for the category, when the taxonomy has been loaded. */
  categoryColor?: string
  /** Rendered instead of the relative timestamp. */
  showDate?: boolean
  /** Row actions, such as edit and delete buttons. */
  actions?: ReactNode
}

export function TransactionRow({
  transaction,
  categoryIcon = 'Wallet',
  categoryColor = '#98a2ae',
  showDate = false,
  actions,
}: TransactionRowProps) {
  const isIncome = transaction.type === 'income'

  return (
    <li className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-200 hover:bg-surface-2/60">
      <CategoryAvatar icon={categoryIcon} color={categoryColor} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{transaction.merchant}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-faint">
          <span>{transaction.categoryName}</span>
          {transaction.note ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{transaction.note}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'text-sm font-medium tabular',
            isIncome ? 'text-positive' : 'text-ink',
          )}
        >
          <span className="sr-only">{isIncome ? 'Income' : 'Expense'} </span>
          {isIncome ? '+' : '−'}
          {formatCurrency(transaction.amount)}
        </span>

        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          {transaction.status === 'pending' ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <Clock className="size-3" aria-hidden="true" />
              Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              {isIncome ? (
                <ArrowDownLeft className="size-3" aria-hidden="true" />
              ) : (
                <ArrowUpRight className="size-3" aria-hidden="true" />
              )}
              {showDate ? (
                <time dateTime={transaction.date} title={formatMediumDate(transaction.date)}>
                  {formatShortDate(transaction.date)}
                </time>
              ) : (
                formatRelativeTime(transaction.date)
              )}
            </span>
          )}
        </span>
      </div>

      {actions ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-1 transition-opacity duration-200',
            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
          )}
        >
          {actions}
        </div>
      ) : null}
    </li>
  )
}
