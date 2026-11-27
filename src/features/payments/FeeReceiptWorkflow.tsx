import {
  Banknote,
  CheckCircle2,
  FileText,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input, Select, Textarea } from '../../components/ui'
import { formatAmountInput, parseAmount, sumMoney } from '../../utils/amount'
import { createPayment, fetchStudent, fetchStudents } from '../../services/api'
import type { Student } from '../students/studentTypes'
import { toPaymentSnapshot, toStudent } from '../students/studentWorkflow'
import { WorkflowProgress } from '../workflow/WorkflowProgress'
import { useWorkflow } from '../workflow/useWorkflow'
import type { AdmissionSnapshot, PaymentRecord } from '../workflow/workflowTypes'
import { feeTypeOptions, paymentModeOptions } from './paymentOptions'
import { createAdmissionConfirmationUrl, createPaymentAcknowledgementUrl } from './receiptActions'
import { CourseLabel } from '../courseCodes/CourseLabel'
import { useSaveProtection } from '../../hooks/useSaveProtection'
import { courseNavigation } from '../students/studentDirectoryUtils'
import { changePaymentFilter, emptyPaymentFilters, filterStudentFees, paymentBatchOptions, type FeeStatusFilter } from './paymentDirectoryUtils'

interface PaymentFormData {
  amountPaid: string
  paymentDate: string
  feeType: string
  paymentMode: string
  remarks: string
}

type PaymentErrors = Partial<Record<keyof PaymentFormData, string>>
type WorkflowRouteState = { fromAdmission?: boolean; fromStudent?: boolean } | null

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function getLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function StudentSummary({ admission }: { admission: AdmissionSnapshot }) {
  return (
    <Card className="student-summary">
      <header className="student-summary__header">
        <div className="student-summary__icon" aria-hidden="true">
          <FileText size={20} />
        </div>
        <div>
          <span>Registered admission</span>
          <h2>Student summary</h2>
        </div>
        <Badge variant="navy">Read only</Badge>
      </header>
      <dl className="student-summary__grid">
        <div><dt>Student</dt><dd>{admission.studentName}</dd></div>
        <div><dt>Admission Number</dt><dd>{admission.admissionNumber}</dd></div>
        <div><dt>Course</dt><dd><CourseLabel name={admission.course} /></dd></div>
        <div><dt>Batch</dt><dd>{admission.batchNumber}</dd></div>
        <div><dt>Enrollment</dt><dd>{admission.enrollmentMonth} {admission.enrollmentYear}</dd></div>
        <div><dt>Course Fee</dt><dd>{formatCurrency(admission.finalFee)}</dd></div>
      </dl>
    </Card>
  )
}

