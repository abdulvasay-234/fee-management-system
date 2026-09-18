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
          <h1 className="page__title">Students</h1>
          <p className="page__description">
            Manage registered students, course details, and fee information.
          </p>
        </div>
        <Button onClick={() => navigate('/new-admission')}>
          <Plus aria-hidden="true" size={17} />
          Add New Student
        </Button>
      </header>
      <StudentsDirectory />
    </section>
  )
}