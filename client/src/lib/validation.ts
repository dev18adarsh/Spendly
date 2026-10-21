/**
 * Client-side validation for the transaction form.
 *
 * The rules mirror the API's `transaction.validator.ts` so the browser can
 * reject bad input before a request is made. The server stays the authority —
 * this is a convenience, not a replacement.
 */

/** The largest amount a single transaction may carry. */
export const MAX_AMOUNT = 1_000_000

/** Longest description the API accepts. */
export const MAX_DESCRIPTION_LENGTH = 200

/** Longest note the API accepts. */
export const MAX_NOTE_LENGTH = 500

/**
 * Parses an amount typed into a text field.
 *
 * Accepts a comma as the decimal separator so a European keyboard works
 * without a second input mode. Returns `null` when the text is not a valid
 * amount.
 */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Validates the amount field. Returns the problem, or `undefined` when valid. */
export function validateAmount(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return 'Enter an amount.'

  const normalized = trimmed.replace(',', '.')
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized)
  if (!match) return 'Use numbers only, for example 24.99.'

  const decimals = match[2] ?? ''
  if (decimals.length > 2) return 'Use at most 2 decimal places.'

  const value = Number(normalized)
  if (!Number.isFinite(value)) return 'Use numbers only, for example 24.99.'
  if (value <= 0) return 'Amount must be greater than 0.'
  if (value > MAX_AMOUNT) return 'Amount is too large.'

  return undefined
}

/** Validates the description (the required headline of an entry). */
export function validateDescription(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return 'Enter a description.'
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return `Keep it under ${MAX_DESCRIPTION_LENGTH} characters.`
  }
  return undefined
}

/** Validates the optional note. */
export function validateNote(raw: string): string | undefined {
  if (raw.trim().length > MAX_NOTE_LENGTH) {
    return `Keep it under ${MAX_NOTE_LENGTH} characters.`
  }
  return undefined
}

/** Validates that a date was picked and that it is a real one. */
export function validateDate(raw: string): string | undefined {
  if (!raw) return 'Pick a date.'
  if (Number.isNaN(new Date(raw).getTime())) return 'Pick a valid date.'
  return undefined
}

/** Formats an ISO timestamp as the `yyyy-mm-dd` a date input expects. */
export function toDateInputValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Turns a `yyyy-mm-dd` value into an ISO timestamp.
 *
 * The time is pinned to local noon so the date never slips to the previous
 * or next day when it is rendered in another time zone.
 */
export function toIsoFromDateInput(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
