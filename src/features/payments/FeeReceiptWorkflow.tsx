import {
  Banknote,
  CheckCircle2,
  FileText,
  Search,
} from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input, Textarea } from '../../components/ui'
import { formatAmountInput, parseAmount } from '../../utils/amount'
import { createPayment, fetchStudents } from '../../services/api'
import type { Student } from '../students/studentTypes'
import { toPaymentSnapshot } from '../students/studentWorkflow'
import { WorkflowProgress } from '../workflow/WorkflowProgress'
import { useWorkflow } from '../workflow/useWorkflow'
import type { AdmissionSnapshot, PaymentRecord } from '../workflow/workflowTypes'

interface PaymentFormData {
  amountPaid: string
  paymentDate: string
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
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
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
        <div><dt>Course</dt><dd>{admission.course}</dd></div>
        <div><dt>Batch</dt><dd>{admission.batchNumber}</dd></div>
        <div><dt>Enrollment</dt><dd>{admission.enrollmentMonth} {admission.enrollmentYear}</dd></div>
        <div><dt>Course Fee</dt><dd>{formatCurrency(admission.finalFee)}</dd></div>
      </dl>
    </Card>
  )
}

function DirectStudentLookup({ onSelect }: { onSelect: (student: Student) => void }) {
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim() || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      const records = await fetchStudents({ search: query })
      setStudents(records.map((student) => ({
        ...student,
        discountPercentage: student.totalCourseFee ? (student.discount / student.totalCourseFee) * 100 : 0,
        totalPaid: student.totalPaid ?? 0,
        balance: student.balance ?? student.finalFee,
      })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search students.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="student-lookup">
      <Card>
        <div className="student-lookup__header"><div className="student-summary__icon" aria-hidden="true"><Search size={20} /></div><div><h2>Find an existing student</h2><p>Search by student name, admission number, or mobile number.</p></div></div>
        <form className="student-lookup__form" role="search" onSubmit={handleSearch}>
          <Input id="studentSearch" label="Student name or admission number" placeholder="Search existing students" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button type="submit" disabled={isLoading}><Search aria-hidden="true" size={16} />{isLoading ? 'Searching...' : 'Search Students'}</Button>
        </form>
      </Card>
      {error && <p className="receipt-actions__error" role="alert">{error}</p>}
      {students.map((student) => <Card className="student-lookup__result" key={student.studentId}><div><strong>{student.fullName}</strong><span>{student.studentId} · {student.course} · Batch {student.batch}</span></div><Button onClick={() => onSelect(student)}>Select Student</Button></Card>)}
    </section>
  )
}

function PaymentForm({ admission, onRecorded }: {
  admission: AdmissionSnapshot
  onRecorded: (payment: PaymentRecord) => void
}) {
  const initialForm: PaymentFormData = {
    amountPaid: '',
    paymentDate: getLocalDate(),
    remarks: '',
  }
  const [formData, setFormData] = useState(initialForm)
  const [errors, setErrors] = useState<PaymentErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const previousPaid = admission.previousPaid
  const currentPayment = parseAmount(formData.amountPaid)
  const totalPaid = previousPaid + currentPayment
  const balance = Math.max(admission.finalFee - totalPaid, 0)

  function updateField(field: keyof PaymentFormData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
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
    } else if (amount > admission.finalFee - previousPaid) {
      nextErrors.amountPaid = 'Payment cannot exceed the remaining balance.'
    }
    if (!formData.paymentDate) nextErrors.paymentDate = 'Select a payment date.'

    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const nextErrors = validate()
    setErrors(nextErrors)

    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      document.getElementById(firstError)?.focus()
      return
    }

    setSubmitError('')
    setIsSubmitting(true)
    try {
      const result = await createPayment({
        studentId: admission.admissionNumber,
        course: admission.course,
        amountPaid: currentPayment,
        paymentDate: formData.paymentDate,
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
        feeType: '',
        amountPaid: currentPayment,
        paymentMode: '',
        previousPaid: receipt.previousPaid,
        totalPaid: receipt.totalPaid,
        balance: receipt.balance,
        createdBy: '',
        createdAt: new Date().toISOString(),
        remarks: formData.remarks,
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="payment-form" noValidate onSubmit={handleSubmit}>
      <div className="payment-form__content">
        <Card className="payment-card">
          <header className="payment-card__header">
            <div className="student-summary__icon" aria-hidden="true"><Banknote size={20} /></div>
            <div><span>Fee collection</span><h2>Payment details</h2></div>
          </header>
          <div className="payment-form__fields">
            <Input id="amountPaid" name="amountPaid" label="Amount Paid" required inputMode="decimal" placeholder="0.00" value={formData.amountPaid} error={errors.amountPaid} onChange={handleAmountChange} />
            <Input id="paymentDate" name="paymentDate" label="Payment Date" required type="date" value={formData.paymentDate} error={errors.paymentDate} onChange={handleChange} />
            <Textarea containerClassName="payment-form__full" id="paymentRemarks" name="remarks" label="Remarks" rows={3} value={formData.remarks} onChange={handleChange} />
          </div>
        </Card>
      </div>

      <section className="payment-totals" aria-label="Payment calculation">
        <div><span>Previous Paid</span><strong>{formatCurrency(previousPaid)}</strong></div>
        <div><span>Current Payment</span><strong>{formatCurrency(currentPayment)}</strong></div>
        <div><span>Total Paid</span><strong>{formatCurrency(totalPaid)}</strong></div>
        <div className="payment-totals__balance"><span>Remaining Balance</span><strong>{formatCurrency(balance)}</strong></div>
      </section>

      <div className="payment-form__actions">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving Payment...' : 'Save Payment'}</Button>
        <p>Payment totals are confirmed by the LSA Admin API.</p>
      </div>
      {submitError && <p className="receipt-actions__error" role="alert">{submitError}</p>}
    </form>
  )
}

function PaymentSuccess({
  admission,
  onDone,
  payment,
}: {
  admission: AdmissionSnapshot
  onDone: () => void
  payment: PaymentRecord
}) {
  return (
    <Card className="payment-success">
      <header className="payment-card__header">
        <div className="student-summary__icon" aria-hidden="true"><CheckCircle2 size={20} /></div>
        <div><span>Payment saved</span><h2>Payment Recorded Successfully</h2></div>
      </header>
      <dl className="student-summary__grid">
        <div><dt>Student</dt><dd>{admission.studentName}</dd></div>
        <div><dt>Admission Number</dt><dd>{admission.admissionNumber}</dd></div>
        <div><dt>Course</dt><dd>{admission.course}</dd></div>
        <div><dt>Final Fee</dt><dd>{formatCurrency(admission.finalFee)}</dd></div>
        <div><dt>Previous Paid</dt><dd>{formatCurrency(payment.previousPaid)}</dd></div>
        <div><dt>Current Payment</dt><dd>{formatCurrency(payment.amountPaid)}</dd></div>
        <div><dt>Total Paid</dt><dd>{formatCurrency(payment.totalPaid)}</dd></div>
        <div><dt>Pending Balance</dt><dd>{formatCurrency(payment.balance)}</dd></div>
      </dl>
      <div className="payment-form__actions"><Button onClick={onDone}>Done</Button></div>
    </Card>
  )
}

export function FeeReceiptWorkflow() {
  const location = useLocation()
  const navigate = useNavigate()
  const { admission, payment, clearWorkflow, setAdmission, setPayment } = useWorkflow()
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
          onDone={() => {
            clearWorkflow()
            navigate('/payment-history')
          }}
        />
      ) : (
        <PaymentForm admission={admission} onRecorded={setPayment} />
      )}
    </>
  )
}