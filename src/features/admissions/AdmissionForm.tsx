import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileBadge2,
  House,
  IndianRupee,
  Info,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Input, Modal, Select, Textarea } from '../../components/ui'
import { parseAmount } from '../../utils/amount'
import { createAdmission } from '../../services/api'
import { useWorkflow } from '../workflow/useWorkflow'
import type { AdmissionSnapshot } from '../workflow/workflowTypes'
import { getCourseCodes } from '../courseCodes/courseCodeService'
import { courseDurationOptions, genderOptions, getAdmissionCourseOptions } from './admissionOptions'
import {
  calculateFinalFee,
  getAdmissionMetadata,
  getAdmissionNumberPreview,
  initialAdmissionForm,
  validateAdmissionForm,
} from './admissionFormUtils'
import type { AdmissionFormData, AdmissionFormErrors } from './admissionTypes'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
}

type SectionId =
  | 'admission'
  | 'timing'
  | 'personal'
  | 'address'
  | 'fees'
  | 'additional'

interface FormSectionProps {
  children: ReactNode
  description: string
  icon: ReactNode
  id: SectionId
  isOpen: boolean
  number: string
  onToggle: (id: SectionId) => void
  title: string
}

const initialOpenSections: Record<SectionId, boolean> = {
  admission: true,
  timing: true,
  personal: true,
  address: true,
  fees: true,
  additional: true,
}

const fieldSections: Partial<Record<keyof AdmissionFormData, SectionId>> = {
  course: 'admission',
  batchNumber: 'admission',
  admissionDate: 'admission',
  startTime: 'timing',
  endTime: 'timing',
  fullName: 'personal',
  dateOfBirth: 'personal',
  mobileNumber: 'personal',
  email: 'personal',
  pincode: 'address',
  totalCourseFee: 'fees',
  discountPercentage: 'fees',
}

function FormSection({
  children,
  description,
  icon,
  id,
  isOpen,
  number,
  onToggle,
  title,
}: FormSectionProps) {
  const contentId = `admission-section-${id}`

  return (
    <section className={`admission-section${isOpen ? ' admission-section--open' : ''}`}>
      <button
        className="admission-section__header"
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        onClick={() => onToggle(id)}
      >
        <div className="admission-section__icon" aria-hidden="true">{icon}</div>
        <div className="admission-section__heading">
          <span className="admission-section__number">Section {number}</span>
          <h2 className="admission-section__title">{title}</h2>
          <p className="admission-section__description">{description}</p>
        </div>
        <ChevronDown className="admission-section__chevron" aria-hidden="true" size={19} />
      </button>
      {isOpen && (
        <div className="admission-section__body" id={contentId}>
          <div className="admission-section__fields">{children}</div>
        </div>
      )}
    </section>
  )
}

