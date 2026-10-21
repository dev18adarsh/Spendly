import type { Category } from '@/types'

/**
 * Sample category taxonomy. Once the API exposes categories these values are
 * replaced by the server response — the shape stays identical.
 */
export const mockCategories: Category[] = [
  { id: 'housing', name: 'Housing', color: '#60a5fa', icon: 'Home' },
  { id: 'food', name: 'Food & Dining', color: '#f2b544', icon: 'UtensilsCrossed' },
  { id: 'transport', name: 'Transport', color: '#a78bfa', icon: 'Car' },
  { id: 'shopping', name: 'Shopping', color: '#fb7185', icon: 'ShoppingBag' },
  { id: 'utilities', name: 'Utilities', color: '#2dd4bf', icon: 'Zap' },
  { id: 'health', name: 'Health', color: '#f472b6', icon: 'HeartPulse' },
  { id: 'entertainment', name: 'Entertainment', color: '#c084fc', icon: 'Clapperboard' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#38bdf8', icon: 'Repeat' },
  { id: 'income', name: 'Income', color: '#35d6a4', icon: 'Landmark' },
]
