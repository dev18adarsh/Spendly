import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/cn'

const controlClasses =
  'w-full rounded-control border bg-surface-2 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-[border-color,background-color,box-shadow] duration-200 ' +
  'focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50'

const controlTone = (hasError: boolean): string =>
  hasError
    ? 'border-negative/60 focus:border-negative/70 focus:ring-negative/20'
    : 'border-line hover:border-line-strong focus:border-brand/60 focus:ring-brand/20'

interface FieldChromeProps {
  id: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
}

function FieldChrome({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldChromeProps & { children: ReactNode }) {
  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-ink-muted">
          {label}
          {required ? <span className="ml-0.5 text-negative">*</span> : null}
        </label>
      ) : null}

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-negative">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  /** Icon rendered inside the field, before the text. */
  icon?: ReactNode
  /** Icon rendered at the trailing edge of the field. */
  trailing?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, trailing, className, containerClassName, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hasError = Boolean(error)

  return (
    <FieldChrome
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            {icon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(
            controlClasses,
            controlTone(hasError),
            'h-10 px-3',
            icon && 'pl-9',
            trailing && 'pr-9',
            className,
          )}
          {...props}
        />

        {trailing ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">{trailing}</span>
        ) : null}
      </div>
    </FieldChrome>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, required, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hasError = Boolean(error)

  return (
    <FieldChrome
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(controlClasses, controlTone(hasError), 'resize-y px-3 py-2.5', className)}
        {...props}
      />
    </FieldChrome>
  )
})
