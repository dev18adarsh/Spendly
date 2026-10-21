/**
 * Timezone helpers for reporting windows and calendar buckets.
 *
 * Spendly reports in the account's local timezone. The browser sends its
 * IANA zone (`Europe/Berlin`) with every analytics request; the server
 * validates it and falls back to UTC when it cannot be understood, so a
 * broken or hostile value can never break the aggregation.
 *
 * Everything here works on "wall clock" arithmetic: a local calendar moment
 * is converted into the UTC instant that corresponds to it in the target
 * zone. Day boundaries, week starts and month ends therefore land on the
 * right instant even when a daylight-saving change shifts the offset.
 *
 * The week starts on **Sunday**, which is the convention MongoDB's
 * `$dateTrunc` uses — the two must agree or a bucket would be split in two.
 */

export const DEFAULT_TIME_ZONE = 'UTC'

/** The calendar units a reporting bucket can use. */
export type CalendarUnit = 'day' | 'week' | 'month' | 'year'

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/** Whether the runtime understands the given IANA zone. */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * Normalises a client supplied timezone.
 *
 * Anything the runtime cannot parse becomes `UTC` — the server never trusts
 * the value, it only uses it to align calendar boundaries.
 */
export function resolveTimeZone(timeZone?: string | null): string {
  if (typeof timeZone !== 'string') return DEFAULT_TIME_ZONE

  const trimmed = timeZone.trim()
  if (!isValidTimeZone(trimmed)) return DEFAULT_TIME_ZONE

  return trimmed
}

/** The wall clock reading of an instant in a given zone. */
export interface ZonedParts {
  year: number
  /** 1–12. */
  month: number
  /** 1–31. */
  day: number
  hour: number
  minute: number
  second: number
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  formatterCache.set(timeZone, formatter)
  return formatter
}

/** Reads the wall clock of an instant in the given zone. */
export function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const values: Record<string, string> = {}

  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = part.value
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

/**
 * The offset of a zone at a given instant, in milliseconds.
 *
 * Positive east of Greenwich — `Asia/Kolkata` is `+5:30`.
 */
export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Converts a wall clock reading into the instant it happens at. */
function zonedTimeToUtc(parts: ZonedParts, timeZone: string): Date {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  // The first offset is the one in force at the guessed instant; the second
  // pass corrects the guess when it landed on the far side of a
  // daylight-saving change.
  const offset = getTimeZoneOffsetMs(new Date(guess), timeZone)
  const candidate = guess - offset
  const corrected = getTimeZoneOffsetMs(new Date(candidate), timeZone)

  return new Date(guess - corrected)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The start of the calendar unit that contains an instant.
 *
 * Weeks start on Sunday, matching MongoDB's `$dateTrunc`.
 */
export function zonedTruncate(instant: Date, unit: CalendarUnit, timeZone: string): Date {
  const parts = getZonedParts(instant, timeZone)
  const midnight: ZonedParts = { ...parts, hour: 0, minute: 0, second: 0 }

  if (unit === 'year') {
    return zonedTimeToUtc({ ...midnight, month: 1, day: 1 }, timeZone)
  }

  if (unit === 'month') {
    return zonedTimeToUtc({ ...midnight, day: 1 }, timeZone)
  }

  if (unit === 'week') {
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - weekday))

    return zonedTimeToUtc(
      {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    )
  }

  return zonedTimeToUtc(midnight, timeZone)
}

/**
 * Adds calendar units to an instant, staying on the local calendar.
 *
 * Adding a day across a daylight-saving change keeps the wall clock time,
 * so "tomorrow 09:00" really is tomorrow 09:00 rather than 08:00 or 10:00.
 */
export function zonedAdd(
  instant: Date,
  unit: CalendarUnit,
  amount: number,
  timeZone: string,
): Date {
  const parts = getZonedParts(instant, timeZone)

  if (unit === 'day' || unit === 'week') {
    const days = unit === 'week' ? amount * 7 : amount
    const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))

    return zonedTimeToUtc(
      {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second,
      },
      timeZone,
    )
  }

  if (unit === 'month') {
    const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1))
    const year = shifted.getUTCFullYear()
    const month = shifted.getUTCMonth() + 1

    return zonedTimeToUtc(
      {
        year,
        month,
        day: Math.min(parts.day, daysInMonth(year, month)),
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second,
      },
      timeZone,
    )
  }

  const year = parts.year + amount
  const day = parts.month === 2 && parts.day === 29 ? 28 : parts.day

  return zonedTimeToUtc({ year, month: parts.month, day, hour: parts.hour, minute: parts.minute, second: parts.second }, timeZone)
}

/** Formats an instant as a date in the given zone. */
export function formatZonedDate(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(instant)
}
