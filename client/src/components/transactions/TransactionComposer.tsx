import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Transaction } from '@/types'

import { TransactionForm } from './TransactionForm'

interface ComposerContextValue {
  /** Opens the dialog. Pass a transaction to edit it. */
  open: (transaction?: Transaction) => void
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

/**
 * Opens the transaction dialog from anywhere in the app.
 *
 * Must be used inside a `TransactionComposerProvider`.
 */
export function useTransactionComposer(): ComposerContextValue {
  const context = useContext(ComposerContext)
  if (!context) {
    throw new Error(
      'useTransactionComposer must be used inside a <TransactionComposerProvider>.',
    )
  }
  return context
}

export interface TransactionComposerProviderProps {
  children: ReactNode
}

/**
 * Hosts the transaction dialog for the whole application.
 *
 * The dialog lives above the pages, so the header, the dashboard and the
 * transaction list all open the very same form.
 */
export function TransactionComposerProvider({ children }: TransactionComposerProviderProps) {
  const [state, setState] = useState<{ open: boolean; transaction?: Transaction }>({
    open: false,
  })
  // Bumped on every open so the form always starts from a clean slate.
  const [nonce, setNonce] = useState(0)

  const open = useCallback((transaction?: Transaction) => {
    setNonce((value) => value + 1)
    setState({ open: true, transaction })
  }, [])

  const close = useCallback(() => {
    setState({ open: false })
  }, [])

  const value = useMemo<ComposerContextValue>(() => ({ open }), [open])

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <TransactionComposer
        open={state.open}
        transaction={state.transaction}
        nonce={nonce}
        onClose={close}
      />
    </ComposerContext.Provider>
  )
}

interface TransactionComposerProps {
  open: boolean
  transaction?: Transaction
  /** Changes on every open, so the form is remounted with fresh state. */
  nonce: number
  onClose: () => void
}

/** The dialog itself: a form for creating and editing a transaction. */
function TransactionComposer({ open, transaction, nonce, onClose }: TransactionComposerProps) {
  const [status, setStatus] = useState({ submitting: false, ready: true })

  const isEditing = Boolean(transaction)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit transaction' : 'New transaction'}
      description={
        isEditing
          ? 'Update the details of this entry.'
          : 'Capture a spend and categorise it.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={status.submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="transaction-form"
            disabled={status.submitting || !status.ready}
            icon={
              status.submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : undefined
            }
          >
            {status.submitting
              ? isEditing
                ? 'Saving changes…'
                : 'Saving…'
              : isEditing
                ? 'Save changes'
                : 'Save transaction'}
          </Button>
        </>
      }
    >
      <TransactionForm
        key={`${transaction?.id ?? 'new'}-${nonce}`}
        transaction={transaction}
        onStatusChange={setStatus}
        onSaved={onClose}
      />
    </Modal>
  )
}
