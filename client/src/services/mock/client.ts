import {
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
  BudgetQuery,
  BudgetStatus,
  OverallBudget,
  OverallBudgetDraft,
  SpendlyApi,
  TransactionDraft,
  TransactionDraftUpdate,
  TransactionQuery,
} from '@/services/types'
import type { Budget, Transaction } from '@/types'

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

interface MockBudgetEntry {
  id: string
  categoryId: string
  name: string
  limit: number
  color: string
  month: number
  year: number
}

const currentNow = new Date()

/** The monthly budgets the demo build keeps in memory. */
let budgetLimits: MockBudgetEntry[] = mockBudgetLimits.map((budget) => ({
  id: `budget_${budget.categoryId}`,
  ...budget,
  month: currentNow.getMonth() + 1,
  year: currentNow.getFullYear(),
}))

interface MockOverallBudget {
  id: string
  limit: number
  month: number
  year: number
}

let overallBudgets: MockOverallBudget[] = [
  {
    id: 'overall_default',
    limit: 2500,
    month: currentNow.getMonth() + 1,
    year: currentNow.getFullYear(),
  },
]

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

function getPeriodDate(query?: BudgetQuery): { month: number; year: number } {
  const now = new Date()
  return {
    month: query?.month ?? now.getMonth() + 1,
    year: query?.year ?? now.getFullYear(),
  }
}

function calculateCategorySpendForMonth(month: number, year: number): Map<string, number> {
  const spendMap = new Map<string, number>()
  for (const t of ledger) {
    if (t.type !== 'expense') continue
    const date = new Date(t.date)
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) ?? 0) + t.amount)
    }
  }
  return spendMap
}

