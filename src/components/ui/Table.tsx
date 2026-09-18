import type { ReactNode, TableHTMLAttributes } from 'react'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={`table${className ? ` ${className}` : ''}`} {...props}>
        {children}
      </table>
    </div>
  )
}