export function AdmissionForm() {
  const navigate = useNavigate()
  const { setAdmission } = useWorkflow()
  const [formData, setFormData] = useState(initialAdmissionForm)
  const [errors, setErrors] = useState<AdmissionFormErrors>({})
  const [openSections, setOpenSections] = useState(initialOpenSections)
  const [preview, setPreview] = useState<AdmissionSnapshot | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, setCourseCodeRevision] = useState(0)
  const courseOptions = getAdmissionCourseOptions()

  useEffect(() => {
    let active = true
    void getCourseCodes().then(() => {
      if (active) setCourseCodeRevision((value) => value + 1)
    })
    return () => { active = false }
  }, [])

  const finalFee = calculateFinalFee(
    formData.totalCourseFee,
    formData.discountPercentage,
  )
  const admissionMetadata = getAdmissionMetadata(formData.admissionDate)
  const admissionNumber = getAdmissionNumberPreview(
    formData.admissionDate,
    formData.course,
    formData.batchNumber,
  )

  function updateField(field: keyof AdmissionFormData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    updateField(event.target.name as keyof AdmissionFormData, event.target.value)
  }

  function handleBatchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (/^\d{0,2}$/.test(value)) updateField('batchNumber', value)
  }

  function handlePercentageChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (value === '' || /^\d{0,3}(?:\.\d{0,2})?$/.test(value)) {
      updateField('discountPercentage', value)
    }
  }

  function toggleSection(section: SectionId) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const nextErrors = validateAdmissionForm(formData)
    setErrors(nextErrors)

    const firstError = Object.keys(nextErrors)[0] as keyof AdmissionFormData | undefined
    if (firstError) {
      const errorSections = Object.keys(nextErrors)
        .map((field) => fieldSections[field as keyof AdmissionFormData])
        .filter((section): section is SectionId => Boolean(section))
      setOpenSections((current) => {
        const nextSections = { ...current }
        errorSections.forEach((section) => { nextSections[section] = true })
        return nextSections
      })
      requestAnimationFrame(() => document.getElementById(firstError)?.focus())
      return
    }

    setSubmitError('')
    setIsSubmitting(true)
    try {
      const totalCourseFee = parseAmount(formData.totalCourseFee)
      const discountPercentage = Number(formData.discountPercentage || 0)
      const result = await createAdmission({
        fullName: formData.fullName.trim(),
        fathersName: formData.fatherName.trim(),
        mothersName: formData.motherName.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        mobileNumber: formData.mobileNumber.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        course: formData.course,
        batch: formData.batchNumber,
        startTime: formData.startTime,
        endTime: formData.endTime,
        admissionDate: formData.admissionDate,
        courseDuration: formData.courseDuration,
        totalCourseFee,
        discount: Math.round((totalCourseFee * discountPercentage) * 100) / 10000,
        remarks: formData.remarks.trim(),
      })
      const { student } = result
      const admission: AdmissionSnapshot = {
        admissionDate: student.admissionDate,
        admissionNumber: student.studentId,
        batchNumber: student.batch,
        course: student.course,
        courseDuration: student.courseDuration,
        discountPercentage,
        email: formData.email,
        enrollmentMonth: student.enrollmentMonth,
        enrollmentYear: student.enrollmentYear,
        finalFee: student.finalFee,
        mobileNumber: formData.mobileNumber,
        previousPaid: 0,
        startTime: formData.startTime,
        endTime: formData.endTime,
        studentName: student.fullName,
        totalCourseFee: student.totalCourseFee,
      }
      setAdmission(admission)
      setPreview(admission)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to register the student.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setFormData(initialAdmissionForm)
    setErrors({})
    setOpenSections(initialOpenSections)
    setPreview(null)
  }

  function continueToPayment() {
    setPreview(null)
    navigate('/fee-receipt', { state: { fromAdmission: true } })
  }

  function finishLater() {
    setPreview(null)
    navigate('/')
  }

  return (
    <>
      <form className="admission-form" noValidate onSubmit={handleSubmit}>
        <FormSection
          id="admission"
          isOpen={openSections.admission}
          number="01"
          onToggle={toggleSection}
          title="Admission Details"
          description="Official course, batch, and admission date."
          icon={<FileBadge2 size={20} />}
        >
          <Select id="course" name="course" label="Course / Program" required options={courseOptions} value={formData.course} error={errors.course} onChange={handleInputChange} />
          <Input id="batchNumber" name="batchNumber" label="Batch Number" required inputMode="numeric" maxLength={2} placeholder="01" value={formData.batchNumber} error={errors.batchNumber} hint="Two-digit numeric batch code." onChange={handleBatchChange} />
          <Input id="admissionDate" name="admissionDate" label="Admission Date" required type="date" value={formData.admissionDate} error={errors.admissionDate} onChange={handleInputChange} />
          <Input id="admissionNumber" label="Admission Number" value={admissionNumber} disabled hint="Preview only. The backend will assign the final sequence." />
          <dl className="admission-derived-fields">
            <div><dt>Admission Year</dt><dd>{admissionMetadata.admissionYear}</dd></div>
            <div><dt>Enrollment Month</dt><dd>{admissionMetadata.enrollmentMonth}</dd></div>
            <div><dt>Enrollment Year</dt><dd>{admissionMetadata.enrollmentYear}</dd></div>
          </dl>
        </FormSection>

        <FormSection
          id="timing"
          isOpen={openSections.timing}
          number="02"
          onToggle={toggleSection}
          title="Batch Timing"
          description="One start and end time for the entire batch."
          icon={<Clock3 size={20} />}
        >
          <Input id="startTime" name="startTime" label="Start Time" required type="time" value={formData.startTime} error={errors.startTime} onChange={handleInputChange} />
          <Input id="endTime" name="endTime" label="End Time" required type="time" value={formData.endTime} error={errors.endTime} onChange={handleInputChange} />
        </FormSection>

        <FormSection
          id="personal"
          isOpen={openSections.personal}
          number="03"
          onToggle={toggleSection}
          title="Personal Information"
          description="Student identity and contact details."
          icon={<UserRound size={20} />}
        >
          <Input id="fullName" name="fullName" label="Full Name" required autoComplete="name" value={formData.fullName} error={errors.fullName} onChange={handleInputChange} />
          <Input id="fatherName" name="fatherName" label="Father's Name" value={formData.fatherName} onChange={handleInputChange} />
          <Input id="motherName" name="motherName" label="Mother's Name" value={formData.motherName} onChange={handleInputChange} />
          <Input id="dateOfBirth" name="dateOfBirth" label="Date of Birth" type="date" max={new Date().toISOString().slice(0, 10)} value={formData.dateOfBirth} error={errors.dateOfBirth} onChange={handleInputChange} />
          <Select id="gender" name="gender" label="Gender" options={genderOptions} value={formData.gender} onChange={handleInputChange} />
          <Input id="mobileNumber" name="mobileNumber" label="Mobile Number" required type="tel" inputMode="tel" autoComplete="tel" placeholder="10 to 15 digit number" value={formData.mobileNumber} error={errors.mobileNumber} onChange={handleInputChange} />
          <Input id="email" name="email" label="Email" type="email" autoComplete="email" placeholder="student@example.com" value={formData.email} error={errors.email} onChange={handleInputChange} />
        </FormSection>

        <FormSection
          id="address"
          isOpen={openSections.address}
          number="04"
          onToggle={toggleSection}
          title="Address"
          description="Current residential address and location."
          icon={<House size={20} />}
        >
          <Textarea containerClassName="admission-form__full" id="address" name="address" label="Address" rows={4} autoComplete="street-address" value={formData.address} onChange={handleInputChange} />
          <Input id="city" name="city" label="City" autoComplete="address-level2" value={formData.city} onChange={handleInputChange} />
          <Input id="state" name="state" label="State" autoComplete="address-level1" value={formData.state} onChange={handleInputChange} />
          <Input id="pincode" name="pincode" label="Pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={formData.pincode} error={errors.pincode} onChange={handleInputChange} />
        </FormSection>

        <FormSection
          id="fees"
          isOpen={openSections.fees}
          number="05"
          onToggle={toggleSection}
          title="Course & Fee Information"
          description="Course duration and agreed fee structure."
          icon={<IndianRupee size={20} />}
        >
          <Select id="courseDuration" name="courseDuration" label="Course Duration" options={courseDurationOptions} value={formData.courseDuration} onChange={handleInputChange} />
          <Input id="totalCourseFee" name="totalCourseFee" label="Total Course Fee" required value={formData.totalCourseFee} disabled hint="Fixed course fee for all regular programs." />
          <Input id="discountPercentage" name="discountPercentage" label="Discount (%)" type="text" inputMode="decimal" placeholder="0" value={formData.discountPercentage} error={errors.discountPercentage} hint="Percentage deducted from the total course fee." onChange={handlePercentageChange} />
          <Input containerClassName="admission-final-fee" id="finalFee" label="Final Fee" value={finalFee} placeholder="0" readOnly hint="After percentage discount, rounded to the nearest rupee." />
        </FormSection>

        <FormSection
          id="additional"
          isOpen={openSections.additional}
          number="06"
          onToggle={toggleSection}
          title="Additional Information"
          description="Optional internal notes for academy staff."
          icon={<Info size={20} />}
        >
          <Textarea containerClassName="admission-form__full" id="remarks" name="remarks" label="Remarks" rows={3} placeholder="Add any relevant notes for staff" value={formData.remarks} onChange={handleInputChange} />
        </FormSection>

        <div className="admission-form__actions">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registering Student...' : 'Register Student'}</Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            <RotateCcw aria-hidden="true" size={16} />
            Reset Form
          </Button>
          <p>Student details are saved securely through the LSA Admin API.</p>
        </div>
        {submitError && <p className="receipt-actions__error" role="alert">{submitError}</p>}
      </form>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Student registered successfully"
        description="The admission is ready to continue to its first fee payment."
        footer={
          <>
            <Button variant="secondary" onClick={finishLater}>Finish Later</Button>
            <Button onClick={continueToPayment}>
              Continue to Fee Payment
              <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </>
        }
      >
        {preview && (
          <div className="admission-preview">
            <div className="admission-preview__success">
              <CheckCircle2 aria-hidden="true" size={19} />
              <Badge variant="yellow">Admission ready</Badge>
            </div>
            <dl className="admission-preview__grid">
              <div><dt>Admission number</dt><dd>{preview.admissionNumber}</dd></div>
              <div><dt>Student name</dt><dd>{preview.studentName}</dd></div>
              <div><dt>Course</dt><dd>{preview.course}</dd></div>
              <div><dt>Batch number</dt><dd>{preview.batchNumber}</dd></div>
              <div><dt>Start time</dt><dd>{formatTime(preview.startTime)}</dd></div>
              <div><dt>End time</dt><dd>{formatTime(preview.endTime)}</dd></div>
              <div><dt>Final course fee</dt><dd>{currencyFormatter.format(preview.finalFee)}</dd></div>
            </dl>
          </div>
        )}
      </Modal>
    </>
  )
}
