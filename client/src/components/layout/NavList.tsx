import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/cn'

import { navigation } from './navigation'

export interface NavListProps {
  /** Called after a link is activated (used to close the mobile drawer). */
  onNavigate?: () => void
  className?: string
}

/** Primary navigation links with an animated active indicator. */
export function NavList({ onNavigate, className }: NavListProps) {
  return (
    <nav aria-label="Primary" className={cn('flex flex-col gap-1', className)}>
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm',
              'transition-colors duration-200',
              isActive
                ? 'bg-surface-2 text-ink'
                : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-brand',
                  'transition-opacity duration-200',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <item.icon
                className={cn(
                  'size-4 shrink-0 transition-colors duration-200',
                  isActive ? 'text-brand' : 'text-ink-faint group-hover:text-ink-muted',
                )}
                aria-hidden="true"
              />
              <span className="truncate font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
