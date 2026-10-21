/**
 * Small helpers for showing an account in the chrome.
 */

/**
 * The initials shown in an avatar.
 *
 * `Alex Doe` becomes `AD`, `Spendly` becomes `SP`.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()

  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''

  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}
