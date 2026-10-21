/**
 * Timezone helpers for the browser.
 *
 * The browser knows which zone the user is in; the server does not. The
 * client therefore sends its IANA zone with every report and renders dates
 * in the same zone, so a transaction, its chart bucket and the totals it
 * contributes to always agree.
 */

/** The zone every report falls back to. */
export const DEFAULT_TIME_ZONE = 'UTC'

/**
 * The IANA zone of this browser.
 *
 * `UTC` is used when the runtime cannot name a zone, which is also what the
 * server falls back to — the two can never disagree.
 */
export function resolveClientTimeZone(): string {
  if (typeof Intl === 'undefined') return DEFAULT_TIME_ZONE

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && zone.length > 0 ? zone : DEFAULT_TIME_ZONE
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/* ------------------------------------------------------------------ */
/* Local calendar helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * The local start of the day an instant falls in.
 *
 * The `Date` constructor takes local calendar fields, so these helpers read
 * the user's own wall clock rather than UTC.
 */
export function startOfLocalDay(instant: Date): Date {
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate())
}

/** The local start of the month an instant falls in. */
export function startOfLocalMonth(instant: Date): Date {
  return new Date(instant.getFullYear(), instant.getMonth(), 1)
}

/** The local start of the year an instant falls in. */
export function startOfLocalYear(instant: Date): Date {
  return new Date(instant.getFullYear(), 0, 1)
}

/** The local start of the week an instant falls in — weeks start on Sunday. */
export function startOfLocalWeek(instant: Date): Date {
  const start = startOfLocalDay(instant)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay())
}

/** Adds days to a local calendar date, keeping the wall clock time. */
export function addLocalDays(instant: Date, days: number): Date {
  return new Date(
    instant.getFullYear(),
    instant.getMonth(),
    instant.getDate() + days,
    instant.getHours(),
    instant.getMinutes(),
    instant.getSeconds(),
    instant.getMilliseconds(),
  )
}

/** Adds months to a local calendar date, clamping the day of the month. */
export function addLocalMonths(instant: Date, months: number): Date {
  const year = instant.getFullYear()
  const month = instant.getMonth() + months
  const lastDay = new Date(year, month + 1, 0).getDate()

  return new Date(
    year,
    month,
    Math.min(instant.getDate(), lastDay),
    instant.getHours(),
    instant.getMinutes(),
    instant.getSeconds(),
    instant.getMilliseconds(),
  )
}

/** `YYYY-MM-DD` in local time. */
export function localDayKey(instant: Date): string {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`
}

/** `YYYY-MM` in local time. */
export function localMonthKey(instant: Date): string {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}`
}

/** `YYYY` in local time. */
export function localYearKey(instant: Date): string {
  return String(instant.getFullYear())
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
