/** Payment methods a transaction may be settled with. */
export const PAYMENT_METHODS = ['card', 'bank', 'cash', 'transfer', 'other'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Settlement state of a transaction. */
export const TRANSACTION_STATUSES = ['cleared', 'pending'] as const

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

/** Direction of a transaction. */
export const TRANSACTION_TYPES = ['income', 'expense'] as const

export type TransactionType = (typeof TRANSACTION_TYPES)[number]
