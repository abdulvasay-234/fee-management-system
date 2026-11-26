import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface SearchableSelectOption {
  description?: string
  leadingAdornment?: ReactNode
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
  const controlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  
  const selected = options.find((option) => option.value === value)
  const isLegacyValue = Boolean(value) && !selected
  const visibleValue = selected?.label ?? value
  
  /* Show all options (no filtering - this is now a pure select dropdown) */
  const filtered = options

  // Calculate dropdown position based on input element
  useEffect(() => {
    if (!isOpen || !controlRef.current) return

    const rect = controlRef.current.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    
    setDropdownPosition({
      top: rect.bottom + scrollTop + 4,
      left: rect.left + scrollLeft,
      width: rect.width,
    })
  }, [isOpen])

  // Update dropdown position on scroll
  useEffect(() => {
    if (!isOpen) return
    
    function handleScroll() {
      if (!controlRef.current) return
      const rect = controlRef.current.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft
      
      setDropdownPosition({
        top: rect.bottom + scrollTop + 4,
        left: rect.left + scrollLeft,
        width: rect.width,
      })
    }
    
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen])

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return
    
    const activeButton = listRef.current.querySelector(`#${listId}-${activeIndex}`)
    if (activeButton) {
      activeButton.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, isOpen, listId])

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
      setIsOpen(false)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (controlRef.current && !controlRef.current.contains(event.target as Node) && listRef.current && !listRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, visibleValue])

  const dropdownElement = isOpen && !loading && (
    <ul
      ref={listRef}
      className="searchable-select__list"
      id={listId}
      role="listbox"
      aria-label={label}
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
      }}
    >
      {filtered.length > 0 ? filtered.map((option, index) => (
        <li key={option.value}>
          <button
            aria-selected={option.value === value}
            className={index === activeIndex ? 'is-active' : ''}
            id={`${listId}-${index}`}
            onClick={() => {
              onChange(option.value)
              setIsOpen(false)
            }}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            role="option"
            type="button"
          >
            <span className="searchable-select__option-label">{option.leadingAdornment}{option.label}</span>
            {option.description && <small>{option.description}</small>}
          </button>
        </li>
      )) : <li className="searchable-select__empty">No matching options.</li>}
    </ul>
  )

  return (
    <>
      <div className="field searchable-select">
        <label className="field__label" htmlFor={inputId}>
          {label}
          {required && <span className="field__required" aria-hidden="true">*</span>}
        </label>
        <div className={`searchable-select__control${selected?.leadingAdornment ? ' searchable-select__control--adorned' : ''}`} ref={controlRef}>
          {selected?.leadingAdornment && <span className="field__select-adornment">{selected.leadingAdornment}</span>}
          <input
            ref={inputRef}
            aria-activedescendant={isOpen && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="none"
            aria-controls={isOpen ? listId : undefined}
            aria-describedby={error || legacyHint || hint ? messageId : undefined}
            aria-expanded={isOpen}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className={`field__control searchable-select__input${error ? ' field__control--error' : ''}`}
            id={inputId}
            onBlur={() => {
              setIsOpen(false)
            }}
            onChange={() => {
              /* Prevent any typing - read-only select */
            }}
            onFocus={() => {
              setActiveIndex(-1)
              setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder={loading ? loadingText : placeholder}
            readOnly
            role="combobox"
            value={visibleValue}
          />
          
          {/* Chevron only interactive element */}
          <ChevronDown className="searchable-select__chevron" aria-hidden="true" size={16} />
        </div>
        
        {error ? (
          <span className="field__message field__message--error" id={messageId}>{error}</span>
        ) : isLegacyValue ? (
          <span className="field__message searchable-select__legacy" id={messageId}>{legacyHint ?? `Current value "${value}" is not in the current options. Choose a replacement or leave it unchanged.`}</span>
        ) : hint ? (
          <span className="field__message" id={messageId}>{hint}</span>
        ) : null}
      </div>
      
      {/* Render dropdown via portal to escape modal body overflow */}
      {dropdownElement && createPortal(dropdownElement, document.body)}
    </>
  )
}