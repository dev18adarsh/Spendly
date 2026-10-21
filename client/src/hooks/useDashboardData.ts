import { useMemo } from 'react'

import { api } from '@/services'
import type { DateRangeKey } from '@/services/types'
import { useAsyncData } from './useAsyncData'
import { useCategories } from './useCategories'

/**
 * Loads every dataset the dashboard renders.
 * Each resource keeps its own status so cards can show skeletons
 * independently instead of blocking the whole page.
 */
export function useDashboardData(range: DateRangeKey) {
  const summary = useAsyncData((signal) => api.getSummary(range, signal), [range])
  const cashflow = useAsyncData((signal) => api.getCashflow(range, signal), [range])
  const breakdown = useAsyncData((signal) => api.getCategoryBreakdown(range, signal), [range])
  const transactions = useAsyncData(
    (signal) => api.getTransactions({ range, limit: 6 }, signal),
    [range],
  )
  const budgets = useAsyncData((signal) => api.getBudgets(signal), [])
  const categories = useCategories()

  /**
   * Running balance derived from the cashflow series, anchored so the last
   * point matches the reported total balance.
   */
  const balanceSeries = useMemo(() => {
    const points = cashflow.data ?? []
    if (points.length < 2) return []

    const running: number[] = []
    let total = 0
    for (const point of points) {
      total += point.income - point.expenses
      running.push(total)
    }

    const balance = summary.data?.totalBalance ?? 0
    const lastValue = running[running.length - 1] ?? 0
    const offset = balance - lastValue

    return running.map((value) => value + offset)
  }, [cashflow.data, summary.data])

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
