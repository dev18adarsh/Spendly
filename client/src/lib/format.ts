/**
 * Presentation helpers for money, percentages and dates.
 *
 * All values are plain numbers in the app's major currency unit (e.g. USD).
 *
 * Dates are rendered in the browser's own zone, which is the same zone the
 * reports are calculated in — see `lib/timezone.ts`.
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

/** Shown instead of a figure that cannot be rendered. */
export const EM_DASH = '—'

/** Whether a value is a usable number. */
export function isFiniteNumber(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** `$12,340.56` */
export function formatCurrency(value: number): string {
  if (!isFiniteNumber(value)) return EM_DASH
  return currencyFormatter.format(value)
}

/** `$12.3K` — used where space is tight (chart axes, dense tiles). */
export function formatCompactCurrency(value: number): string {
  if (!isFiniteNumber(value)) return EM_DASH
  return compactCurrencyFormatter.format(value)
}

/** `42.5%` */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH
  return `${value.toFixed(fractionDigits)}%`
}

/** `+12.4%` / `−3.1%` — always signed. */
export function formatSignedPercent(value: number, fractionDigits = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(fractionDigits)}%`
}

/** Turns anything into a date, or `null` when it is not a usable one. */
export function toDate(value: string | Date | undefined | null): Date | null {
  if (value === undefined || value === null) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `Mar 14` */
export function formatShortDate(value: string | Date): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** `Mar 14, 2026` */
export function formatMediumDate(value: string | Date): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * `Mar 1 – Mar 30, 2026` — the concrete span a report covers.
 *
 * The end of a window is exclusive, so it is shown as the moment the report
 * was taken rather than as a whole extra day.
 */
export function formatPeriodRange(from: string | Date, to: string | Date): string {
  const start = toDate(from)
  const end = toDate(to)
  if (!start || !end) return EM_DASH

  const sameYear = start.getFullYear() === end.getFullYear()
  const startText = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endText = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${startText} – ${endText}`
}

/** `14:32` */
export function formatTime(value: string | Date): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** `Just now`, `3h ago`, `Mar 14` — compact relative stamp for activity feeds. */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value)
  if (!date) return EM_DASH

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
