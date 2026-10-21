import { AlertTriangle, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  description?: string
  /** Called when the user asks to try again. */
  onRetry?: () => void
  className?: string
}

/** Shown when a request fails. Always explains what happened and what to do. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this data. Check your connection and try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full border border-negative/25 bg-negative/10 text-negative">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-ink-faint">{description}</p>
      </div>

      {onRetry ? (
        <Button variant="outline" size="sm" icon={<RefreshCw className="size-3.5" aria-hidden="true" />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
