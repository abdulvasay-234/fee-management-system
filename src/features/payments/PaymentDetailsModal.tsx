import { Banknote, FileText, UserRound, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '../../components/ui'
import type { Student } from '../students/studentTypes'
import type { PaymentRecord } from '../workflow/workflowTypes'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

interface PaymentDetailsModalProps {
  onClose: () => void
  onMakePayment: (student: Student) => void
  onViewReceipt: (payment: PaymentRecord, student: Student) => void
  onViewStudent: (student: Student) => void
  payment: PaymentRecord
  student: Student
}

function DetailSection({
  title,
  values,
}: {
  title: string
  values: Array<{ label: string; value: string }>
}) {
  return (
    <section className="payment-detail-section">
      <h3>{title}</h3>
      <dl className="payment-detail-grid">
        {values.map(({ label, value }) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  )
}

export function PaymentDetailsModal({
  onClose,
  onMakePayment,
  onViewReceipt,
  onViewStudent,
  payment,
  student,
}: PaymentDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="payment-detail-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="payment-detail-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="payment-detail-modal__header">
          <div>
            <span>Payment record</span>
            <h2 id="payment-detail-title">{payment.receiptId}</h2>
            <p>{payment.studentName} · {payment.paymentDate}</p>
          </div>
          <Button variant="secondary" iconOnly aria-label="Close payment details" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </Button>
        </header>
        <div className="payment-detail-modal__body">
          <DetailSection
            title="Payment Details"
            values={[
              { label: 'Receipt ID', value: payment.receiptId },
              { label: 'Payment Date', value: payment.paymentDate },
              { label: 'Fee Type', value: payment.feeType },
              { label: 'Amount Paid', value: currencyFormatter.format(payment.amountPaid) },
              { label: 'Payment Mode', value: payment.paymentMode },
            ]}
          />
          <DetailSection
            title="Student Details"
            values={[
              { label: 'Admission Number', value: payment.studentId },
              { label: 'Student Name', value: payment.studentName },
              { label: 'Course', value: payment.course },
              { label: 'Batch', value: payment.batch },
              { label: 'Enrollment Month', value: payment.enrollmentMonth },
              { label: 'Enrollment Year', value: payment.enrollmentYear },
            ]}
          />
          <DetailSection
            title="Fee Summary"
            values={[
              { label: 'Final Course Fee', value: currencyFormatter.format(student.finalFee) },
              { label: 'Previous Paid', value: currencyFormatter.format(payment.previousPaid) },
              { label: 'Amount Paid', value: currencyFormatter.format(payment.amountPaid) },
              { label: 'Total Paid', value: currencyFormatter.format(payment.totalPaid) },
              { label: 'Balance', value: currencyFormatter.format(payment.balance) },
            ]}
          />
          {payment.remarks && (
            <section className="payment-detail-section">
              <h3>Remarks</h3>
              <p>{payment.remarks}</p>
            </section>
          )}
        </div>
        <footer className="payment-detail-modal__footer">
          <Button variant="secondary" onClick={() => onViewStudent(student)}><UserRound aria-hidden="true" size={15} />View Student</Button>
          <Button variant="secondary" onClick={() => onViewReceipt(payment, student)}><FileText aria-hidden="true" size={15} />View Receipt</Button>
          <Button onClick={() => onMakePayment(student)}><Banknote aria-hidden="true" size={15} />Make Another Payment</Button>
        </footer>
      </section>
    </div>
  )
}