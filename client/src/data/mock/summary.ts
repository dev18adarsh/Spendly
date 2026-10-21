/**
 * Monthly spend limits per category. `spent` is derived from the ledger so
 * budgets and transactions always agree.
 *
 * Everything else the dashboard shows — totals, balances, changes, chart
 * buckets — is calculated from the ledger itself; nothing is invented here.
 */
export const mockBudgetLimits: Array<{
  categoryId: string
  name: string
  limit: number
  color: string
}> = [
  { categoryId: 'housing', name: 'Housing', limit: 3500, color: '#60a5fa' },
  { categoryId: 'food', name: 'Food & Dining', limit: 900, color: '#f2b544' },
  { categoryId: 'shopping', name: 'Shopping', limit: 1000, color: '#fb7185' },
  { categoryId: 'transport', name: 'Transport', limit: 600, color: '#a78bfa' },
  { categoryId: 'utilities', name: 'Utilities', limit: 450, color: '#2dd4bf' },
  { categoryId: 'health', name: 'Health', limit: 300, color: '#f472b6' },
  { categoryId: 'subscriptions', name: 'Subscriptions', limit: 120, color: '#38bdf8' },
  { categoryId: 'entertainment', name: 'Entertainment', limit: 250, color: '#c084fc' },
]
