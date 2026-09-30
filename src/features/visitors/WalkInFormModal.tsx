import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Input, Modal, Select, Textarea } from '../../components/ui'
import { createWalkIn, updateWalkIn } from '../../services/api'
import {
  emptyVisitorForm,
  followUpRequiredOptions,
  referralOptions,
  validateVisitorForm,
  visitorToForm,
  type VisitorFormData,
  type VisitorFormErrors,
  type VisitorRecord,
} from './visitorTypes'

interface WalkInFormModalProps {
  courseOptions: Array<{ label: string; value: string }>
  onClose: () => void
  onSaved: () => void
  visitor?: VisitorRecord | null
}

function normalizeForm(form: VisitorFormData) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as VisitorFormData
}

export function WalkInFormModal({ courseOptions, onClose, onSaved, visitor = null }: WalkInFormModalProps) {
  const isEditing = Boolean(visitor)
  const [form, setForm] = useState<VisitorFormData>(() => visitor ? visitorToForm(visitor) : { ...emptyVisitorForm })
  const [errors, setErrors] = useState<VisitorFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field: keyof VisitorFormData, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    updateField(event.target.name as keyof VisitorFormData, event.target.value)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    const normalized = normalizeForm(form)
    const nextErrors = validateVisitorForm(normalized)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    setSubmitError('')
    try {
      const { visitDate: _visitDate, entryTime: _entryTime, ...payload } = normalized
      if (isEditing && visitor) await updateWalkIn(visitor.visitorId, payload)
      else await createWalkIn(payload)
      onSaved()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the walk-in.')
    } finally {
      setIsSaving(false)
    }
  }

  const courseSelectOptions = [{ label: 'Select course', value: '' }, ...courseOptions, { label: 'Other', value: 'Other' }]
  const isOtherCourse = form.courseInterestedIn === 'Other'
  const isOtherReferral = form.referral === 'Other'

  return (
    <Modal
      open
      title={isEditing ? 'Edit walk-in' : 'Add walk-in'}
      description={isEditing ? `Update details for ${visitor?.visitorId}.` : 'Capture a new visitor enquiry for the LSA team.'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="walk-in-form" disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Walk-in'}
          </Button>
        </>
      )}
    >
      <form className="visitor-form" id="walk-in-form" onSubmit={handleSubmit} noValidate>
        {submitError && <p className="visitor-form__error" role="alert">{submitError}</p>}
        <div className="visitor-form__grid">
          <Input id="visitor-full-name" name="fullName" label="Name" placeholder="Full name" value={form.fullName} onChange={handleInputChange} error={errors.fullName} required />
          <Input id="visitor-mobile" name="mobileNumber" label="Phone" placeholder="Phone number" inputMode="tel" value={form.mobileNumber} onChange={handleInputChange} error={errors.mobileNumber} required />
          <Input id="visitor-email" name="email" label="Email" type="email" placeholder="Optional email" value={form.email} onChange={handleInputChange} error={errors.email} />
          <Input id="visitor-college" name="college" label="College" placeholder="College or organisation" value={form.college} onChange={handleInputChange} />
          <Input id="visitor-degree" name="degreeCourse" label="Degree / Course" placeholder="Current degree or course" value={form.degreeCourse} onChange={handleInputChange} />
          <Input id="visitor-graduation" name="yearOfGraduation" label="Year of Graduation" placeholder="YYYY" inputMode="numeric" value={form.yearOfGraduation} onChange={handleInputChange} error={errors.yearOfGraduation} />
          <Select id="visitor-course" name="courseInterestedIn" label="Course Interested In" options={courseSelectOptions} value={form.courseInterestedIn} onChange={handleInputChange} error={errors.courseInterestedIn} required />
          {isOtherCourse && <Input id="visitor-other-course" name="otherCourse" label="Other Course" placeholder="Enter course name" value={form.otherCourse} onChange={handleInputChange} error={errors.otherCourse} required />}
          <Select id="visitor-referral" name="referral" label="Referral" options={referralOptions} value={form.referral} onChange={handleInputChange} error={errors.referral} required />
          {isOtherReferral && <Input id="visitor-other-referral" name="otherReferral" label="Other Referral" placeholder="Enter referral source" value={form.otherReferral} onChange={handleInputChange} error={errors.otherReferral} required />}
          <Input id="visitor-consulted-with" name="consultedWith" label="Consulted With" placeholder="Staff member" value={form.consultedWith} onChange={handleInputChange} error={errors.consultedWith} required />
          <Select id="visitor-follow-up-required" name="followUpRequired" label="Follow-up Required" options={followUpRequiredOptions} value={form.followUpRequired} onChange={handleInputChange} />
          <Input id="visitor-date" name="visitDate" label="Visit Date" type="date" value={form.visitDate} onChange={handleInputChange} error={errors.visitDate} readOnly={isEditing} required />
          <Input id="visitor-entry-time" name="entryTime" label="Entry Time" type="time" value={form.entryTime} onChange={handleInputChange} error={errors.entryTime} readOnly={isEditing} required />
          <Textarea containerClassName="visitor-form__full" id="visitor-notes" name="notes" label="Notes / Remarks" rows={3} placeholder="Add context for the team" value={form.notes} onChange={handleInputChange} />
        </div>
      </form>
    </Modal>
  )
}
