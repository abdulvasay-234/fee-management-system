import { ChevronDown, Search } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'

export interface SearchableSelectOption {
  description?: string
  label: string
  value: string
}

interface SearchableSelectProps {
  error?: string
  hint?: string
  id?: string
  label: string
  legacyHint?: string
  loading?: boolean
  loadingText?: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  required?: boolean
  value: string
}

export function SearchableSelect({
  error,
  hint,
  id,
  label,
  legacyHint,
  loading = false,
  loadingText = 'Loading options...',
  onChange,
  options,
  placeholder = 'Search...',
  required = false,
  value,
}: SearchableSelectProps) {
  const generatedId = useId().replace(/:/g, '')
  const inputId = id ?? `searchable-select-${generatedId}`
  const messageId = `${inputId}-message`
  const listId = `${inputId}-options`
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selected = options.find((option) => option.value === value)
  const isLegacyValue = Boolean(value) && !selected
  const visibleValue = selected?.label ?? value
  const filtered = options.filter((option) => (
    `${option.label} ${option.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ))

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && filtered.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => index < 0 ? 0 : Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp' && filtered.length > 0) {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && isOpen && filtered[activeIndex]) {
      event.preventDefault()
      onChange(filtered[activeIndex].value)
      setQuery(filtered[activeIndex].label)
      setIsOpen(false)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setQuery(visibleValue)
    }
  }

  return (
    <div className="field searchable-select">
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <div className="searchable-select__control">
        <Search className="searchable-select__search-icon" aria-hidden="true" size={15} />
        <input
          aria-activedescendant={isOpen && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-describedby={error || legacyHint || hint ? messageId : undefined}
          aria-expanded={isOpen}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          className={`field__control searchable-select__input${error ? ' field__control--error' : ''}`}
          id={inputId}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(-1)
            setIsOpen(true)
          }}
          onFocus={(event) => {
            setQuery(visibleValue)
            setActiveIndex(-1)
            setIsOpen(true)
            event.currentTarget.select()
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? loadingText : placeholder}
          role="combobox"
          value={isOpen ? query : visibleValue}
        />
        <ChevronDown className="searchable-select__chevron" aria-hidden="true" size={16} />
        {isOpen && !loading && (
          <ul className="searchable-select__list" id={listId} role="listbox" aria-label={label}>
            {filtered.length > 0 ? filtered.map((option, index) => (
              <li key={option.value}>
                <button
                  aria-selected={option.value === value}
                  className={index === activeIndex ? 'is-active' : ''}
                  id={`${listId}-${index}`}
                  onClick={() => {
                    onChange(option.value)
                    setQuery(option.label)
                    setIsOpen(false)
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </button>
              </li>
            )) : <li className="searchable-select__empty">No matching options.</li>}
          </ul>
        )}
      </div>
      {error ? (
        <span className="field__message field__message--error" id={messageId}>{error}</span>
      ) : isLegacyValue ? (
        <span className="field__message searchable-select__legacy" id={messageId}>{legacyHint ?? `Current value “${value}” is not in the current options. Choose a replacement or leave it unchanged.`}</span>
      ) : hint ? (
        <span className="field__message" id={messageId}>{hint}</span>
      ) : null}
    </div>
  )
}