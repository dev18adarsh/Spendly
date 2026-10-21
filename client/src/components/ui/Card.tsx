import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a lift + border highlight on hover. */
  interactive?: boolean
  /** Removes the default padding from the card body. */
  flush?: boolean
}

export function Card({ interactive, flush, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
        interactive && 'card-hover',
        // `overflow-clip` trims the rounded corners just like `overflow-hidden`
        // but, unlike it, does not turn the card into a scroll container — so
        // `position: sticky` children still stick to the viewport instead of
        // being offset by the card instead of the page.
        flush && 'overflow-clip',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /** Content aligned to the trailing edge of the header (filters, menus). */
  actions?: ReactNode
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-4', className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-ink-faint">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 pb-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Hairline divider that matches the card border colour. */
export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} aria-hidden="true" />
}

