import type { Transaction } from '@/types'

export const RealtimeEvents = {
  TRANSACTION_CREATED: 'transaction-created',
  TRANSACTION_UPDATED: 'transaction-updated',
  TRANSACTION_DELETED: 'transaction-deleted',
} as const

export interface TransactionCreatedPayload {
  eventId: string
  id: string
  transaction: Transaction
  timestamp: string
}

export interface TransactionUpdatedPayload {
  eventId: string
  id: string
  transaction: Transaction
  timestamp: string
}

export interface TransactionDeletedPayload {
  eventId: string
  id: string
  timestamp: string
}
