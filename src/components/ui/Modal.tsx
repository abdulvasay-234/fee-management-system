import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { Button } from './Button'

interface ModalProps {
  children: ReactNode
  description?: string
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title: string
}

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <section
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>{title}</h2>
            {description && (
              <p className="modal__description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            iconOnly
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X aria-hidden="true" size={19} />
          </Button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </section>
    </div>
  )
}