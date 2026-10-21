import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { cn } from '@/lib/cn'

export interface CategoryAvatarProps {
  /** Icon key from the category record. */
  icon: string
  /** Hex colour from the category record. */
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-8 rounded-[9px]',
  md: 'size-9 rounded-[10px]',
  lg: 'size-11 rounded-xl',
}

const iconSizes = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
}

/** Tinted square avatar for a spending category. */
export function CategoryAvatar({ icon, color, size = 'md', className }: CategoryAvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        color,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
      className={cn(
        'flex shrink-0 items-center justify-center',
        sizeClasses[size],
        iconSizes[size] && '',
        className,
      )}
    >
      <CategoryIcon name={icon} className={iconSizes[size]} />
    </span>
  )
}
