/**
 * Presentation helpers for money, percentages and dates.
 * All values are plain numbers in the app's major currency unit (e.g. USD).
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** `$12,340.56` */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

/** `$12.3K` — used where space is tight (chart axes, dense tiles). */
export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value)
}

/** `42.5%` */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** `+12.4%` / `−3.1%` — always signed. */
export function formatSignedPercent(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(fractionDigits)}%`
}

/** `Mar 14` */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** `Mar 14, 2026` */
export function formatMediumDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** `14:32` */
export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** `Just now`, `3h ago`, `Mar 14` — compact relative stamp for activity feeds. */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return formatShortDate(date)
}
