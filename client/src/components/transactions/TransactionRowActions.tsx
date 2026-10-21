import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import type { Transaction } from '@/types'

export interface TransactionRowActionsProps {
  transaction: Transaction
  /** Opens the transaction in the editor. */
  onEdit: (transaction: Transaction) => void
  /** Opens the delete confirmation. */
  onDelete: (transaction: Transaction) => void
}

/** The edit and delete buttons shown on a transaction row. */
export function TransactionRowActions({
  transaction,
  onEdit,
  onDelete,
}: TransactionRowActionsProps) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${transaction.merchant}`}
        title="Edit transaction"
        onClick={() => onEdit(transaction)}
        icon={<Pencil className="size-3.5" aria-hidden="true" />}
      />

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${transaction.merchant}`}
        title="Delete transaction"
        onClick={() => onDelete(transaction)}
        icon={<Trash2 className="size-3.5 text-negative" aria-hidden="true" />}
      />
    </>
  )
}