function DirectStudentLookup({ onSelect }: { onSelect: (student: Student) => void }) {
  const [filters, setFilters] = useState(emptyPaymentFilters)
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const selectionVersion = useRef(0)
  const selectionPending = useRef(false)

  useEffect(() => () => { selectionVersion.current++ }, [])

  useEffect(() => {
    let active = true
    void fetchStudents().then((records) => {
      if (!active) return
      const loadedStudents = records.map(toStudent)
      setStudents(loadedStudents)
      setFilters((current) => current.batch && !paymentBatchOptions(loadedStudents, [], current).includes(current.batch)
        ? { ...current, batch: '' } : current)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load students.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [refreshRevision])

  const matchingStudents = filterStudentFees(students, filters)
  const courses = courseNavigation([], students)
  const batches = paymentBatchOptions(students, [], filters)

  function refreshStudents() {
    setIsLoading(true)
    setError('')
    setSelectionError('')
    setRefreshRevision((revision) => revision + 1)
  }

  async function selectStudent(studentId: string) {
    if (selectionPending.current) return
    selectionPending.current = true
    const version = ++selectionVersion.current
    setSelectedId(studentId)
    setSelectionError('')
    try {
      const details = await fetchStudent(studentId)
      if (details.student.studentId !== studentId) throw new Error('The API returned a different student. Refresh the list and try again.')
      if (version === selectionVersion.current) onSelect(toStudent(details.student))
    } catch (cause) {
      if (version === selectionVersion.current) setSelectionError(cause instanceof Error ? cause.message : 'Unable to load the selected student.')
    } finally {
      if (version === selectionVersion.current) {
        selectionPending.current = false
        setSelectedId('')
      }
    }
  }

  return (
    <section className="student-lookup">
      <Card>
        <div className="student-lookup__header"><div className="student-summary__icon" aria-hidden="true"><Search size={20} /></div><div><h2>Find an existing student</h2><p>Search by student name, admission number, or mobile number.</p></div></div>
        <div className="student-lookup__form" role="search" aria-label="Find a student">
          <Input id="studentSearch" label="Student name, admission number or mobile" placeholder="Start typing to find a student" value={filters.query} disabled={Boolean(selectedId)} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} />
          <Button variant="secondary" disabled={isLoading || Boolean(selectedId)} onClick={refreshStudents}><RefreshCw aria-hidden="true" size={16} />Refresh Students</Button>
          <div className="student-lookup__filters">
            <Select id="lookupCourse" label="Course" disabled={isLoading || Boolean(selectedId)} value={filters.course} options={[{ label: 'All Courses', value: '' }, ...courses.map((course) => ({ label: course.name, value: course.name }))]} onChange={(event) => setFilters((current) => changePaymentFilter(current, 'course', event.target.value, students, []))} />
            <Select id="lookupBatch" label="Batch" disabled={isLoading || Boolean(selectedId)} value={filters.batch} options={[{ label: 'All Batches', value: '' }, ...batches.map((batch) => ({ label: `Batch ${batch}`, value: batch }))]} onChange={(event) => setFilters((current) => ({ ...current, batch: event.target.value }))} />
            <Select id="lookupStatus" label="Fee Status" disabled={isLoading || Boolean(selectedId)} value={filters.status} options={[{ label: 'All Fee Statuses', value: '' }, { label: 'Pending', value: 'pending' }, { label: 'Fully Paid', value: 'paid' }]} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FeeStatusFilter }))} />
            <Button variant="secondary" disabled={Boolean(selectedId)} onClick={() => setFilters(emptyPaymentFilters)}><RotateCcw aria-hidden="true" size={16} />Reset Filters</Button>
          </div>
        </div>
      </Card>
      {error && <p className="receipt-actions__error" role="alert">{error}</p>}
      {selectionError && <p className="receipt-actions__error" role="alert">{selectionError}</p>}
      {isLoading ? <p role="status">Loading students...</p> : !error && (
        <section className="student-lookup__results" aria-label="Matching students">
          <div className="student-lookup__results-heading"><h2>Available students</h2><span role="status">{matchingStudents.length} matching students</span></div>
          {!matchingStudents.length && <p>No students match your search or filters.</p>}
          {matchingStudents.map((student) => <Card className="student-lookup__result" key={student.studentId}><div><strong>{student.fullName}</strong><span>{student.studentId} · <CourseLabel name={student.course} /> · Batch {student.batch}</span><span>{student.mobileNumber}</span></div><div className="student-lookup__result-fees"><span>{student.balance > 0 ? 'Pending Balance' : 'Fully Paid'}</span><strong>{formatCurrency(Math.max(student.balance, 0))}</strong></div><Button disabled={Boolean(selectedId)} onClick={() => void selectStudent(student.studentId)}>{selectedId === student.studentId ? 'Loading Student...' : 'Select Student'}</Button></Card>)}
        </section>
      )}
    </section>
  )
}

