import { AdmissionForm } from '../features/admissions/AdmissionForm'
import { WorkflowProgress } from '../features/workflow/WorkflowProgress'

export function NewAdmissionPage() {
  return (
    <section className="page page--admission">
      <header className="page__header">
        <span className="page__eyebrow">LSA WORKSPACE</span>
        <h1 className="page__title">New Admission</h1>
        <p className="page__description">
          Register a new student and create their official LSA admission record.
        </p>
      </header>
      <WorkflowProgress current="admission" />
      <AdmissionForm />
    </section>
  )
}