import { cn } from '@/lib/cn'

export interface ProgressBarProps {
  /** Current value. */
  value: number
  /** Maximum value, defaults to 100. */
  max?: number
  tone?: 'brand' | 'positive' | 'negative' | 'warning'
  size?: 'sm' | 'md'
  className?: string
  label?: string
}

const toneClasses: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  brand: 'bg-brand',
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  size = 'md',
  className,
  label,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', toneClasses[tone])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
