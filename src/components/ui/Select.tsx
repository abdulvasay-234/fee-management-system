import { ChevronDown } from 'lucide-react'
import type { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string
  error?: string
  hint?: string
  label: string
  leadingAdornment?: ReactNode
  options: SelectOption[]
}

export function Select({
  containerClassName = '',
  error,
  hint,
  id,
  label,
  leadingAdornment,
  options,
  className = '',
  required,
  ...props
}: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`
  const messageId = `${selectId}-message`

  return (
    <div className={`field${containerClassName ? ` ${containerClassName}` : ''}`}>
      <label className="field__label" htmlFor={selectId}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <span className={`field__select-wrap${leadingAdornment ? ' field__select-wrap--adorned' : ''}`}>
        {leadingAdornment && <span className="field__select-adornment">{leadingAdornment}</span>}
        <select
          aria-describedby={error || hint ? messageId : undefined}
          aria-invalid={Boolean(error)}
          className={`field__control field__select${error ? ' field__control--error' : ''}${className ? ` ${className}` : ''}`}
          id={selectId}
          required={required}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="field__select-icon"
          aria-hidden="true"
          size={17}
        />
      </span>
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