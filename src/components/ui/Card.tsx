import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  padded?: boolean
}

export function Card({
  children,
  className = '',
  padded = true,
  ...props
}: CardProps) {
  const classes = `card${padded ? ' card--padded' : ''}${className ? ` ${className}` : ''}`

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}