import {
  buildBudgets,
  buildCategoryBreakdown,
  buildSeries,
  buildSummary,
  buildTopMerchants,
  mockBudgetLimits,
  mockCategories,
  mockTransactions,
  transactionsInRange,
} from '@/data/mock'
import type {
  BudgetDraft,
  SpendlyApi,
  TransactionDraft,
  TransactionDraftUpdate,
  TransactionQuery,
} from '@/services/types'
import type { Transaction } from '@/types'

/**
 * Mock implementation of the Spendly API.
 *
 * It mimics the latency and failure modes of a real network so the UI's
 * loading and error states can be exercised before the server exists.
 * Writes are kept in memory for the lifetime of the tab, so the demo build
 * behaves like the real one without needing a server.
 */

const MIN_LATENCY_MS = 280
const MAX_LATENCY_MS = 720

let shouldFail = false

/**
 * The in-memory ledger.
 *
 * It starts as a copy of the sample data and is mutated by the write
 * methods, so every view keeps talking to the same set of transactions.
 */
let ledger: Transaction[] = mockTransactions.map((transaction) => ({ ...transaction }))

/** The monthly budgets the demo build keeps in memory. */
let budgetLimits = mockBudgetLimits.map((budget) => ({ ...budget }))

/** Toggle simulated failures from the Settings screen. */
export function configureMockApi(options: { failWithError?: boolean }): void {
  shouldFail = options.failWithError ?? false
}

function randomLatency(): number {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort(): void {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function respond<T>(value: T, signal?: AbortSignal): Promise<T> {
  await delay(randomLatency(), signal)
  if (shouldFail) {
    throw new Error('Unable to reach the Spendly API. Check your connection and try again.')
  }
  return value
}

function applyQuery(query: TransactionQuery = {}): Transaction[] {
  const { search, categoryId, type, range = '30d', limit } = query

  // The window is the very same one the analytics report on, so a list and
  // the totals beside it always cover the same period.
  let result = transactionsInRange(range, new Date(), ledger)

  if (categoryId && categoryId !== 'all') {
    result = result.filter((transaction) => transaction.categoryId === categoryId)
  }

  if (type && type !== 'all') {
    result = result.filter((transaction) => transaction.type === type)
  }

  if (search) {
    const needle = search.trim().toLowerCase()
    if (needle.length > 0) {
      result = result.filter(
        (transaction) =>
          transaction.merchant.toLowerCase().includes(needle) ||
          transaction.categoryName.toLowerCase().includes(needle) ||
          transaction.note?.toLowerCase().includes(needle),
      )
    }
  }

  return typeof limit === 'number' ? result.slice(0, limit) : result
}

/** Builds a client transaction from a draft, mirroring the API's mapping. */
function fromDraft(draft: TransactionDraft, id: string): Transaction {
  const category = mockCategories.find((item) => item.id === draft.categoryId)

  const transaction: Transaction = {
    id,
    merchant: draft.merchant.trim(),
    categoryId: draft.categoryId,
    categoryName: category?.name ?? draft.categoryId,
    amount: draft.amount,
    type: draft.type,
    date: draft.date,
    status: draft.status,
    method: draft.method,
  }

  if (draft.note?.trim()) transaction.note = draft.note.trim()
  return transaction
}

export const mockApi: SpendlyApi = {
  getSummary(range, signal) {
    return respond(buildSummary(range, new Date(), ledger), signal)
  },
  getCashflow(range, interval, signal) {
    return respond(buildSeries(range, interval, new Date(), ledger), signal)
  },
  getCategoryBreakdown(range, signal) {
    return respond(buildCategoryBreakdown(range, new Date(), ledger), signal)
  },
  getTransactions(query, signal) {
    return respond(applyQuery(query), signal)
  },
  getBudgets(signal) {
    return respond(buildBudgets(new Date(), ledger, budgetLimits), signal)
  },
  getCategories(signal) {
    return respond(mockCategories, signal)
  },
  getTopMerchants(range, limit, signal) {
    return respond(buildTopMerchants(range, limit, new Date(), ledger), signal)
  },

  async createTransaction(draft) {
    const id = `txn_${String(ledger.length + 1).padStart(4, '0')}`
    const transaction = fromDraft(draft, id)

    await delay(randomLatency())
    if (shouldFail) {
      throw new Error('Unable to reach the Spendly API. Check your connection and try again.')
    }

    ledger = [transaction, ...ledger]
    return transaction
  },

  async updateTransaction(id, draft: TransactionDraftUpdate) {
    const index = ledger.findIndex((transaction) => transaction.id === id)

    await delay(randomLatency())
    if (shouldFail) {
      throw new Error('Unable to reach the Spendly API. Check your connection and try again.')
    }

    if (index === -1) {
      throw new Error(`No transaction found with id "${id}".`)
    }

    const existing = ledger[index]
    if (!existing) throw new Error(`No transaction found with id "${id}".`)

    const updated: Transaction = {
      ...existing,
      ...(draft.amount !== undefined ? { amount: draft.amount } : {}),
      ...(draft.type !== undefined ? { type: draft.type } : {}),
      ...(draft.categoryId !== undefined
        ? {
            categoryId: draft.categoryId,
            categoryName:
              mockCategories.find((item) => item.id === draft.categoryId)?.name ?? draft.categoryId,
          }
        : {}),
      ...(draft.merchant !== undefined ? { merchant: draft.merchant.trim() } : {}),
      ...(draft.date !== undefined ? { date: draft.date } : {}),
      ...(draft.method !== undefined ? { method: draft.method } : {}),
      ...(draft.status !== undefined ? { status: draft.status } : {}),
    }

    if (draft.note !== undefined) {
      if (draft.note.trim()) updated.note = draft.note.trim()
      else delete updated.note
    }

    ledger = ledger.map((transaction, position) => (position === index ? updated : transaction))
    return updated
  },

  async deleteTransaction(id) {
    await delay(randomLatency())
    if (shouldFail) {
      throw new Error('Unable to reach the Spendly API. Check your connection and try again.')
    }

    if (!ledger.some((transaction) => transaction.id === id)) {
      throw new Error(`No transaction found with id "${id}".`)
    }

    ledger = ledger.filter((transaction) => transaction.id !== id)
  },

  async createBudget(draft: BudgetDraft) {
    await delay(randomLatency())
    if (shouldFail) {
      throw new Error('Unable to reach the Spendly API. Check your connection and try again.')
    }

    const category = mockCategories.find((item) => item.id === draft.categoryId)
    if (!category) {
      throw new Error('category is not a known category')
    }

    const existing = budgetLimits.find((budget) => budget.categoryId === draft.categoryId)
    if (existing) {
      existing.limit = draft.limit
    } else {
      budgetLimits = [
        ...budgetLimits,
        {
          categoryId: draft.categoryId,
          name: category.name,
          limit: draft.limit,
          color: category.color,
        },
      ]
    }

    const created = buildBudgets(new Date(), ledger, budgetLimits).find(
      (budget) => budget.categoryId === draft.categoryId,
    )

    if (!created) {
      throw new Error('The budget could not be created.')
    }

    return created
  },
}