function PaymentForm({ admission, onRecorded }: {
  admission: AdmissionSnapshot
  onRecorded: (payment: PaymentRecord, warning?: string) => void
}) {
  const initialForm: PaymentFormData = {
    amountPaid: '',
    paymentDate: getLocalDate(),
    feeType: '',
    paymentMode: '',
    remarks: '',
  }
  const [formData, setFormData] = useState(initialForm)
  const [errors, setErrors] = useState<PaymentErrors>({})
  const [submitError, setSubmitError] = useState('')
  const { isSaving: isSubmitting, savingRef: submittingRef, startSaving, finishSaving } = useSaveProtection()
  const [upiQrError, setUpiQrError] = useState(false)
  const showUpiQr = formData.paymentMode === 'UPI'
  const isCashPayment = formData.paymentMode === 'Cash'

  const previousPaid = admission.previousPaid
  const currentPayment = parseAmount(formData.amountPaid)
  const totalPaid = sumMoney([previousPaid, currentPayment])
  const balance = sumMoney([admission.finalFee, -totalPaid])

  function updateField(field: keyof PaymentFormData, value: string) {
    if (submittingRef.current) return
    if (field === 'paymentMode') setUpiQrError(false)
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, ...(field === 'paymentMode' ? { remarks: undefined } : {}) }))
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    updateField(event.target.name as keyof PaymentFormData, event.target.value)
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const formattedValue = formatAmountInput(event.target.value)
    if (formattedValue !== null) updateField('amountPaid', formattedValue)
  }

  function validate() {
    const nextErrors: PaymentErrors = {}
    const amount = parseAmount(formData.amountPaid)

    if (!formData.amountPaid || !Number.isFinite(amount) || amount <= 0) {
      nextErrors.amountPaid = 'Enter a valid payment amount greater than zero.'
    } else if (Math.round(amount * 100) > Math.round(admission.finalFee * 100) - Math.round(previousPaid * 100)) {
      nextErrors.amountPaid = 'Payment cannot exceed the remaining balance.'
    }
    if (!formData.paymentDate) nextErrors.paymentDate = 'Select a payment date.'
    if (isCashPayment && !formData.remarks.trim()) nextErrors.remarks = 'Enter the LSA staff name who received the cash.'

    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const nextErrors = validate()
    setErrors(nextErrors)

    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      const field = event.currentTarget.elements.namedItem(firstError)
      if (field instanceof HTMLElement) field.focus()
      return
    }

    setSubmitError('')
    if (!startSaving()) return
    try {
      const result = await createPayment({
        studentId: admission.admissionNumber,
        course: admission.course,
        amountPaid: currentPayment,
        paymentDate: formData.paymentDate,
        feeType: formData.feeType,
        paymentMode: formData.paymentMode,
        remarks: formData.remarks.trim(),
      })
      const { receipt } = result
      onRecorded({
        paymentId: receipt.receiptId,
        receiptId: receipt.receiptId,
        studentId: receipt.studentId,
        studentName: admission.studentName,
        course: admission.course,
        batch: admission.batchNumber,
        enrollmentMonth: admission.enrollmentMonth,
        enrollmentYear: admission.enrollmentYear,
        paymentDate: formData.paymentDate,
        feeType: formData.feeType,
        amountPaid: currentPayment,
        paymentMode: formData.paymentMode,
        previousPaid: receipt.previousPaid,
        totalPaid: receipt.totalPaid,
        balance: receipt.balance,
        createdBy: '',
        createdAt: new Date().toISOString(),
        remarks: formData.remarks,
      }, result.indexWarning)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the payment.')
    } finally {
      finishSaving()
    }
  }

  return (
    <form className="payment-form" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit}>
      <div className={`payment-form__content${showUpiQr ? ' payment-form__content--upi' : ''}`}>
        <Card className="payment-card">
          <header className="payment-card__header">
            <div className="student-summary__icon" aria-hidden="true"><Banknote size={20} /></div>
            <div><span>Fee collection</span><h2>Payment details</h2></div>
          </header>
          <div className="payment-form__fields">
            <Input id="amountPaid" name="amountPaid" label="Amount Paid" required inputMode="decimal" placeholder="0.00" value={formData.amountPaid} error={errors.amountPaid} disabled={isSubmitting} onChange={handleAmountChange} />
            <Input id="paymentDate" name="paymentDate" label="Payment Date" required type="date" value={formData.paymentDate} error={errors.paymentDate} disabled={isSubmitting} onChange={handleChange} />
            <Select id="feeType" name="feeType" label="Fee Type" options={feeTypeOptions} value={formData.feeType} disabled={isSubmitting} onChange={handleChange} />
            <Select id="paymentMode" name="paymentMode" label="Payment Mode" options={paymentModeOptions} value={formData.paymentMode} disabled={isSubmitting} onChange={handleChange} />
            <Textarea
              containerClassName="payment-form__full"
              id="paymentRemarks"
              name="remarks"
              label={isCashPayment ? 'Remarks (LSA staff who received cash)' : 'Remarks'}
              required={isCashPayment}
              disabled={isSubmitting}
              placeholder={isCashPayment ? "Enter the receiving LSA staff member's name" : undefined}
              error={errors.remarks}
              rows={3}
              value={formData.remarks}
              onChange={handleChange}
            />
          </div>
        </Card>
        {showUpiQr && (
          <Card className="upi-payment-card" aria-label="UPI scan payment">
            <header className="upi-payment-card__header">
              <span>UPI Payment</span><h2>Scan &amp; Pay</h2>
            </header>
            <p className="upi-payment-card__intro">Scan this QR using your UPI app.</p>
            {upiQrError ? (
              <p className="receipt-actions__error" role="alert">The UPI QR could not be loaded. Reload the page or use another payment method.</p>
            ) : (
              <img
                className="upi-payment-card__qr"
                src={`${import.meta.env.BASE_URL}imgs/upi-qr.jpg`}
                alt="UPI payment QR code"
                onError={() => setUpiQrError(true)}
              />
            )}
            <div className="upi-payment-card__amount">
              <span>Amount to enter</span>
              <strong>{currentPayment > 0 ? formatCurrency(currentPayment) : 'Enter the payment amount'}</strong>
            </div>
            <p className="upi-payment-card__warning">Verify the receiver and pay the amount shown. Save only after confirming successful payment.</p>
          </Card>
        )}
      </div>

      <section className="payment-totals" aria-label="Payment calculation">
        <div><span>Previous Paid</span><strong>{formatCurrency(previousPaid)}</strong></div>
        <div><span>Current Payment</span><strong>{formatCurrency(currentPayment)}</strong></div>
        <div><span>Total Paid</span><strong>{formatCurrency(totalPaid)}</strong></div>
        <div className="payment-totals__balance"><span>Remaining Balance</span><strong>{formatCurrency(balance)}</strong></div>
      </section>

      <div className="payment-form__actions">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving Payment...' : 'Save Payment'}</Button>
      </div>
      {submitError && <p className="receipt-actions__error" role="alert">{submitError}</p>}
    </form>
  )
}

