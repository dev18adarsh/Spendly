import { cn } from '@/lib/cn'

export interface BrandMarkProps {
  className?: string
  /** Renders the wordmark next to the glyph. */
  withWordmark?: boolean
}

/** Spendly logotype: a mint spark line inside a rounded charcoal tile. */
export function BrandMark({ className, withWordmark = true }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-surface-2">
        <svg viewBox="0 0 32 32" className="size-5" role="img" aria-label="Spendly">
          <path
            d="M7 21.5c2.4-1.2 3.4-8.6 5.8-8.6 2.3 0 1.8 6.6 4 6.6 1.5 0 2.2-2.8 2.9-4.5"
            fill="none"
            stroke="currentColor"
            className="text-brand"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {withWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-ink">Spendly</span>
      ) : null}
    </span>
  )
}
