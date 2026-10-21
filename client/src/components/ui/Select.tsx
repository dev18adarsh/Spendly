import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, containerClassName, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hasError = Boolean(error)

  return (
    <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
      {label ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-ink-muted">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={hasError || undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-control border bg-surface-2 pl-3 pr-9 text-sm text-ink',
            'transition-[border-color,background-color,box-shadow] duration-200 focus:outline-none focus:ring-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError
              ? 'border-negative/60 focus:border-negative/70 focus:ring-negative/20'
              : 'border-line hover:border-line-strong focus:border-brand/60 focus:ring-brand/20',
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface-2 text-ink">
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
})
