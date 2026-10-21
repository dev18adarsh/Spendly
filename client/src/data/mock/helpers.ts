/** Small helpers used to keep the sample data anchored to "today". */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A timestamp `days` days before now, at a stable local hour/minute. */
export function daysAgo(days: number, hour = 12, minute = 0): string {
  const base = new Date()
  base.setHours(hour, minute, 0, 0)
  return new Date(base.getTime() - days * DAY).toISOString()
}

/** A timestamp `hours` before now. */
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString()
}
