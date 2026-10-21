import { useMemo } from 'react'

import { api } from '@/services'
import type { DateRangeKey, IntervalKey } from '@/services/types'
import { useAsyncData } from './useAsyncData'
import { useCategories } from './useCategories'

/**
 * Loads every dataset the dashboard renders.
 * Each resource keeps its own status so cards can show skeletons
 * independently instead of blocking the whole page.
 *
 * Every request asks for the same reporting window, so the totals, the
 * charts and the transaction list always cover the same period.
 */
export function useDashboardData(range: DateRangeKey, interval: IntervalKey) {
  const summary = useAsyncData((signal) => api.getSummary(range, signal), [range])
  const cashflow = useAsyncData(
    (signal) => api.getCashflow(range, interval, signal),
    [range, interval],
  )
  const breakdown = useAsyncData((signal) => api.getCategoryBreakdown(range, signal), [range])
  const transactions = useAsyncData(
    (signal) => api.getTransactions({ range, limit: 6 }, signal),
    [range],
  )
  const budgets = useAsyncData((signal) => api.getBudgets(signal), [])
  const categories = useCategories()

  /**
   * The running balance of the window, as calculated by the server.
   *
   * The last point is the all-time balance — the net of every transaction
   * recorded before the window closed.
   */
  const balanceSeries = useMemo(
    () => (cashflow.data ?? []).map((point) => point.balance),
    [cashflow.data],
  )

  return {
    summary,
    cashflow,
    breakdown,
    transactions,
    budgets,
    categories,
    balanceSeries,
  }
}
