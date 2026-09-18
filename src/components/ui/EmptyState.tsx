import { PanelsTopLeft } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  action?: ReactNode
  description: string
  icon?: ReactNode
  title: string
}

export function EmptyState({
  action,
  className = '',
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ''}`} {...props}>
      <div className="empty-state__icon" aria-hidden="true">
        {icon ?? <PanelsTopLeft size={23} strokeWidth={1.8} />}
      </div>
      <div className="empty-state__copy">
        <h2 className="empty-state__title">{title}</h2>
        <p className="empty-state__description">{description}</p>
      </div>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}