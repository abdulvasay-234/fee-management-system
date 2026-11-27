import { DashboardOverview } from '../features/dashboard/DashboardOverview'

export function DashboardPage() {
  return (
    <section className="page page--dashboard">
      <header className="page__header">
        <h1 className="page__title">Dashboard</h1>
        <p className="page__description">
          Welcome to your academy workspace.
        </p>
      </header>
      <DashboardOverview />
    </section>
  )
}