function calculateTotalSpendForMonth(month: number, year: number): number {
  let total = 0
  for (const t of ledger) {
    if (t.type !== 'expense') continue
    const date = new Date(t.date)
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      total += t.amount
    }
  }
  return Math.round(total * 100) / 100
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
  getBudgets(queryOrSignal, maybeSignal) {
    const query = queryOrSignal instanceof AbortSignal ? undefined : queryOrSignal
    const signal = queryOrSignal instanceof AbortSignal ? queryOrSignal : maybeSignal

    const { month, year } = getPeriodDate(query)
    const spentMap = calculateCategorySpendForMonth(month, year)

    const filtered = budgetLimits.filter((b) => b.month === month && b.year === year)

    const result: Budget[] = filtered.map((b) => {
      const spent = Math.round((spentMap.get(b.categoryId) ?? 0) * 100) / 100
      const remaining = Math.round((b.limit - spent) * 100) / 100
      const percentUsed =
        b.limit > 0 ? Math.round((spent / b.limit) * 1000) / 10 : spent > 0 ? 100 : 0
      const status: BudgetStatus =
        spent >= b.limit
          ? 'over'
          : b.limit > 0 && spent / b.limit >= 0.85
            ? 'approaching'
            : 'ok'

      return {
        id: b.id,
        categoryId: b.categoryId,
        name: b.name,
        limit: b.limit,
        spent,
        remaining,
        percentUsed,
        status,
        month: b.month,
        year: b.year,
        color: b.color,
        period: 'monthly',
      }
    })

    return respond(result, signal)
  },
  getOverallBudget(query, signal) {
    const { month, year } = getPeriodDate(query)
    const entry = overallBudgets.find((b) => b.month === month && b.year === year)
    if (!entry) return respond(null, signal)

    const spent = calculateTotalSpendForMonth(month, year)
    const remaining = Math.round((entry.limit - spent) * 100) / 100
    const percentUsed =
      entry.limit > 0 ? Math.round((spent / entry.limit) * 1000) / 10 : spent > 0 ? 100 : 0
    const status: BudgetStatus =
      spent >= entry.limit
        ? 'over'
        : entry.limit > 0 && spent / entry.limit >= 0.85
          ? 'approaching'
          : 'ok'

    const result: OverallBudget = {
      id: entry.id,
      limit: entry.limit,
      spent,
      remaining,
      percentUsed,
      status,
      month: entry.month,
      year: entry.year,
      period: 'monthly',
    }
    return respond(result, signal)
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

    const now = new Date()
    const month = draft.month ?? now.getMonth() + 1
    const year = draft.year ?? now.getFullYear()

    const existing = budgetLimits.find(
      (budget) =>
        budget.categoryId === draft.categoryId &&
        budget.month === month &&
        budget.year === year,
    )
    if (existing) {
      existing.limit = draft.limit
    } else {
      budgetLimits = [
        ...budgetLimits,
        {
          id: `budget_${draft.categoryId}_${year}_${month}`,
          categoryId: draft.categoryId,
          name: category.name,
          limit: draft.limit,
          color: category.color,
          month,
          year,
        },
      ]
    }

    const spentMap = calculateCategorySpendForMonth(month, year)
    const spent = Math.round((spentMap.get(draft.categoryId) ?? 0) * 100) / 100
    const remaining = Math.round((draft.limit - spent) * 100) / 100
    const percentUsed =
      draft.limit > 0 ? Math.round((spent / draft.limit) * 1000) / 10 : spent > 0 ? 100 : 0
    const status: BudgetStatus =
      spent >= draft.limit
        ? 'over'
        : draft.limit > 0 && spent / draft.limit >= 0.85
          ? 'approaching'
          : 'ok'

    return {
      id: existing?.id ?? `budget_${draft.categoryId}_${year}_${month}`,
      categoryId: draft.categoryId,
      name: category.name,
      limit: draft.limit,
      spent,
      remaining,
      percentUsed,
      status,
      month,
      year,
      color: category.color,
      period: 'monthly',
    }
  },

  async updateBudget(id: string, limit: number) {
    await delay(randomLatency())
    if (shouldFail) throw new Error('Unable to reach the Spendly API.')

    const existing = budgetLimits.find((b) => b.id === id)
    if (!existing) throw new Error(`No budget found with id "${id}".`)

    existing.limit = limit
    const spentMap = calculateCategorySpendForMonth(existing.month, existing.year)
    const spent = Math.round((spentMap.get(existing.categoryId) ?? 0) * 100) / 100
    const remaining = Math.round((limit - spent) * 100) / 100
    const percentUsed =
      limit > 0 ? Math.round((spent / limit) * 1000) / 10 : spent > 0 ? 100 : 0
    const status: BudgetStatus =
      spent >= limit ? 'over' : limit > 0 && spent / limit >= 0.85 ? 'approaching' : 'ok'

    return {
      ...existing,
      spent,
      remaining,
      percentUsed,
      status,
      period: 'monthly' as const,
    }
  },

  async deleteBudget(id: string) {
    await delay(randomLatency())
    if (shouldFail) throw new Error('Unable to reach the Spendly API.')
    budgetLimits = budgetLimits.filter((b) => b.id !== id)
  },

  async saveOverallBudget(draft: OverallBudgetDraft) {
    await delay(randomLatency())
    if (shouldFail) throw new Error('Unable to reach the Spendly API.')

    const now = new Date()
    const month = draft.month ?? now.getMonth() + 1
    const year = draft.year ?? now.getFullYear()

    const existing = overallBudgets.find((b) => b.month === month && b.year === year)
    if (existing) {
      existing.limit = draft.limit
    } else {
      overallBudgets = [
        ...overallBudgets,
        {
          id: `overall_${year}_${month}`,
          limit: draft.limit,
          month,
          year,
        },
      ]
    }

    const spent = calculateTotalSpendForMonth(month, year)
    const remaining = Math.round((draft.limit - spent) * 100) / 100
    const percentUsed =
      draft.limit > 0 ? Math.round((spent / draft.limit) * 1000) / 10 : spent > 0 ? 100 : 0
    const status: BudgetStatus =
      spent >= draft.limit
        ? 'over'
        : draft.limit > 0 && spent / draft.limit >= 0.85
          ? 'approaching'
          : 'ok'

    return {
      id: existing?.id ?? `overall_${year}_${month}`,
      limit: draft.limit,
      spent,
      remaining,
      percentUsed,
      status,
      month,
      year,
      period: 'monthly' as const,
    }
  },

  async deleteOverallBudget(query?: BudgetQuery) {
    await delay(randomLatency())
    if (shouldFail) throw new Error('Unable to reach the Spendly API.')

    const { month, year } = getPeriodDate(query)
    overallBudgets = overallBudgets.filter((b) => !(b.month === month && b.year === year))
  },
}
