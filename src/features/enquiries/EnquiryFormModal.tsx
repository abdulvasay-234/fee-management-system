import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Input, Modal, SearchableSelect, Select, Textarea } from '../../components/ui'
import {
  consultantOptions,
  educationLevelOptions,
  enquiryStatuses,
  getGraduationYearOptions,
  otherOption,
  referralOptions,
} from '../../config/enquiryOptions'
import { getSpecializationOptions } from '../../config/educationOptions'
import { createEnquiry, fetchCourseCodes, updateEnquiry, type CourseCode, type EnquiryPayload, type EnquiryRecord } from '../../services/api'

interface EnquiryFormModalProps {
  enquiry: EnquiryRecord | null
  onConvert: (enquiry: EnquiryRecord) => void
  onClose: () => void
  onViewAdmission: (studentId: string) => void
  onSaved: (record: EnquiryRecord, warning?: string) => void
}

function initialForm(enquiry: EnquiryRecord | null): EnquiryPayload {
  const now = new Date()
  const legacyNotes = readLegacyNotes(enquiry?.notes ?? '')
  return {
    fullName: enquiry?.fullName ?? '',
    mobileNumber: enquiry?.mobileNumber ?? '',
    email: enquiry?.email ?? '',
    college: enquiry?.college ?? '',
    educationLevel: enquiry?.educationLevel ?? enquiry?.degreeCourse ?? '',
    specialization: enquiry?.specialization ?? '',
    yearOfGraduation: enquiry?.yearOfGraduation ?? '',
    courseInterestedIn: enquiry?.courseInterestedIn ?? '',
    otherProgramDetails: enquiry?.otherProgramDetails || legacyNotes.otherProgramDetails,
    referral: enquiry?.referral ?? '',
    notes: legacyNotes.notes,
    consultedBy: enquiry?.consultedBy ?? '',
    enquiryDate: enquiry?.enquiryDate ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  }
}

const LEGACY_OTHER_PROGRAM_DETAILS_PREFIX = '[LSA Other Program Details]: '

function readLegacyNotes(notes: string) {
  const lines = notes.split(/\r?\n/)
  const detailIndex = lines.findIndex((line) => line.startsWith(LEGACY_OTHER_PROGRAM_DETAILS_PREFIX))
  if (detailIndex < 0) return { notes, otherProgramDetails: '' }
  const otherProgramDetails = lines[detailIndex].slice(LEGACY_OTHER_PROGRAM_DETAILS_PREFIX.length)
  return {
    notes: lines.filter((_, index) => index !== detailIndex).join('\n'),
    otherProgramDetails,
  }
}

function selectedChoice(value: string, options: readonly string[]) {
  if (!value) return ''
  return options.includes(value) && value !== otherOption ? value : otherOption
}

function legacyValue(value: string, options: readonly string[]) {
  return value && value !== otherOption && !options.includes(value) ? value : ''
}

function validate(form: EnquiryPayload) {
  const errors: Partial<Record<keyof EnquiryPayload, string>> = {}
  if (!form.fullName) errors.fullName = 'Full Name is required.'
  if (!form.mobileNumber) errors.mobileNumber = 'Mobile Number is required.'
  if (!form.educationLevel) errors.educationLevel = 'Education Level is required.'
  if (!form.courseInterestedIn) errors.courseInterestedIn = 'Course Interested In is required.'
  if (!form.enquiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.enquiryDate) || Number.isNaN(new Date(`${form.enquiryDate}T00:00:00`).getTime())) errors.enquiryDate = 'Enter a valid Enquiry Date.'
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
  if (form.yearOfGraduation && form.yearOfGraduation !== 'Currently Pursuing' && !/^\d{4}$/.test(form.yearOfGraduation)) errors.yearOfGraduation = 'Use a four-digit year.'
  if (form.yearOfGraduation === otherOption) errors.yearOfGraduation = 'Enter a four-digit graduation year.'
  return errors
}

