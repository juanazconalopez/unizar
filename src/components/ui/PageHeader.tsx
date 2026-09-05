import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, subtitle, action }: {
  eyebrow: string
  title: string
  subtitle: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>
      {action}
    </header>
  )
}
