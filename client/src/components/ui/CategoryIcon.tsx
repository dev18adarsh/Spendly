import type { LucideIcon } from 'lucide-react'
import {
  Car,
  Circle,
  Clapperboard,
  HeartPulse,
  Home,
  Landmark,
  Repeat,
  ShoppingBag,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/cn'

const categoryIcons: Record<string, LucideIcon> = {
  Home,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Zap,
  HeartPulse,
  Clapperboard,
  Repeat,
  Landmark,
}

export interface CategoryIconProps {
  /** Icon key from the category record, e.g. `UtensilsCrossed`. */
  name: string
  className?: string
}

/** Resolves a category's icon key to a Lucide component. */
export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = categoryIcons[name] ?? Circle
  return <Icon className={cn('size-4', className)} aria-hidden="true" />
}
