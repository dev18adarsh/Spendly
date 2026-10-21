import { zonedAdd, zonedTruncate, type CalendarUnit } from '../utils/timezone.js'
import { DEFAULT_TIME_ZONE } from '../utils/timezone.js'

/**
 * The reporting windows the API understands.
 *
 * A window is always a half-open interval: `[from, to)`. Every figure the
 * dashboard shows — totals, chart buckets, category shares and the
 * transaction list — is derived from the very same interval, so nothing can
 * be counted twice or fall through the cracks.
 */
export const RANGE_KEYS = ['7d', '30d', '90d', '12m', '3y'] as const

export type RangeKey = (typeof RANGE_KEYS)[number]

/** The bucket sizes a trend series can be grouped by. */
export const INTERVAL_KEYS = ['day', 'week', 'month', 'year'] as const

export type IntervalKey = (typeof INTERVAL_KEYS)[number]

/** How many days the day-based windows cover. */
export const RANGE_DAYS: Partial<Record<RangeKey, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** How many calendar months the month-based windows cover. */
export const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
  '12m': 12,
  '3y': 36,
}

/** Human readable name of every window. */
export const RANGE_LABELS: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  '3y': 'Last 3 years',
}

/** The bucket size a window falls back to when the client does not pick one. */
export const DEFAULT_INTERVAL: Record<RangeKey, IntervalKey> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'month',
  '3y': 'year',
}

/**
 * The bucket sizes that make sense for a window.
 *
 * A seven day window cannot be read per year, and a three year window is
 * unreadable per day, so the selector only offers what fits.
 */
export const INTERVALS_BY_RANGE: Record<RangeKey, IntervalKey[]> = {
  '7d': ['day', 'week'],
  '30d': ['day', 'week', 'month'],
  '90d': ['week', 'month'],
  '12m': ['month', 'year'],
  '3y': ['month', 'year'],
}

export function isRangeKey(value: string): value is RangeKey {
  return Object.prototype.hasOwnProperty.call(RANGE_LABELS, value)
}

export function isIntervalKey(value: string): value is IntervalKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_INTERVAL, value)
}

export interface ResolvedRange {
  key: RangeKey
  /** Inclusive start of the window. */
  from: Date
  /** Exclusive end of the window. */
  to: Date
  /** Length of the window in milliseconds. */
  durationMs: number
  /** How many local calendar days the window covers, both ends included. */
  days: number
  /**
   * Inclusive start of the window that immediately precedes this one.
   *
   * It is shifted back by a calendar step rather than by the same number of
   * milliseconds, so the comparison window is itself a whole window instead
   * of one that begins in the middle of a day.
   */
  previousFrom: Date
  /** The zone the boundaries were calculated in. */
  timeZone: string
  /** Human readable name of the window. */
  label: string
}

/**
 * How many local calendar days a window covers.
 *
 * Counting milliseconds instead would be wrong twice over: a window always
 * opens at local midnight, and the day it closes on may be shorter or longer
 * than 24 hours when the zone changes its offset. Truncating both ends to
 * their local day and counting the whole days between them reads the
 * calendar rather than the clock, so "last 30 days" always answers 30.
 */
function countLocalDays(from: Date, to: Date, timeZone: string): number {
  const dayMs = 24 * 60 * 60 * 1000
  const first = zonedTruncate(from, 'day', timeZone)
  const last = zonedTruncate(to, 'day', timeZone)
  return Math.max(1, Math.round((last.getTime() - first.getTime()) / dayMs) + 1)
}

/**
 * Resolves a reporting window against a point in time.
 *
 * Day-based windows start at local midnight `days - 1` days ago, so
 * "last 7 days" is today plus the six days before it. Month-based windows
 * start on the first of the month `months - 1` months ago.
 */
export function resolveRange(
  key: RangeKey,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): ResolvedRange {
  const months = RANGE_MONTHS[key]
  const days = RANGE_DAYS[key]
  let from: Date

  if (months) {
    const monthStart = zonedTruncate(now, 'month', timeZone)
    from = zonedTruncate(zonedAdd(monthStart, 'month', -(months - 1), timeZone), 'month', timeZone)
  } else {
    const size = days ?? 30
    const dayStart = zonedTruncate(now, 'day', timeZone)
    from = zonedAdd(dayStart, 'day', -(size - 1), timeZone)
  }

  // The window before this one is one calendar step back: `months` whole
  // months, or `days` whole days — never a rounded number of hours.
  const previousFrom = months
    ? zonedAdd(from, 'month', -months, timeZone)
    : zonedAdd(from, 'day', -(days ?? 30), timeZone)

  return {
    key,
    from,
    to: now,
    durationMs: now.getTime() - from.getTime(),
    days: countLocalDays(from, now, timeZone),
    previousFrom,
    timeZone,
    label: RANGE_LABELS[key],
  }
}

/** One bucket of a trend series. */
export interface BucketDescriptor {
  /** Stable calendar key, e.g. `2026-03-08` or `2026-03`. */
  key: string
  /** Compact axis label, e.g. `8`. */
  label: string
  /** Long label used in tooltips, e.g. `Week of Mar 8, 2026`. */
  fullLabel: string
  /** The instant the bucket starts at. */
  start: Date
}

/** The `$dateToString` format that matches a bucket's calendar key. */
export const KEY_FORMAT: Record<IntervalKey, string> = {
  day: '%Y-%m-%d',
  week: '%Y-%m-%d',
  month: '%Y-%m',
  year: '%Y',
}

/**
 * The calendar buckets that cover a window.
 *
 * The list is always complete: a window with no activity still produces one
 * bucket per day, week, month or year, so a chart never silently skips a
 * period.
 */
export function buildBuckets(range: ResolvedRange, unit: IntervalKey): BucketDescriptor[] {
  const calendarUnit: CalendarUnit = unit
  const buckets: BucketDescriptor[] = []

  let cursor = zonedTruncate(range.from, calendarUnit, range.timeZone)

  while (cursor.getTime() <= range.to.getTime()) {
    buckets.push(describeBucket(cursor, unit, range.timeZone))
    cursor = zonedAdd(cursor, calendarUnit === 'week' ? 'day' : calendarUnit, calendarUnit === 'week' ? 7 : 1, range.timeZone)
  }

  return buckets
}

function describeBucket(start: Date, unit: IntervalKey, timeZone: string): BucketDescriptor {
  if (unit === 'year') {
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(start)
    return { key: year, label: year, fullLabel: year, start }
  }

  if (unit === 'month') {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      timeZone,
    }).formatToParts(start)
    const values: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value
    }

    const longMonth = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(start)

    const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone }).format(start)

    return {
      key: `${values.year}-${values.month}`,
      label: shortMonth,
      fullLabel: longMonth,
      start,
    }
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(start)
  const values: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value
  }

  const key = `${values.year}-${values.month}-${values.day}`
  const day = Number(values.day)
  const isFirstOfMonth = day === 1

  if (unit === 'week') {
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(start)

    return {
      key,
      label,
      fullLabel: `Week of ${new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      }).format(start)}`,
      start,
    }
  }

  const longDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(start)

  return {
    key,
    label: isFirstOfMonth ? shortDateWithZone(start, timeZone) : String(day),
    fullLabel: longDate,
    start,
  }
}

function shortDateWithZone(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(start)
}
