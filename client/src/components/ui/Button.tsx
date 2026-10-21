import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:pointer-events-none disabled:opacity-45 active:translate-y-px'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-canvas shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] hover:bg-brand-soft ' +
    'hover:shadow-[0_8px_24px_-10px_rgba(53,214,164,0.6)]',
  secondary: 'bg-surface-3 text-ink hover:bg-surface-4 border border-line hover:border-line-strong',
  outline: 'border border-line text-ink-muted hover:text-ink hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-negative text-canvas hover:bg-negative/85',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Optional leading icon. */
  icon?: ReactNode
  /** Optional trailing icon. */
  trailingIcon?: ReactNode
  /** Renders a react-router `Link` instead of a `<button>`. */
  to?: string
  /** Stretches the element to the full width of its container. */
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    trailingIcon,
    to,
    block,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    block && 'w-full',
    className,
  )

  const content = (
    <>
      {icon}
      {children}
      {trailingIcon}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {content}
    </button>
  )
})
