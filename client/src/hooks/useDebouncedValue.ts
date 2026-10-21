import { useEffect, useState } from 'react'

/**
 * Returns the value once it has stopped changing for `delay` milliseconds.
 *
 * Used for the search field, so a request is only sent after the user pauses
 * instead of on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
