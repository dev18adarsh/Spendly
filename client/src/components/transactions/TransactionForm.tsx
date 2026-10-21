import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useCategories } from '@/hooks/useCategories'
import { notifyDataChanged } from '@/hooks/useDataRevision'
import {
  parseAmount,
  toDateInputValue,
  toIsoFromDateInput,
  validateAmount,
  validateDate,
  validateDescription,
  validateNote,
} from '@/lib/validation'
import { api, ApiError } from '@/services'
import type { TransactionDraft, TransactionDraftUpdate } from '@/services/types'
import type { PaymentMethod, Transaction, TransactionStatus, TransactionType } from '@/types'

export interface TransactionFormProps {
  /** The transaction being edited. Omit it to create a new one. */
  transaction?: Transaction
  /** Called once the record has been saved. */
  onSaved: (transaction: Transaction) => void
  /**
   * Reports what the form is doing, so the surrounding dialog can disable
   * its actions while a request is in flight.
   */
  onStatusChange?: (status: { submitting: boolean; ready: boolean }) => void
}

interface FormState {
  type: TransactionType
  amount: string
  merchant: string
  categoryId: string
  date: string
  method: PaymentMethod
  status: TransactionStatus
  note: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const typeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

const methodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
]

const statusOptions: Array<{ value: TransactionStatus; label: string }> = [
  { value: 'cleared', label: 'Cleared' },
  { value: 'pending', label: 'Pending' },
]

/**
 * Maps the API's field names onto the ones this form uses, so a rejected
 * payload points at the input the user actually filled in.
 */
const SERVER_FIELD_ALIASES: Record<string, keyof FormState> = {
  description: 'merchant',
  category: 'categoryId',
  notes: 'note',
  paymentMethod: 'method',
}

function initialState(transaction?: Transaction): FormState {
  if (transaction) {
    return {
      type: transaction.type,
      amount: transaction.amount.toFixed(2),
      merchant: transaction.merchant,
      categoryId: transaction.categoryId,
      date: toDateInputValue(transaction.date),
      method: transaction.method,
      status: transaction.status,
      note: transaction.note ?? '',
    }
  }

  return {
    type: 'expense',
    amount: '',
    merchant: '',
    categoryId: '',
    date: toDateInputValue(new Date().toISOString()),
    method: 'card',
    status: 'cleared',
    note: '',
  }
}

/**
 * The form behind the "new transaction" and "edit transaction" dialogs.
 *
 * It owns its own state, validates before it calls the API, refuses to send
 * a second request while one is in flight and reports what the server said
 * when it refuses the payload.
 */
export function TransactionForm({ transaction, onSaved, onStatusChange }: TransactionFormProps) {
  const categories = useCategories()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(() => initialState(transaction))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEditing = Boolean(transaction)
  const ready = !categories.isLoading && !categories.isError

  const categoryOptions = useMemo(
    () =>
      categories.categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories.categories],
  )

  // Keep the dialog's actions in step with the form.
  useEffect(() => {
    onStatusChange?.({ submitting, ready })
  }, [onStatusChange, submitting, ready])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    // Clear the complaint about a field as soon as the user touches it.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {}

    const amountError = validateAmount(form.amount)
    if (amountError) found.amount = amountError

    const merchantError = validateDescription(form.merchant)
    if (merchantError) found.merchant = merchantError

    if (!form.categoryId) found.categoryId = 'Choose a category.'

    const dateError = validateDate(form.date)
    if (dateError) found.date = dateError

    const noteError = validateNote(form.note)
    if (noteError) found.note = noteError

    return found
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const found = validate()
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) return

    const amount = parseAmount(form.amount)
    if (amount === null) {
      setErrors({ amount: validateAmount(form.amount) ?? 'Enter a valid amount.' })
      return
    }

    const draft: TransactionDraft = {
      amount,
      type: form.type,
      categoryId: form.categoryId,
      merchant: form.merchant.trim(),
      date: toIsoFromDateInput(form.date),
      method: form.method,
      status: form.status,
    }

    if (form.note.trim()) draft.note = form.note.trim()

    setSubmitting(true)

    try {
      const saved = isEditing && transaction
        ? await api.updateTransaction(transaction.id, draft as TransactionDraftUpdate)
        : await api.createTransaction(draft)

      // Tell every cached view that the data on the server has moved on.
      notifyDataChanged()

      toast.success(
        isEditing ? 'Transaction updated' : 'Transaction saved',
        `${saved.merchant} · ${saved.type === 'income' ? 'income' : 'expense'}`,
      )

      onSaved(saved)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldIssues = caught.details.map((issue) => ({
          field: SERVER_FIELD_ALIASES[issue.field] ?? (issue.field as keyof FormState),
          message: issue.message,
        }))

        if (fieldIssues.length > 0) {
          const next: FieldErrors = {}
          for (const issue of fieldIssues) {
            if (issue.field in form) next[issue.field] = issue.message
          }
          setErrors(next)
        }

        setFormError(caught.message)
        return
      }

      setFormError('Something went wrong while saving. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id="transaction-form" className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <SegmentedControl
        options={typeOptions}
        value={form.type}
        onChange={(value) => update('type', value)}
        ariaLabel="Transaction type"
        className="w-full"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={(event) => update('amount', event.target.value)}
          error={errors.amount}
          autoComplete="off"
          required
        />

        <Select
          label="Category"
          name="category"
          options={categoryOptions}
          value={form.categoryId}
          onChange={(event) => update('categoryId', event.target.value)}
          placeholder={categories.isLoading ? 'Loading categories…' : 'Choose a category'}
          error={errors.categoryId ?? (categories.isError ? 'Categories could not be loaded.' : undefined)}
          disabled={categories.isLoading || categories.isError}
          required
        />
      </div>

      <Input
        label="Description"
        name="merchant"
        placeholder="e.g. Blue Bottle Coffee"
        value={form.merchant}
        onChange={(event) => update('merchant', event.target.value)}
        error={errors.merchant}
        autoComplete="off"
        required
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Date"
          name="date"
          type="date"
          value={form.date}
          onChange={(event) => update('date', event.target.value)}
          error={errors.date}
          required
        />

        <Select
          label="Method"
          name="method"
          options={methodOptions}
          value={form.method}
          onChange={(event) => update('method', event.target.value as PaymentMethod)}
        />

        <Select
          label="Status"
          name="status"
          options={statusOptions}
          value={form.status}
          onChange={(event) => update('status', event.target.value as TransactionStatus)}
        />
      </div>

      <Input
        label="Note"
        name="note"
        placeholder="Optional"
        value={form.note}
        onChange={(event) => update('note', event.target.value)}
        error={errors.note}
        autoComplete="off"
      />

      {formError ? (
        <div
          role="alert"
          className="flex gap-3 rounded-control border border-negative/25 bg-negative/10 p-3.5 text-sm text-negative"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{formError}</p>
        </div>
      ) : null}
    </form>
  )
}
