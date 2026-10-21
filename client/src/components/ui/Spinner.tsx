import { cn } from '@/lib/cn'

export interface SpinnerProps {
  className?: string
  /** Accessible label announced while loading. */
  label?: string
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex', className)}>
      <svg
        className="size-4 animate-spin text-ink-faint"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}
