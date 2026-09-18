import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string
  error?: string
  hint?: string
  label: string
}

export function Textarea({
  containerClassName = '',
  error,
  hint,
  id,
  label,
  className = '',
  required,
  ...props
}: TextareaProps) {
  const textareaId = id ?? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`
  const messageId = `${textareaId}-message`

  return (
    <div className={`field${containerClassName ? ` ${containerClassName}` : ''}`}>
      <label className="field__label" htmlFor={textareaId}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <textarea
        aria-describedby={error || hint ? messageId : undefined}
        aria-invalid={Boolean(error)}
        className={`field__control field__textarea${error ? ' field__control--error' : ''}${className ? ` ${className}` : ''}`}
        id={textareaId}
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