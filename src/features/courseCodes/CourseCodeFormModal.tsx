import { AlertTriangle, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '../../components/ui'
import {
  addCourseCode,
  getNextAvailableCourseCode,
  isSystemCourseCode,
  updateCourseCode,
  validateCourseCodeInput,
} from './courseCodeService'
import type { CourseCode, CourseCodeInput } from './courseCodeTypes'

interface CourseCodeFormModalProps {
  course?: CourseCode
  isInUse: boolean
  onClose: () => void
  onSaved: () => void
}

export function CourseCodeFormModal({
  course,
  isInUse,
  onClose,
  onSaved,
}: CourseCodeFormModalProps) {
  const suggestedCode = getNextAvailableCourseCode()
  const noCodesAvailable = !course && !suggestedCode
  const [formData, setFormData] = useState<CourseCodeInput>({
    code: course?.code ?? suggestedCode,
    name: course?.name ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof CourseCodeInput, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field: keyof CourseCodeInput, value: string) {
    const nextValue = field === 'code' ? value.replace(/\D/g, '').slice(0, 2) : value
    setFormData((current) => ({ ...current, [field]: nextValue }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateCourseCodeInput(formData, course?.id)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError('')
    setIsSaving(true)
    try {
      if (course) await updateCourseCode(course.id, formData)
      else await addCourseCode(formData)
      onSaved()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the course code.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={course ? 'Edit course code' : 'Add course'}
      description={course ? 'Review changes carefully before saving.' : 'Create a regular course code for admission numbers.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="course-code-form" disabled={noCodesAvailable || isSaving}>{isSaving ? 'Saving...' : course ? 'Save Changes' : 'Add Course'}</Button>
        </>
      }
    >
      <form className="course-code-form" id="course-code-form" onSubmit={handleSubmit} noValidate>
        {(isInUse || (course ? isSystemCourseCode(course) : false)) && (
          <div className="course-code-warning" role="note">
            <AlertTriangle aria-hidden="true" size={18} />
            <p>This course code is already associated with student admission numbers. Changing it may affect existing records.</p>
          </div>
        )}
        <Input id="courseCodeName" label="Course Name" required value={formData.name} error={errors.name} onChange={(event) => updateField('name', event.target.value)} />
        <Input id="courseCodeValue" label="Course Code" required inputMode="numeric" maxLength={2} value={formData.code} disabled={Boolean(course)} error={errors.code} hint={course ? 'Course codes cannot be changed after creation.' : 'Exactly two numeric digits from 01 to 99.'} onChange={(event) => updateField('code', event.target.value)} />
        {!course && suggestedCode && (
          <button className="course-code-suggestion" type="button" onClick={() => updateField('code', getNextAvailableCourseCode())}>
            <Sparkles aria-hidden="true" size={15} />
            Suggested next code: {suggestedCode}
          </button>
        )}
        {noCodesAvailable && (
          <div className="course-code-warning" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            <p>No regular course codes are available. All codes from 01 to 99 are already assigned.</p>
          </div>
        )}
        {submitError && <p className="field__message field__message--error" role="alert">{submitError}</p>}
      </form>
    </Modal>
  )
}