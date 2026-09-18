import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
  error?: string
  hint?: string
  label: string
}

export function Input({
  containerClassName = '',
  error,
  hint,
  id,
  label,
  className = '',
  required,
  ...props
}: InputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`
  const messageId = `${inputId}-message`

  return (
    <div className={`field${containerClassName ? ` ${containerClassName}` : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <input
        aria-describedby={error || hint ? messageId : undefined}
        aria-invalid={Boolean(error)}
        className={`field__control${error ? ' field__control--error' : ''}${className ? ` ${className}` : ''}`}
        id={inputId}
        required={required}
        {...props}
      />
      {(error || hint) && (
        <span
          className={`field__message${error ? ' field__message--error' : ''}`}
          id={messageId}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  )
}