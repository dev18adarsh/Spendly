import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

import { cn } from '@/lib/cn'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

interface ToastContextValue {
  /** Shows a toast. Errors stay until they are dismissed. */
  notify: (toast: Omit<Toast, 'id'>) => void
  /** Convenience wrapper for a success message. */
  success: (title: string, description?: string) => void
  /** Convenience wrapper for an error message. */
  error: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** How long a non-error toast stays on screen. */
const AUTO_DISMISS_MS = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const notify = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current
      nextId.current += 1

      setToasts((current) => [...current.slice(-3), { ...toast, id }])

      if (toast.tone !== 'error') {
        const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  // Clear pending timers when the provider unmounts.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, description) => notify({ tone: 'success', title, description }),
      error: (title, description) => notify({ tone: 'error', title, description }),
    }),
    [notify],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/** Shows toast messages. Must be used inside a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>.')
  }
  return context
}

interface ToastViewportProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

/** Fixed stack of toast messages, anchored to the bottom of the viewport. */
function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  )
}

const toneStyles: Record<ToastTone, { badge: string; icon: ReactNode }> = {
  success: {
    badge: 'border-positive/30 bg-positive/10 text-positive',
    icon: <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />,
  },
  error: {
    badge: 'border-negative/30 bg-negative/10 text-negative',
    icon: <AlertCircle className="size-4 shrink-0" aria-hidden="true" />,
  },
  info: {
    badge: 'border-info/30 bg-info/10 text-info',
    icon: <Info className="size-4 shrink-0" aria-hidden="true" />,
  },
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const tone = toneStyles[toast.tone]

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-surface-2/95 p-3.5 shadow-pop backdrop-blur animate-scale-in"
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border',
          tone.badge,
        )}
      >
        {tone.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{toast.description}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded-control p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
