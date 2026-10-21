import { cn } from '@/lib/cn'

export interface SkeletonProps {
  className?: string
}

/** Shimmering placeholder block used while data is loading. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-sheen rounded-md', className)}
      aria-hidden="true"
      data-testid="skeleton"
    />
  )
}

/** Multi-line skeleton for list rows. */
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 px-5 py-3.5', className)} aria-hidden="true">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-3.5 w-16" />
    </div>
  )
}
