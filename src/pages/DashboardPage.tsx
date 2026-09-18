import { DashboardOverview } from '../features/dashboard/DashboardOverview'

export function DashboardPage() {
  return (
    <section className="page page--dashboard">
      <header className="page__header">
        <span className="page__eyebrow">LSA WORKSPACE</span>
        <h1 className="page__title">Dashboard</h1>
        <p className="page__description">
          Overview of admissions, students, fee collections, and recent activity.
        </p>
      </header>
      <DashboardOverview />
    </section>
  )
}