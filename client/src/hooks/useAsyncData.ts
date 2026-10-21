import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export type AsyncStatus = 'loading' | 'success' | 'error'

export interface AsyncResult<T> {
  data: T | undefined
  error: Error | undefined
  status: AsyncStatus
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  /** Re-run the fetcher, keeping any previously loaded data visible. */
  refetch: () => void
}

interface AsyncState<T> {
  data?: T
  error?: Error
  status: AsyncStatus
}

/**
 * Run an async task and expose its lifecycle to the UI.
 *
 * The fetcher receives an `AbortSignal` that fires when the dependencies
 * change or the component unmounts, so stale responses are discarded.
 *
 * @param fetcher  Async task to run.
 * @param deps     Dependency list — must keep a stable length across renders.
 * @param options  `enabled: false` keeps the task dormant.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: { enabled?: boolean } = {},
): AsyncResult<T> {
  const { enabled = true } = options
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  // Keep the latest fetcher without making it part of the effect dependencies.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let active = true

    setState((previous) => ({ ...previous, status: 'loading', error: undefined }))

    fetcherRef.current(controller.signal).then(
      (data) => {
        if (!active) return
        setState({ data, status: 'success' })
      },
      (error: unknown) => {
        if (!active) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({
          error: error instanceof Error ? error : new Error('Something went wrong.'),
          status: 'error',
        })
      },
    )

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken, enabled])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    refetch,
  }
}