export function EnquiryFormModal({ enquiry, onClose, onConvert, onViewAdmission, onSaved }: EnquiryFormModalProps) {
  const [form, setForm] = useState<EnquiryPayload>(() => initialForm(enquiry))
  const [otherProgramError, setOtherProgramError] = useState('')
  const [educationLevelChoice, setEducationLevelChoice] = useState(() => selectedChoice(enquiry?.educationLevel ?? enquiry?.degreeCourse ?? '', educationLevelOptions))
  const [otherEducationLevel, setOtherEducationLevel] = useState(() => legacyValue(enquiry?.educationLevel ?? enquiry?.degreeCourse ?? '', educationLevelOptions))
  const initialEducationLevel = enquiry?.educationLevel ?? enquiry?.degreeCourse ?? ''
  const initialSpecializationOptions = getSpecializationOptions(initialEducationLevel || otherOption)
  const [specializationChoice, setSpecializationChoice] = useState(() => selectedChoice(enquiry?.specialization ?? '', initialSpecializationOptions))
  const [otherSpecialization, setOtherSpecialization] = useState(() => legacyValue(enquiry?.specialization ?? '', initialSpecializationOptions))
  const graduationYears = getGraduationYearOptions()
  const graduationOptions = [...graduationYears, 'Currently Pursuing', otherOption]
  const [graduationChoice, setGraduationChoice] = useState(() => selectedChoice(enquiry?.yearOfGraduation ?? '', graduationOptions))
  const [otherGraduationYear, setOtherGraduationYear] = useState(() => legacyValue(enquiry?.yearOfGraduation ?? '', graduationOptions))
  const [referralChoice, setReferralChoice] = useState(() => selectedChoice(enquiry?.referral ?? '', referralOptions))
  const [otherReferral, setOtherReferral] = useState(() => legacyValue(enquiry?.referral ?? '', referralOptions))
  const [consultantChoice, setConsultantChoice] = useState(() => selectedChoice(enquiry?.consultedBy ?? '', consultantOptions))
  const [otherConsultant, setOtherConsultant] = useState(() => legacyValue(enquiry?.consultedBy ?? '', consultantOptions))
  const [courses, setCourses] = useState<CourseCode[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [courseLoadError, setCourseLoadError] = useState('')
  const [status, setStatus] = useState<EnquiryRecord['status']>(enquiry?.status ?? 'New')
  const [errors, setErrors] = useState<Partial<Record<keyof EnquiryPayload, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const originalGraduationYear = useRef(enquiry?.yearOfGraduation ?? '')

  useEffect(() => {
    let active = true
    void fetchCourseCodes().then((records) => {
      if (active) setCourses(records.filter((course) => course.active.trim().toLowerCase() === 'yes'))
    }).catch((error: unknown) => {
      if (active) setCourseLoadError(error instanceof Error ? error.message : 'Unable to load active courses.')
    }).finally(() => {
      if (active) setIsLoadingCourses(false)
    })
    return () => { active = false }
  }, [])

  const graduationYearOptions = graduationYears
  const specializationValues = educationLevelChoice ? getSpecializationOptions(educationLevelChoice) : []
  const courseOptions = courses.map((course) => ({
    value: course.courseName,
    label: course.courseName,
    description: `${course.code} · ${course.type}`,
  }))
  const selectedCourse = courses.find((course) => course.courseName === form.courseInterestedIn)
  const isOtherProgramSelected = selectedCourse?.code === '00' || form.courseInterestedIn.trim().toLowerCase() === 'other programs'

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const field = event.target.name as keyof EnquiryPayload
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleEducationLevelChange(value: string) {
    setEducationLevelChoice(value)
    setOtherEducationLevel('')
    setSpecializationChoice('')
    setOtherSpecialization('')
    setForm((current) => ({
      ...current,
      educationLevel: value === otherOption ? '' : value,
      specialization: '',
    }))
    setErrors((current) => ({ ...current, educationLevel: undefined, specialization: undefined }))
  }

  function handleCourseChange(value: string) {
    const selected = courses.find((course) => course.courseName === value)
    const isOtherProgram = selected?.code === '00' || value.trim().toLowerCase() === 'other programs'
    setForm((current) => ({
      ...current,
      courseInterestedIn: value,
      otherProgramDetails: isOtherProgram ? current.otherProgramDetails : '',
    }))
    setErrors((current) => ({ ...current, courseInterestedIn: undefined }))
  }

  function buildPayload() {
    return {
      ...form,
      educationLevel: educationLevelChoice === otherOption ? otherEducationLevel.trim() : educationLevelChoice,
      specialization: specializationChoice === otherOption ? otherSpecialization.trim() : specializationChoice,
      yearOfGraduation: graduationChoice === otherOption
        ? otherGraduationYear.trim() || form.yearOfGraduation
        : graduationChoice,
      referral: referralChoice === otherOption
        ? otherReferral.trim() || (form.referral === otherOption ? otherOption : '')
        : referralChoice,
      consultedBy: consultantChoice === otherOption
        ? otherConsultant.trim() || (form.consultedBy === otherOption ? otherOption : '')
        : consultantChoice,
      otherProgramDetails: isOtherProgramSelected ? form.otherProgramDetails.trim() : '',
    }
  }

  function handleStatusChange(value: EnquiryRecord['status']) {
    setStatusError('')
    if (value === 'Converted') {
      if (!enquiry) return
      if (enquiry.status === 'Not Interested' || status === 'Not Interested') {
        setStatusError('A Not Interested enquiry cannot be converted. Change and save its status first if its disposition has changed.')
        return
      }
      if (enquiry.admissionId) {
        onViewAdmission(enquiry.admissionId)
        return
      }
      onConvert(enquiry)
      return
    }
    setStatus(value)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    const currentPayload = buildPayload()
    const payload = Object.fromEntries(Object.entries(currentPayload).map(([key, value]) => [key, value.trim()])) as unknown as EnquiryPayload
    const nextErrors = validate(payload)
    if (educationLevelChoice === otherOption && !otherEducationLevel.trim()) nextErrors.educationLevel = 'Specify Education is required.'
    if (specializationChoice === otherOption && !otherSpecialization.trim()) nextErrors.specialization = 'Specify Specialization is required.'
    const unchangedLegacyYear = Boolean(originalGraduationYear.current) && payload.yearOfGraduation === originalGraduationYear.current
    if (graduationChoice === otherOption && !/^\d{4}$/.test(otherGraduationYear.trim()) && !unchangedLegacyYear) nextErrors.yearOfGraduation = 'Enter a four-digit graduation year.'
    if (referralChoice === otherOption && !otherReferral.trim() && form.referral !== otherOption) nextErrors.referral = 'Enter the referral source.'
    if (consultantChoice === otherOption && !otherConsultant.trim() && form.consultedBy !== otherOption) nextErrors.consultedBy = 'Enter the consultant.'
    if (isOtherProgramSelected && !form.otherProgramDetails.trim()) setOtherProgramError('Program / Training Interested In is required.')
    else setOtherProgramError('')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || (isOtherProgramSelected && !form.otherProgramDetails.trim())) return
    if (!enquiry && (isLoadingCourses || courseLoadError || !courses.some((course) => course.courseName === payload.courseInterestedIn))) {
      setErrors((current) => ({ ...current, courseInterestedIn: courseLoadError ? 'Courses could not be loaded. Try again before adding an enquiry.' : 'Choose a course from the active Course Codes list.' }))
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setSubmitError('')
    try {
      const result = enquiry
        ? await updateEnquiry(enquiry.enquiryId, { ...payload, status })
        : await createEnquiry(payload)
      onSaved(result.data, result.indexWarning)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the enquiry.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      title={enquiry ? 'Edit enquiry' : 'New enquiry'}
      description={enquiry ? `Update ${enquiry.fullName}'s enquiry.` : 'Add a prospective student to the directory.'}
      onClose={() => { if (!savingRef.current) onClose() }}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button><Button type="submit" form="enquiry-form" disabled={isSaving}>{isSaving ? 'Saving...' : enquiry ? 'Save Changes' : 'Add Enquiry'}</Button></>}
    >
      <form id="enquiry-form" className="enquiry-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submitError && <p className="enquiries-form-error" role="alert">{submitError}</p>}
        <section className="enquiry-form__section">
          <h3>Basic Information</h3>
          <div className="enquiry-form__grid">
            <Input id="enquiry-name" name="fullName" label="Full Name" value={form.fullName} onChange={handleChange} error={errors.fullName} required />
            <Input id="enquiry-mobile" name="mobileNumber" label="Mobile Number" type="tel" inputMode="tel" value={form.mobileNumber} onChange={handleChange} error={errors.mobileNumber} required />
            <Input id="enquiry-email" name="email" label="Email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
            <Input id="enquiry-college" name="college" label="College" value={form.college} onChange={handleChange} />
          </div>
        </section>

        <section className="enquiry-form__section">
          <h3>Education</h3>
          <div className="enquiry-form__grid">
            <Select id="enquiry-education-level" label="Education Level" options={[{ label: 'Select education level', value: '' }, ...educationLevelOptions.map((value) => ({ label: value, value }))]} value={educationLevelChoice} onChange={(event) => handleEducationLevelChange(event.target.value)} error={educationLevelChoice === otherOption ? undefined : errors.educationLevel} required />
            {educationLevelChoice === otherOption && <Input id="enquiry-specify-education" label="Specify Education" value={otherEducationLevel} onChange={(event) => { setOtherEducationLevel(event.target.value); setForm((current) => ({ ...current, educationLevel: event.target.value })); setErrors((current) => ({ ...current, educationLevel: undefined })) }} error={errors.educationLevel} required />}
            <Select id="enquiry-specialization" label="Specialization" options={[{ label: educationLevelChoice ? 'Select specialization' : 'Select Education Level first', value: '' }, ...specializationValues.map((value) => ({ label: value, value }))]} value={specializationChoice} disabled={!educationLevelChoice} onChange={(event) => { setSpecializationChoice(event.target.value); setForm((current) => ({ ...current, specialization: event.target.value === otherOption ? '' : event.target.value })); setOtherSpecialization(''); setErrors((current) => ({ ...current, specialization: undefined })) }} error={specializationChoice === otherOption ? undefined : errors.specialization} />
            {specializationChoice === otherOption && <Input id="enquiry-specify-specialization" label="Specify Specialization" value={otherSpecialization} onChange={(event) => { setOtherSpecialization(event.target.value); setForm((current) => ({ ...current, specialization: event.target.value })); setErrors((current) => ({ ...current, specialization: undefined })) }} error={errors.specialization} required />}
            <Select id="enquiry-graduation" label="Year of Graduation" options={[{ label: 'Select year', value: '' }, ...graduationYearOptions.map((value) => ({ label: value, value })), { label: 'Currently Pursuing', value: 'Currently Pursuing' }, { label: otherOption, value: otherOption }]} value={graduationChoice} onChange={(event) => { setGraduationChoice(event.target.value); setForm((current) => ({ ...current, yearOfGraduation: event.target.value === otherOption ? '' : event.target.value })); setErrors((current) => ({ ...current, yearOfGraduation: undefined })) }} error={graduationChoice !== otherOption ? errors.yearOfGraduation : undefined} />
            {graduationChoice === otherOption && <Input id="enquiry-specify-graduation" label="Specify Graduation Year" inputMode="numeric" maxLength={4} value={otherGraduationYear} onChange={(event) => { const year = event.target.value.replace(/\D/g, '').slice(0, 4); setOtherGraduationYear(year); setForm((current) => ({ ...current, yearOfGraduation: year })); setErrors((current) => ({ ...current, yearOfGraduation: undefined })) }} error={errors.yearOfGraduation} required />}
          </div>
        </section>

        <section className="enquiry-form__section">
          <h3>Course Interest</h3>
          <div className="enquiry-form__grid">
            <SearchableSelect
              error={errors.courseInterestedIn || (courseLoadError && !enquiry ? 'Course list is unavailable. Try again before adding an enquiry.' : undefined)}
              label="Course Interested In"
              legacyHint="This saved course is not in the active Course Codes list. Choose a replacement or leave it unchanged."
              loading={isLoadingCourses}
              loadingText="Loading active courses..."
              onChange={handleCourseChange}
              options={courseOptions}
              placeholder="Search course..."
              required
              value={form.courseInterestedIn}
            />
            {isOtherProgramSelected && <Input id="enquiry-other-program-details" label="Program / Training Interested In" value={form.otherProgramDetails} onChange={(event) => { setForm((current) => ({ ...current, otherProgramDetails: event.target.value })); setOtherProgramError('') }} error={otherProgramError} required />}
            {courseLoadError && <p className="field__message field__message--error enquiry-form__full" role="alert">Unable to load Course Codes: {courseLoadError}</p>}
            <Select id="enquiry-referral" label="Referral" options={[{ label: 'Select referral', value: '' }, ...referralOptions.map((value) => ({ label: value, value }))]} value={referralChoice} onChange={(event) => { setReferralChoice(event.target.value); setErrors((current) => ({ ...current, referral: undefined })) }} error={referralChoice !== otherOption ? errors.referral : undefined} />
            {referralChoice === otherOption && <Input id="enquiry-other-referral" label="Other Referral" value={otherReferral} onChange={(event) => { setOtherReferral(event.target.value); setErrors((current) => ({ ...current, referral: undefined })) }} error={errors.referral} required />}
            <Select id="enquiry-consulted" label="Consulted By" options={[{ label: 'Select consultant', value: '' }, ...consultantOptions.map((value) => ({ label: value, value }))]} value={consultantChoice} onChange={(event) => { setConsultantChoice(event.target.value); setErrors((current) => ({ ...current, consultedBy: undefined })) }} error={consultantChoice !== otherOption ? errors.consultedBy : undefined} />
            {consultantChoice === otherOption && <Input id="enquiry-other-consultant" label="Other Consultant" value={otherConsultant} onChange={(event) => { setOtherConsultant(event.target.value); setErrors((current) => ({ ...current, consultedBy: undefined })) }} error={errors.consultedBy} required />}
          </div>
        </section>

        <section className="enquiry-form__section">
          <h3>Additional Information</h3>
          <div className="enquiry-form__grid">
            <Input id="enquiry-date" name="enquiryDate" label="Enquiry Date" type="date" value={form.enquiryDate} onChange={handleChange} error={errors.enquiryDate} required />
            {enquiry && (enquiry.status === 'Converted' ? (
              <div className="enquiry-form__readonly">
                <span>Status</span><strong>Converted</strong>
                {enquiry.admissionId ? (
                  <Button variant="secondary" onClick={() => onViewAdmission(enquiry.admissionId)}>View Admission {enquiry.admissionId}</Button>
                ) : <span className="enquiry-form__status-warning">This enquiry has no linked Admission ID. Its conversion must be recovered before changing its status.</span>}
              </div>
            ) : <Select id="enquiry-status" label="Status" options={enquiryStatuses.map((value) => ({ label: value, value }))} value={status} onChange={(event) => handleStatusChange(event.target.value as EnquiryRecord['status'])} />)}
            {statusError && <p className="enquiries-form-error enquiry-form__status-error" role="alert">{statusError}</p>}
            {enquiry?.admissionId && <div className="enquiry-form__readonly"><span>Admission ID</span><strong>{enquiry.admissionId}</strong></div>}
            <Textarea containerClassName="enquiry-form__full" id="enquiry-notes" name="notes" label="Notes / Remarks" rows={3} value={form.notes} onChange={handleChange} />
          </div>
        </section>
      </form>
    </Modal>
  )
}