import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/ui'
import { CourseCodeFormModal } from '../features/courseCodes/CourseCodeFormModal'
import { CourseCodesManager } from '../features/courseCodes/CourseCodesManager'

export function CourseCodesPage() {
  const [isAdding, setIsAdding] = useState(false)
  const [revision, setRevision] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')

  return (
    <section className="page page--course-codes">
      <header className="course-codes-page-header">
        <div><span className="page__eyebrow">LSA WORKSPACE</span><h1 className="page__title">Course Codes</h1><p className="page__description">Manage course codes used for student admission numbers.</p></div>
        <Button onClick={() => setIsAdding(true)}><Plus aria-hidden="true" size={17} />Add Course</Button>
      </header>
      <CourseCodesManager key={revision} />
      {successMessage && <p className="course-code-success" role="status">{successMessage}</p>}
      {isAdding && <CourseCodeFormModal isInUse={false} onClose={() => setIsAdding(false)} onSaved={() => { setIsAdding(false); setRevision((value) => value + 1); setSuccessMessage('Course added successfully.') }} />}
    </section>
  )
}