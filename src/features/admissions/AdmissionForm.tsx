import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileBadge2,
  GraduationCap,
  House,
  IndianRupee,
  Info,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Input, Modal, SearchableSelect, Select, Textarea } from '../../components/ui'
import { formatAmountInput, parseAmount } from '../../utils/amount'
import {
  ApiOutcomeUnknownError,
  convertEnquiry,
  createAdmission,
  fetchStudent,
  type AdmissionPayload,
  type ConvertEnquiryResponse,
  type EnquiryRecord,
} from '../../services/api'
import { useWorkflow } from '../workflow/useWorkflow'
import type { AdmissionSnapshot } from '../workflow/workflowTypes'
import { getCachedCourseCodes, getCourseCodeServiceStatus, getCourseCodes } from '../courseCodes/courseCodeService'
import type { CourseCode } from '../courseCodes/courseCodeTypes'
import { courseDurationOptions, genderOptions, yearOfPassingOptions } from './admissionOptions'
import {
  calculateFinalFee,
  getAdmissionMetadata,
  getAdmissionNumberPreview,
  initialAdmissionForm,
  validateAdmissionForm,
} from './admissionFormUtils'
import { createAdmissionConfirmationData, type AdmissionConfirmationData } from './admissionConfirmation'
import { AdmissionConfirmationDocument } from './AdmissionConfirmationDocument'
import { AdmissionConfirmationDocumentModal } from './AdmissionConfirmationDocumentModal'
import { downloadAdmissionConfirmationPdf } from './admissionConfirmationActions'
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
  | 'education'
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

type AdmissionFormMode = 'create' | 'convert'
type ConversionState = 'idle' | 'submitting' | 'success' | 'definitive-error' | 'ambiguous'

interface AdmissionFormProps {
  enquiry?: EnquiryRecord
  mode?: AdmissionFormMode
  onClose?: () => void
  onConversionOutcomeUnknown?: () => void
  onConversionSuccess?: (result: ConvertEnquiryResponse) => void
  onViewStudent?: (studentId: string) => void
}

function getInitialFormData(mode: AdmissionFormMode, enquiry?: EnquiryRecord, visitorPrefill?: Partial<AdmissionFormData>): AdmissionFormData {
  if (mode !== 'convert' || !enquiry) return { ...initialAdmissionForm, ...visitorPrefill }
  return {
    ...initialAdmissionForm,
    admissionDate: '',
    batchNumber: '',
    course: enquiry.courseInterestedIn,
    courseDuration: '',
    otherProgramDetails: enquiry.otherProgramDetails ?? '',
    discount: '',
    endTime: '',
    fullName: enquiry.fullName,
    mobileNumber: enquiry.mobileNumber,
    email: enquiry.email,
    collegeName: enquiry.college,
    degreeCourse: [enquiry.educationLevel || enquiry.degreeCourse || '', enquiry.specialization].filter(Boolean).join(' - '),
    yearOfPassing: enquiry.yearOfGraduation,
    remarks: enquiry.notes,
    startTime: '',
    totalCourseFee: '',
  }
}

