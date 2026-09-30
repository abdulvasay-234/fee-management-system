import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { StudentsDirectory } from '../features/students/StudentsDirectory'

export function StudentsPage() {
  const navigate = useNavigate()

  return (
    <section className="page page--students">
      <header className="students-page-header">
        <div>
          <span className="page__eyebrow">LSA WORKSPACE</span>
          <h1 className="page__title">Admissions</h1>
          <p className="page__description">
            Manage admissions, student details, and outstanding fee balances.
          </p>
        </div>
        <Button onClick={() => navigate('/new-admission')}>
          <Plus aria-hidden="true" size={17} />
          Add Admission
        </Button>
      </header>
      <StudentsDirectory />
    </section>
  )
}