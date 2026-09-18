import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: 'neutral' | 'red' | 'yellow' | 'navy'
}

export function Badge({
  children,
  className = '',
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </span>
  )
}