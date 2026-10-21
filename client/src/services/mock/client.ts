import {
  buildBudgets,
  buildCategoryBreakdown,
  buildSeries,
  buildSummary,
  buildTopMerchants,
  mockCategories,
  mockTransactions,
  rangeDays,
} from '@/data/mock'
import type { SpendlyApi, TransactionQuery } from '@/services/types'

/**
 * Mock implementation of the Spendly API.
 *
 * It mimics the latency and failure modes of a real network so the UI's
 * loading and error states can be exercised before the server exists.
 * Nothing here writes or persists anything.
 */

const MIN_LATENCY_MS = 280
const MAX_LATENCY_MS = 720

let shouldFail = false

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

function applyQuery(query: TransactionQuery = {}): typeof mockTransactions {
  const { search, categoryId, type, range = '30d', limit } = query

  let result = mockTransactions

  if (range !== '12m') {
    const cutoff = Date.now() - rangeDays[range] * 24 * 60 * 60 * 1000
    result = result.filter((transaction) => new Date(transaction.date).getTime() >= cutoff)
  }

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

export const mockApi: SpendlyApi = {
  getSummary(range, signal) {
    return respond(buildSummary(range), signal)
  },
  getCashflow(range, signal) {
    return respond(buildSeries(range), signal)
  },
  getCategoryBreakdown(range, signal) {
    return respond(buildCategoryBreakdown(range), signal)
  },
  getTransactions(query, signal) {
    return respond(applyQuery(query), signal)
  },
  getBudgets(signal) {
    return respond(buildBudgets(), signal)
  },
  getCategories(signal) {
    return respond(mockCategories, signal)
  },
  getTopMerchants(range, limit, signal) {
    return respond(buildTopMerchants(range, limit), signal)
  },
}
