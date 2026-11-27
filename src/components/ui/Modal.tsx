import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button } from './Button'
import { useModalLifecycle } from '../../hooks/useModalLifecycle'

interface ModalProps {
  className?: string
  children: ReactNode
  description?: string
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title: string
}

export function Modal({
  className,
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const close = useModalLifecycle(open, onClose)

  if (!open) return null

  return (
    <div className={`modal${className ? ` ${className}` : ''}`} role="presentation" onMouseDown={close}>
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
            onClick={close}
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