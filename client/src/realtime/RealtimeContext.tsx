import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io as ioClient, type Socket } from 'socket.io-client'

import { useAuth } from '@/auth/AuthContext'
import { config } from '@/config/env'
import { notifyDataChanged } from '@/hooks/useDataRevision'

import {
  RealtimeEvents,
  type TransactionCreatedPayload,
  type TransactionDeletedPayload,
  type TransactionUpdatedPayload,
} from './events'

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

export interface RealtimeContextValue {
  status: RealtimeStatus
  isConnected: boolean
  socket: Socket | null
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

const MAX_SEEN_EVENTS = 500
const seenEventIds = new Set<string>()

function isDuplicateEvent(eventId: string | undefined): boolean {
  if (!eventId) return false
  if (seenEventIds.has(eventId)) return true

  seenEventIds.add(eventId)
  if (seenEventIds.size > MAX_SEEN_EVENTS) {
    const first = seenEventIds.values().next().value
    if (first) seenEventIds.delete(first)
  }
  return false
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const socketRef = useRef<Socket | null>(null)
  const hasConnectedOnceRef = useRef(false)

  const isDemo = config.dataSource !== 'api'

  useEffect(() => {
    // In mock/demo mode without a real backend API, simulate connected state
    if (isDemo) {
      setStatus('connected')
      return
    }

    // Only connect when user is actively authenticated
    if (authStatus !== 'authenticated' || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setStatus('disconnected')
      hasConnectedOnceRef.current = false
      return
    }

    setStatus('connecting')

    const socketUrl = config.socketUrl
    const socket = ioClient(socketUrl ?? undefined, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    })

    socketRef.current = socket

    const onConnect = () => {
      setStatus('connected')
      if (hasConnectedOnceRef.current) {
        // Recover state from REST API upon reconnecting
        notifyDataChanged()
      }
      hasConnectedOnceRef.current = true
    }

    const onDisconnect = (reason: string) => {
      if (reason === 'io client disconnect') {
        setStatus('disconnected')
      } else {
        setStatus('connecting')
      }
    }

    const onConnectError = () => {
      setStatus('connecting')
    }

    const onReconnectAttempt = () => {
      setStatus('reconnecting')
    }

    const handleCreated = (payload: TransactionCreatedPayload) => {
      if (isDuplicateEvent(payload?.eventId)) return
      notifyDataChanged()
    }

    const handleUpdated = (payload: TransactionUpdatedPayload) => {
      if (isDuplicateEvent(payload?.eventId)) return
      notifyDataChanged()
    }

    const handleDeleted = (payload: TransactionDeletedPayload) => {
      if (isDuplicateEvent(payload?.eventId)) return
      notifyDataChanged()
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.io.on('reconnect_attempt', onReconnectAttempt)

    // Listen for transaction events (both hyphen and colon naming styles)
    socket.on(RealtimeEvents.TRANSACTION_CREATED, handleCreated)
    socket.on('transaction:created', handleCreated)

    socket.on(RealtimeEvents.TRANSACTION_UPDATED, handleUpdated)
    socket.on('transaction:updated', handleUpdated)

    socket.on(RealtimeEvents.TRANSACTION_DELETED, handleDeleted)
    socket.on('transaction:deleted', handleDeleted)

    return () => {
      // Proper cleanup of listeners and disconnect on unmount / user change
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off(RealtimeEvents.TRANSACTION_CREATED, handleCreated)
      socket.off('transaction:created', handleCreated)
      socket.off(RealtimeEvents.TRANSACTION_UPDATED, handleUpdated)
      socket.off('transaction:updated', handleUpdated)
      socket.off(RealtimeEvents.TRANSACTION_DELETED, handleDeleted)
      socket.off('transaction:deleted', handleDeleted)

      socket.disconnect()
      socketRef.current = null
    }
  }, [authStatus, user, isDemo])

  const contextValue = useMemo<RealtimeContextValue>(
    () => ({
      status,
      isConnected: status === 'connected',
      socket: socketRef.current,
    }),
    [status],
  )

  return <RealtimeContext.Provider value={contextValue}>{children}</RealtimeContext.Provider>
}

/** Hook to consume realtime synchronization state */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) {
    return {
      status: 'disconnected',
      isConnected: false,
      socket: null,
    }
  }
  return context
}

/** Visual connection status indicator component */
export function RealtimeStatusIndicator() {
  const { status } = useRealtime()

  if (status === 'connected') {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 transition-colors dark:text-emerald-400"
        title="Real-time synchronization connected (Socket.IO)"
        aria-label="Real-time status: Live"
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">Live</span>
      </div>
    )
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 transition-colors dark:text-amber-400"
        title="Connecting to real-time synchronization server..."
        aria-label="Real-time status: Connecting"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        <span className="hidden sm:inline">Syncing…</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-faint transition-colors"
      title="Real-time synchronization offline"
      aria-label="Real-time status: Offline"
    >
      <span className="size-1.5 rounded-full bg-ink-faint" />
      <span className="hidden sm:inline">Offline</span>
    </div>
  )
}
