import { useState } from 'react'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { notifyDataChanged } from '@/hooks/useDataRevision'
import { formatCurrency, formatMediumDate } from '@/lib/format'
import { api, ApiError } from '@/services'
import type { Transaction } from '@/types'

export interface DeleteTransactionDialogProps {
  /** The transaction to remove. `null` keeps the dialog closed. */
  transaction: Transaction | null
  onClose: () => void
}

/**
 * Asks before a transaction is removed.
 *
 * The delete only happens once the user confirms, and the button stays
 * disabled while the request is in flight so a second click cannot send it
 * twice.
 */
export function DeleteTransactionDialog({ transaction, onClose }: DeleteTransactionDialogProps) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = transaction !== null

  async function handleDelete() {
    if (!transaction || deleting) return

    setDeleting(true)
    setError(null)

    try {
      await api.deleteTransaction(transaction.id)

      // The record is gone — let every cached view know.
      notifyDataChanged()

      toast.success('Transaction deleted', transaction.merchant)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while deleting. Please try again.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={deleting ? () => undefined : onClose}
      title="Delete transaction"
      description="This cannot be undone."
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
            {deleting ? 'Deleting…' : 'Delete transaction'}
          </Button>
        </>
      }
    >
      {transaction ? (
        <div className="space-y-4">
          <div className="rounded-control border border-line bg-surface-2 p-4">
            <p className="text-sm font-medium text-ink">{transaction.merchant}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {transaction.categoryName} · {formatMediumDate(transaction.date)} ·{' '}
              <span className="tabular">
                {formatCurrency(transaction.amount)}
              </span>
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