function PaymentSuccess({
  admission,
  onDone,
  payment,
  warning,
}: {
  admission: AdmissionSnapshot
  onDone: () => void
  payment: PaymentRecord
  warning?: string
}) {
  const whatsappUrl = createPaymentAcknowledgementUrl(admission, payment)
  const showAdmissionConfirmation = payment.previousPaid === 0
  const admissionWhatsappUrl = showAdmissionConfirmation ? createAdmissionConfirmationUrl(admission, payment) : null

  return (
    <Card className="payment-success">
      <header className="payment-card__header">
        <div className="student-summary__icon" aria-hidden="true"><CheckCircle2 size={20} /></div>
        <div><span>Payment saved</span><h2>Payment Recorded Successfully</h2></div>
      </header>
      <dl className="student-summary__grid">
        <div><dt>Student</dt><dd>{admission.studentName}</dd></div>
        <div><dt>Admission Number</dt><dd>{admission.admissionNumber}</dd></div>
        <div><dt>Course</dt><dd><CourseLabel name={admission.course} /></dd></div>
        <div><dt>Final Fee</dt><dd>{formatCurrency(admission.finalFee)}</dd></div>
        <div><dt>Previous Paid</dt><dd>{formatCurrency(payment.previousPaid)}</dd></div>
        <div><dt>Current Payment</dt><dd>{formatCurrency(payment.amountPaid)}</dd></div>
        <div><dt>Total Paid</dt><dd>{formatCurrency(payment.totalPaid)}</dd></div>
        <div><dt>Pending Balance</dt><dd>{formatCurrency(payment.balance)}</dd></div>
      </dl>
      {warning && <p className="receipt-actions__error" role="alert">Payment saved, but {warning} Do not submit it again; contact an administrator.</p>}
      <div className="payment-form__actions">
        <Button onClick={onDone}>Done</Button>
        {whatsappUrl ? (
          <a className="button button--secondary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" size={16} />Send WhatsApp Message
          </a>
        ) : (
          <Button variant="secondary" disabled><MessageCircle aria-hidden="true" size={16} />Send WhatsApp Message</Button>
        )}
        {showAdmissionConfirmation && (admissionWhatsappUrl ? (
          <a className="button button--secondary" href={admissionWhatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" size={16} />Send Admission Confirmation
          </a>
        ) : (
          <Button variant="secondary" disabled><MessageCircle aria-hidden="true" size={16} />Send Admission Confirmation</Button>
        ))}
      </div>
      {!whatsappUrl && <p className="receipt-actions__error" role="alert">WhatsApp is unavailable. Check the student's mobile number and payment date.</p>}
      {showAdmissionConfirmation && !admissionWhatsappUrl && <p className="receipt-actions__error" role="alert">Admission confirmation is unavailable. Check the student's mobile number, admission details and class timings.</p>}
    </Card>
  )
}

export function FeeReceiptWorkflow() {
  const location = useLocation()
  const navigate = useNavigate()
  const { admission, payment, clearWorkflow, setAdmission, setPayment } = useWorkflow()
  const [paymentWarning, setPaymentWarning] = useState('')
  const routeState = location.state as WorkflowRouteState
  const hasSelectedStudent = Boolean(
    (routeState?.fromAdmission || routeState?.fromStudent) && admission,
  )

  if (!hasSelectedStudent || !admission) {
    return <DirectStudentLookup onSelect={(student) => {
      setAdmission(toPaymentSnapshot(student))
      navigate('/fee-receipt', { replace: true, state: { fromStudent: true } })
    }} />
  }

  return (
    <>
      <WorkflowProgress current="payment" />
      <StudentSummary admission={admission} />
      {payment ? (
        <PaymentSuccess
          admission={admission}
          payment={payment}
          warning={paymentWarning}
          onDone={() => {
            clearWorkflow()
            navigate('/payment-history')
          }}
        />
      ) : (
        <PaymentForm admission={admission} onRecorded={(record, warning) => { setPayment(record); setPaymentWarning(warning ?? '') }} />
      )}
    </>
  )
}