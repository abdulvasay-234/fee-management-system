import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  iconOnly?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  className = '',
  iconOnly = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = [
    'button',
    variant === 'secondary' && 'button--secondary',
    iconOnly && 'button--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  )
}