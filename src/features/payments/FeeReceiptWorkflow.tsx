import {
  Banknote,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input, Select, Textarea } from '../../components/ui'
import { formatAmountInput, parseAmount } from '../../utils/amount'
import { createPayment, fetchStudents } from '../../services/api'
import type { Student } from '../students/studentTypes'
import { toPaymentSnapshot } from '../students/studentWorkflow'
import { WorkflowProgress } from '../workflow/WorkflowProgress'
import { useWorkflow } from '../workflow/useWorkflow'
import type { AdmissionSnapshot, PaymentRecord } from '../workflow/workflowTypes'
import { FeeReceipt } from './FeeReceipt'
import { feeTypeOptions, paymentModeOptions } from './paymentOptions'
import {
  createEmailUrl,
  createWhatsAppUrl,
  downloadReceiptPdf,
} from './receiptActions'

interface PaymentFormData {
  amountPaid: string
  feeType: string
  paymentDate: string
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
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function openExternalLink(url: string, newTab = false) {
  const link = document.createElement('a')
  link.href = url
  if (newTab) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  link.click()
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
      const resultSets = await Promise.all([
        fetchStudents({ name: query }),
        fetchStudents({ studentId: query }),
        fetchStudents({ mobile: query }),
      ])
      const records = Array.from(new Map(resultSets.flat().map((student) => [student.studentId, student])).values())
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

function PaymentForm({ admission, onGenerated }: {
  admission: AdmissionSnapshot
  onGenerated: (payment: PaymentRecord) => void
}) {
  const initialForm: PaymentFormData = {
    amountPaid: '',
    feeType: '',
    paymentDate: getLocalDate(),
    paymentMode: '',
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
  const showUpiQr = formData.paymentMode === 'UPI'
  const hasPaymentAmount = Number.isFinite(currentPayment) && currentPayment > 0

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
    if (!formData.paymentMode) nextErrors.paymentMode = 'Select a payment mode.'
    if (!formData.paymentDate) nextErrors.paymentDate = 'Select a payment date.'
    if (!formData.feeType) nextErrors.feeType = 'Select a fee type.'

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
        paymentMode: formData.paymentMode,
        paymentDate: formData.paymentDate,
        feeType: formData.feeType,
        remarks: formData.remarks.trim(),
      })
      const { receipt } = result
      onGenerated({
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
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create the payment receipt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="payment-form" noValidate onSubmit={handleSubmit}>
      <div className={`payment-form__content${showUpiQr ? ' payment-form__content--upi' : ''}`}>
        <Card className="payment-card">
          <header className="payment-card__header">
            <div className="student-summary__icon" aria-hidden="true"><Banknote size={20} /></div>
            <div><span>Fee collection</span><h2>Payment details</h2></div>
          </header>
          <div className="payment-form__fields">
            <Input id="amountPaid" name="amountPaid" label="Amount Paid" required inputMode="decimal" placeholder="0.00" value={formData.amountPaid} error={errors.amountPaid} onChange={handleAmountChange} />
            <Select id="paymentMode" name="paymentMode" label="Payment Mode" required options={paymentModeOptions} value={formData.paymentMode} error={errors.paymentMode} onChange={handleChange} />
            <Input id="paymentDate" name="paymentDate" label="Payment Date" required type="date" value={formData.paymentDate} error={errors.paymentDate} onChange={handleChange} />
            <Select id="feeType" name="feeType" label="Fee Type" required options={feeTypeOptions} value={formData.feeType} error={errors.feeType} onChange={handleChange} />
            <Textarea containerClassName="payment-form__full" id="paymentRemarks" name="remarks" label="Remarks" rows={3} value={formData.remarks} onChange={handleChange} />
          </div>
        </Card>

        {showUpiQr && (
          <Card className="upi-payment-card">
            <header className="upi-payment-card__header"><span>Pay via UPI</span><h2>Scan to pay</h2></header>
            <p className="upi-payment-card__intro">Scan the QR code below to make the payment.</p>
            <img className="upi-payment-card__qr" src={`${import.meta.env.BASE_URL}imgs/upi-qr.jpg`} alt="LSA UPI payment QR code" />
            <div className="upi-payment-card__amount"><span>Amount to pay</span><strong>{hasPaymentAmount ? formatCurrency(currentPayment) : 'Enter payment amount'}</strong></div>
            <ol className="upi-payment-card__steps"><li>Open any UPI app.</li><li>Scan the QR code.</li><li>Enter and confirm the payment amount.</li><li>Complete the payment.</li><li>Verify payment before recording it.</li></ol>
            <p className="upi-payment-card__warning"><ShieldAlert aria-hidden="true" size={16} />Verify the payment in your UPI app/bank confirmation before recording the payment.</p>
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
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving Payment...' : 'Generate Receipt'}</Button>
        <p>Payment totals and receipt ID are confirmed by the LSA Admin API.</p>
      </div>
      {submitError && <p className="receipt-actions__error" role="alert">{submitError}</p>}
    </form>
  )
}

function ReceiptPreview({
  admission,
  onSelectReceipt,
  payment,
  receipts,
}: {
  admission: AdmissionSnapshot
  onSelectReceipt: (payment: PaymentRecord) => void
  payment: PaymentRecord
  receipts: PaymentRecord[]
}) {
  const receiptRef = useRef<HTMLElement>(null)
  const [actionError, setActionError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleDownload() {
    if (!receiptRef.current || isDownloading) return
    setActionError('')
    setIsDownloading(true)
    try {
      await downloadReceiptPdf(receiptRef.current, payment.receiptId)
    } catch {
      setActionError('Unable to generate the receipt PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleEmail() {
    const emailUrl = createEmailUrl(admission, payment)
    if (!emailUrl) {
      setActionError('No email address available for this student.')
      return
    }
    setActionError('')
    openExternalLink(emailUrl)
  }

  function handleWhatsApp() {
    const whatsappUrl = createWhatsAppUrl(admission, payment)
    if (!whatsappUrl) {
      setActionError(
        admission.mobileNumber.trim()
          ? 'Unable to open WhatsApp. Please check the mobile number.'
          : 'No mobile number available for this student.',
      )
      return
    }
    setActionError('')
    openExternalLink(whatsappUrl, true)
  }

  return (
    <div className="receipt-stage">
      <section className="receipt-history" aria-labelledby="receipt-history-title">
        <div className="receipt-history__header">
          <div>
            <h2 id="receipt-history-title">Payment receipts</h2>
            <p>All receipts for {admission.studentName}</p>
          </div>
          <span>{receipts.length} receipts</span>
        </div>
        <div className="receipt-history__list">
          {receipts.map((receipt) => (
            <button
              className={`receipt-history__item${receipt.paymentId === payment.paymentId ? ' receipt-history__item--active' : ''}`}
              type="button"
              aria-pressed={receipt.paymentId === payment.paymentId}
              key={receipt.paymentId}
              onClick={() => onSelectReceipt(receipt)}
            >
              <span>{receipt.receiptId}</span>
              <strong>{formatCurrency(receipt.amountPaid)}</strong>
              <small>{receipt.paymentDate} · {receipt.feeType}</small>
            </button>
          ))}
        </div>
      </section>

      <FeeReceipt admission={admission} payment={payment} ref={receiptRef} />

      <div className="receipt-actions">
        <Button onClick={handleDownload} disabled={isDownloading}><Download aria-hidden="true" size={16} />Download PDF</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" size={16} />Print</Button>
        <Button variant="secondary" onClick={handleEmail}><Mail aria-hidden="true" size={16} />Send Email</Button>
        <Button variant="secondary" onClick={handleWhatsApp}><MessageCircle aria-hidden="true" size={16} />WhatsApp</Button>
      </div>
      {actionError && <p className="receipt-actions__error" role="alert">{actionError}</p>}
    </div>
  )
}

export function FeeReceiptWorkflow() {
  const location = useLocation()
  const navigate = useNavigate()
  const { admission, payment, setAdmission, setPayment } = useWorkflow()
  const routeState = location.state as WorkflowRouteState
  const hasSelectedStudent = Boolean(
    (routeState?.fromAdmission || routeState?.fromStudent) && admission,
  )
  const currentStep = payment ? 'receipt' : 'payment'
  const receipts = payment && admission
    ? [
        payment,
      ]
        .filter((record, index, records) =>
          records.findIndex((candidate) => candidate.paymentId === record.paymentId) === index,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : []

  if (!hasSelectedStudent || !admission) {
    return <DirectStudentLookup onSelect={(student) => {
      setAdmission(toPaymentSnapshot(student))
      navigate('/fee-receipt', { replace: true, state: { fromStudent: true } })
    }} />
  }

  return (
    <>
      <WorkflowProgress current={currentStep} />
      <StudentSummary admission={admission} />
      {payment ? (
        <ReceiptPreview
          admission={admission}
          payment={payment}
          receipts={receipts}
          onSelectReceipt={setPayment}
        />
      ) : (
        <PaymentForm admission={admission} onGenerated={setPayment} />
      )}
    </>
  )
}