import { useEffect, useState } from 'react'

/**
 * Fired whenever a mutation has changed data on the server.
 *
 * Every view that caches server data listens for it, so the dashboard, the
 * transaction list, the budgets and the analytics all refresh right after a
 * write — without a page reload.
 */
export const DATA_CHANGED_EVENT = 'spendly:data-changed'

/** Tells the app that persisted data changed and cached views must refresh. */
export function notifyDataChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT))
}

/**
 * A counter that increases every time persisted data changes.
 *
 * Views include it in their effect dependencies, which makes them re-run
 * their fetch. The counter is monotonic so React always sees a change.
 */
export function useDataRevision(): number {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const onChanged = (): void => setRevision((value) => value + 1)

    window.addEventListener(DATA_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChanged)
  }, [])

  return revision
}
