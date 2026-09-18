import { EmptyState } from '../components/ui/EmptyState'

interface PagePlaceholderProps {
  description: string
  title: string
}

export function PagePlaceholder({ description, title }: PagePlaceholderProps) {
  return (
    <section className="page">
      <header className="page__header">
        <span className="page__eyebrow">LSA workspace</span>
        <h1 className="page__title">{title}</h1>
        <p className="page__description">{description}</p>
      </header>
      <EmptyState
        title="Ready when you are"
        description={`${title} data will appear here once this module is connected.`}
        aria-label={`${title} content area`}
      />
    </section>
  )
}