const initialOpenSections: Record<SectionId, boolean> = {
  admission: true,
  timing: true,
  personal: true,
  address: true,
  education: true,
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
  discount: 'fees',
  otherProgramDetails: 'fees',
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

export function AdmissionForm({ mode = 'create', enquiry, onClose, onConversionOutcomeUnknown, onConversionSuccess, onViewStudent }: AdmissionFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdmission } = useWorkflow()
  const visitorPrefill = (location.state as { visitorPrefill?: Partial<AdmissionFormData> } | null)?.visitorPrefill
  const [formData, setFormData] = useState<AdmissionFormData>(() => getInitialFormData(mode, enquiry, visitorPrefill))
  const [errors, setErrors] = useState<AdmissionFormErrors>({})
  const [openSections, setOpenSections] = useState(initialOpenSections)
  const [preview, setPreview] = useState<AdmissionSnapshot | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conversionState, setConversionState] = useState<ConversionState>('idle')
  const [conversionResult, setConversionResult] = useState<ConvertEnquiryResponse | null>(null)
  const [conversionError, setConversionError] = useState('')
  const [confirmationData, setConfirmationData] = useState<AdmissionConfirmationData | null>(null)
  const [confirmationLoadError, setConfirmationLoadError] = useState('')
  const [isAdmissionDocumentOpen, setIsAdmissionDocumentOpen] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [printError, setPrintError] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [, setCourseCodeRevision] = useState(0)
  const [courseLoadError, setCourseLoadError] = useState('')
  const submittingRef = useRef(false)
  const confirmationDocumentRef = useRef<HTMLElement | null>(null)
  const courseCodes = getCachedCourseCodes()
  const activeCourses = courseCodes.filter((course) => course.active && (course.type === 'Regular' || (mode === 'convert' && course.code === '00')))
  const courseOptions = activeCourses.map((course: CourseCode) => ({
    value: course.name,
    label: course.name,
    description: `${course.code} · ${course.type}`,
  }))
  const courseLoadMessage = courseLoadError || (courseCodes.length > 0 && activeCourses.length === 0 ? 'No active regular courses are available.' : '')

  function handleCourseSelection(value: string) {
    updateField('course', value)
    const courseCode = activeCourses.find((course) => course.name === value)?.code
    if (courseCode !== '00') updateField('otherProgramDetails', '')
  }

  useEffect(() => {
    let active = true
    void getCourseCodes().then(() => {
      if (!active) return
      const serviceStatus = getCourseCodeServiceStatus()
      setCourseLoadError(serviceStatus.error?.message ?? '')
      setCourseCodeRevision((value) => value + 1)
    }).finally(() => {
      if (active) setIsLoadingCourses(false)
    })
    return () => { active = false }
  }, [])

  const finalFee = calculateFinalFee(
    formData.totalCourseFee,
    formData.discount,
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

  function handleDiscountChange(event: ChangeEvent<HTMLInputElement>) {
    const formattedValue = formatAmountInput(event.target.value)
    if (formattedValue !== null) updateField('discount', formattedValue)
  }

  function handleTotalCourseFeeChange(event: ChangeEvent<HTMLInputElement>) {
    const formattedValue = formatAmountInput(event.target.value)
    if (formattedValue !== null) updateField('totalCourseFee', formattedValue)
  }

  function toggleSection(section: SectionId) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  async function downloadConfirmationPdf() {
    if (!confirmationDocumentRef.current || !confirmationData) return
    setIsDownloadingPdf(true)
    setPdfError('')
    try {
      await downloadAdmissionConfirmationPdf(confirmationDocumentRef.current, confirmationData.studentId)
    } catch {
      setPdfError('Unable to generate the PDF. The admission was created successfully.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function printConfirmation() {
    setPrintError('')
    try {
      if (typeof window.print !== 'function') throw new Error('Printing is unavailable in this browser.')
      window.print()
    } catch {
      setPrintError('Print is unavailable. The admission was created successfully.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || conversionState === 'ambiguous' || conversionState === 'success') return
    const nextErrors = validateAdmissionForm(formData)
    if (!activeCourses.some((course) => course.name === formData.course)) {
      nextErrors.course = courseLoadError ? 'Active courses could not be loaded. Retry when the course list is available.' : 'Choose an active course from the list.'
    }
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
    submittingRef.current = true
    setIsSubmitting(true)
    if (mode === 'convert') {
      setConversionState('submitting')
      setConversionError('')
    }
    try {
      const totalCourseFee = parseAmount(formData.totalCourseFee)
      const discount = parseAmount(formData.discount)
      const admissionPayload: AdmissionPayload = {
        fullName: formData.fullName.trim(),
        fathersName: formData.fatherName.trim(),
        mothersName: formData.motherName.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        mobileNumber: formData.mobileNumber.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        collegeName: formData.collegeName.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        degreeCourse: formData.degreeCourse.trim(),
        ...(mode === 'convert' ? { otherProgramDetails: formData.otherProgramDetails.trim() } : {}),
        course: formData.course,
        batch: formData.batchNumber,
        startTime: formData.startTime,
        endTime: formData.endTime,
        admissionDate: formData.admissionDate,
        courseDuration: formData.courseDuration,
        totalCourseFee,
        discount,
        remarks: mode === 'convert' ? formData.remarks : formData.remarks.trim(),
        yearOfPassing: formData.yearOfPassing,
      }
      if (mode === 'convert') {
        if (!enquiry) throw new Error('Conversion requires a source enquiry.')
        const response = await convertEnquiry({ enquiryId: enquiry.enquiryId, admission: admissionPayload })
        if (!response.data?.studentId && !response.data?.admissionId) {
          throw new ApiOutcomeUnknownError('The conversion response did not include an Admission ID.')
        }
        setConversionResult(response)
        setConversionState('success')
        onConversionSuccess?.(response)
        const studentId = response.data.studentId || response.data.admissionId
        try {
          const result = await fetchStudent(studentId)
          setConfirmationData(createAdmissionConfirmationData(result.student, response.data.enquiryId || enquiry.enquiryId))
        } catch {
          setConfirmationLoadError('Admission created successfully, but the Admission details could not be loaded. You can still view the Student record.')
        }
      } else {
        const result = await createAdmission(admissionPayload)
        const { student } = result
        const admission: AdmissionSnapshot = {
          admissionDate: student.admissionDate,
          admissionNumber: student.studentId,
          batchNumber: student.batch,
          course: student.course,
          courseDuration: student.courseDuration,
          discountPercentage: totalCourseFee ? (discount / totalCourseFee) * 100 : 0,
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
        setConfirmationData(null)
        setConfirmationLoadError('')
        setIsAdmissionDocumentOpen(false)
        try {
          const details = await fetchStudent(student.studentId)
          setConfirmationData(createAdmissionConfirmationData(details.student, ''))
          setIsAdmissionDocumentOpen(true)
        } catch {
          setConfirmationLoadError('The student was registered, but the Admission document could not be loaded. Open the Student record and try again.')
        }
      }
    } catch (error) {
      if (mode === 'convert') {
        if (error instanceof ApiOutcomeUnknownError) {
          setConversionState('ambiguous')
          setConversionError('Conversion status could not be confirmed. Do not submit again until the enquiry and admission records have been checked.')
          onConversionOutcomeUnknown?.()
        } else {
          setConversionState('definitive-error')
          setConversionError(error instanceof Error ? error.message : 'The API rejected the conversion request.')
        }
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Unable to register the student.')
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
      if (mode === 'convert') setConversionState((current) => current === 'submitting' ? 'idle' : current)
    }
  }

  function handleReset() {
    setFormData(initialAdmissionForm)
    setErrors({})
    setOpenSections(initialOpenSections)
    setPreview(null)
    setConfirmationData(null)
    setConfirmationLoadError('')
    setIsAdmissionDocumentOpen(false)
  }

  function continueToPayment() {
    setPreview(null)
    navigate('/fee-receipt', { state: { fromAdmission: true } })
  }

  function finishLater() {
    setPreview(null)
    navigate('/')
  }

  const admissionFields = (
      <form id={mode === 'convert' ? 'conversion-admission-form' : 'admission-form'} className={`admission-form${mode === 'convert' ? ' admission-form--conversion' : ''}`} noValidate onSubmit={handleSubmit}>
        {mode === 'create' && visitorPrefill && (
          <div className="admission-prefill-note" role="status">
            Visitor details were prefilled from a walk-in. Review and complete the admission fields before submitting.
          </div>
        )}
        <FormSection
          id="admission"
          isOpen={openSections.admission}
          number="01"
          onToggle={toggleSection}
          title="Admission Details"
          description="Official course, batch, and admission date."
          icon={<FileBadge2 size={20} />}
        >
          <SearchableSelect
            id="course"
            label="Course / Program"
            required
            loading={isLoadingCourses}
            loadingText="Loading active courses..."
            options={courseOptions}
            value={formData.course}
            error={errors.course || (courseLoadMessage ? 'Active Course Codes are unavailable.' : undefined)}
            legacyHint="This course is no longer active. Choose an active course to continue."
            placeholder="Search course..."
            onChange={handleCourseSelection}
          />
          {courseLoadMessage && <p className="field__message field__message--error admission-form__full" role="alert">{courseLoadMessage}</p>}
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
          id="education"
          isOpen={openSections.education}
          number="05"
          onToggle={toggleSection}
          title="Education Details"
          description="Most recent college and course information."
          icon={<GraduationCap size={20} />}
        >
          <Select id="yearOfPassing" name="yearOfPassing" label="Year of Passing" options={yearOfPassingOptions} value={formData.yearOfPassing} onChange={handleInputChange} />
          <Input id="collegeName" name="collegeName" label="College Name" value={formData.collegeName} onChange={handleInputChange} />
          <Input id="degreeCourse" name="degreeCourse" label="Degree / Course" value={formData.degreeCourse} onChange={handleInputChange} />
        </FormSection>

        <FormSection
          id="fees"
          isOpen={openSections.fees}
          number="06"
          onToggle={toggleSection}
          title="Course & Fee Information"
          description="Course duration and agreed fee structure."
          icon={<IndianRupee size={20} />}
        >
          <Select id="courseDuration" name="courseDuration" label="Course Duration" required options={courseDurationOptions} value={formData.courseDuration} error={errors.courseDuration} onChange={handleInputChange} />
          {formData.course.trim().toLowerCase() === 'other programs' && <Input id="otherProgramDetails" name="otherProgramDetails" label="Program / Training Interested In" required value={formData.otherProgramDetails} error={errors.otherProgramDetails} onChange={handleInputChange} />}
          <Input id="totalCourseFee" name="totalCourseFee" label="Total Course Fee" required value={formData.totalCourseFee} inputMode="decimal" onChange={handleTotalCourseFeeChange} error={errors.totalCourseFee} hint="Enter the agreed course fee." />
          <Input id="discount" name="discount" label="Discount" type="text" inputMode="decimal" placeholder="0" value={formData.discount} error={errors.discount} hint="Amount deducted from the total course fee." onChange={handleDiscountChange} />
          <Input containerClassName="admission-final-fee" id="finalFee" label="Final Fee" value={finalFee} placeholder="0" readOnly hint="Total course fee minus discount." />
        </FormSection>

        <FormSection
          id="additional"
          isOpen={openSections.additional}
          number="07"
          onToggle={toggleSection}
          title="Additional Information"
          description="Optional internal notes for academy staff."
          icon={<Info size={20} />}
        >
          <Textarea containerClassName="admission-form__full" id="remarks" name="remarks" label="Remarks" rows={3} placeholder="Add any relevant notes for staff" value={formData.remarks} onChange={handleInputChange} />
        </FormSection>

        {mode === 'create' && <div className="admission-form__actions">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registering Student...' : 'Register Student'}</Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            <RotateCcw aria-hidden="true" size={16} />
            Reset Form
          </Button>
          <p>Student details are saved securely through the LSA Admin API.</p>
        </div>}
        {mode === 'create' && submitError && <p className="receipt-actions__error" role="alert">{submitError}</p>}
      </form>
  )

  if (mode === 'convert') {
    const studentId = conversionResult?.data?.studentId || conversionResult?.data?.admissionId || ''
    const hasIndexWarning = Boolean(conversionResult?.partial || conversionResult?.indexWarning || conversionResult?.studentIndexWarning || conversionResult?.studentIndexSynchronized === false)
    return (
      <Modal
        open
        title={conversionState === 'success' ? 'Admission Created' : 'Convert Enquiry to Admission'}
        description={conversionState === 'success'
          ? `Enquiry ${enquiry?.enquiryId ?? ''} has been successfully converted.`
          : 'Complete the existing admission form. Enquiry information has been pre-filled where available.'}
        onClose={() => { if (!isSubmitting) onClose?.() }}
        footer={conversionState === 'success' ? (
          <div className="admission-confirmation-actions">
            <Button variant="secondary" onClick={() => onClose?.()}>Close</Button>
            <Button variant="secondary" onClick={printConfirmation} disabled={!confirmationData}>Print</Button>
            <Button variant="secondary" onClick={() => onViewStudent ? onViewStudent(studentId) : navigate('/students', { state: { selectedStudentId: studentId } })}><ArrowRight aria-hidden="true" size={16} />View Student</Button>
            <Button onClick={() => void downloadConfirmationPdf()} disabled={!confirmationData || isDownloadingPdf}>
              {isDownloadingPdf ? 'Preparing PDF...' : 'Download Admission PDF'}
            </Button>
          </div>
        ) : conversionState === 'ambiguous' ? (
          <Button variant="secondary" onClick={() => onClose?.()}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onClose?.()} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" form="conversion-admission-form" disabled={isSubmitting || isLoadingCourses || Boolean(courseLoadMessage)}>
              {conversionState === 'submitting' ? 'Creating Admission...' : 'Complete Admission'}
            </Button>
          </>
        )}
      >
        {conversionState === 'success' ? (
          <div className="admission-confirmation-success" role="status">
            <div className="admission-confirmation-success__id">
              <CheckCircle2 aria-hidden="true" size={24} />
              <div><span>Student / Admission ID</span><strong>{studentId}</strong></div>
            </div>
            {confirmationData
              ? <AdmissionConfirmationDocument data={confirmationData} ref={confirmationDocumentRef} />
              : <p className="admission-confirmation-load-error">{confirmationLoadError || 'Loading the created Admission details...'}</p>}
            {hasIndexWarning && <p className="admission-conversion-message" role="alert">{conversionResult?.indexWarning || conversionResult?.studentIndexWarning || conversionResult?.error || 'The admission was created, but an index needs attention.'}</p>}
            {pdfError && <p className="admission-confirmation-action-error" role="alert">{pdfError}</p>}
            {printError && <p className="admission-confirmation-action-error" role="alert">{printError}</p>}
          </div>
        ) : (
          <>
            {enquiry && <section className="enquiry-conversion-summary">
              <h3>Enquiry Information</h3>
              <dl>
                <div><dt>Enquiry ID</dt><dd>{enquiry.enquiryId}</dd></div>
                <div><dt>Name</dt><dd>{enquiry.fullName}</dd></div>
                <div><dt>Mobile</dt><dd>{enquiry.mobileNumber}</dd></div>
                <div><dt>Education Level</dt><dd>{enquiry.educationLevel || enquiry.degreeCourse || 'Not provided'}</dd></div>
                <div><dt>Specialization</dt><dd>{enquiry.specialization || 'Not provided'}</dd></div>
                <div><dt>Course Interested In</dt><dd>{enquiry.courseInterestedIn}</dd></div>
                {enquiry.otherProgramDetails && <div><dt>Other Program Details</dt><dd>{enquiry.otherProgramDetails}</dd></div>}
              </dl>
            </section>}
            {conversionState === 'ambiguous' && <div className="admission-conversion-message admission-conversion-message--ambiguous" role="alert">
              <AlertTriangle aria-hidden="true" size={18} />
              <div><strong>Conversion status could not be confirmed.</strong><p>Do not submit again until the enquiry and admission records have been checked.</p></div>
            </div>}
            {conversionState === 'definitive-error' && <div className="admission-conversion-message" role="alert"><strong>Unable to create admission.</strong> {conversionError}</div>}
            {admissionFields}
          </>
        )}
      </Modal>
    )
  }

  return (
    <>
      {admissionFields}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Student registered successfully"
        description="The admission is ready to continue to its first fee payment."
        footer={
          <div className="admission-confirmation-actions">
            <Button variant="secondary" onClick={finishLater}>Finish Later</Button>
            <Button variant="secondary" onClick={() => setIsAdmissionDocumentOpen(true)} disabled={!confirmationData}>
              <FileBadge2 aria-hidden="true" size={16} />
              View Admission Document
            </Button>
            <Button onClick={continueToPayment}>
              Continue to Fee Payment
              <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </div>
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
            {confirmationLoadError && <p className="admission-confirmation-load-error" role="alert">{confirmationLoadError}</p>}
          </div>
        )}
      </Modal>
      {confirmationData && (
        <AdmissionConfirmationDocumentModal
          data={confirmationData}
          open={isAdmissionDocumentOpen}
          onClose={() => setIsAdmissionDocumentOpen(false)}
        />
      )}
    </>
  )
}
