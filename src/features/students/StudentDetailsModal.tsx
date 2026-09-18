import { Banknote, ChevronRight, X } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table } from '../../components/ui'
import type { PaymentRecord } from '../workflow/workflowTypes'
import type { Student } from './studentTypes'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
}

function DetailGroup({
  title,
  values,
}: {
  title: string
  values: Array<{ label: string; value: string }>
}) {
  return (
    <section className="student-detail-group">
      <h3>{title}</h3>
      <dl className="student-detail-grid">
        {values.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || 'Not provided'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

interface StudentDetailsModalProps {
  onClose: () => void
  onMakePayment: (student: Student) => void
  payments: PaymentRecord[]
  student: Student
}

export function StudentDetailsModal({
  onClose,
  onMakePayment,
  payments,
  student,
}: StudentDetailsModalProps) {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="student-detail-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="student-detail-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="student-detail-modal__header">
          <div>
            <span>Student record</span>
            <h2 id="student-detail-title">{student.fullName}</h2>
            <p>{student.studentId} · {student.course}</p>
          </div>
          <Button variant="secondary" iconOnly aria-label="Close student details" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </Button>
        </header>

        <div className="student-detail-modal__body">
          <section className="student-fee-summary" aria-label="Fee summary">
            <div><span>Final Fee</span><strong>{currencyFormatter.format(student.finalFee)}</strong></div>
            <div><span>Paid</span><strong>{currencyFormatter.format(student.totalPaid)}</strong></div>
            <div className="student-fee-summary__balance"><span>Balance</span><strong>{currencyFormatter.format(student.balance)}</strong></div>
            <Button onClick={() => onMakePayment(student)}>
              <Banknote aria-hidden="true" size={16} />
              Make Payment
            </Button>
          </section>

          <DetailGroup
            title="Student Information"
            values={[
              { label: 'Admission Number', value: student.studentId },
              { label: 'Full Name', value: student.fullName },
              { label: "Father's Name", value: student.fatherName },
              { label: "Mother's Name", value: student.motherName },
              { label: 'Date of Birth', value: student.dateOfBirth },
              { label: 'Gender', value: student.gender },
              { label: 'Mobile Number', value: student.mobileNumber },
              { label: 'Email', value: student.email },
              { label: 'Address', value: student.address },
              { label: 'City', value: student.city },
              { label: 'State', value: student.state },
              { label: 'Pincode', value: student.pincode },
            ]}
          />

          <DetailGroup
            title="Course Information"
            values={[
              { label: 'Course', value: student.course },
              { label: 'Batch', value: student.batch },
              { label: 'Start Time', value: formatTime(student.startTime) },
              { label: 'End Time', value: formatTime(student.endTime) },
              { label: 'Enrollment Month', value: student.enrollmentMonth },
              { label: 'Enrollment Year', value: student.enrollmentYear },
              { label: 'Admission Date', value: student.admissionDate },
              { label: 'Course Duration', value: student.courseDuration },
            ]}
          />

          <DetailGroup
            title="Fee Information"
            values={[
              { label: 'Total Course Fee', value: currencyFormatter.format(student.totalCourseFee) },
              { label: 'Discount', value: `${student.discountPercentage}%` },
              { label: 'Final Fee', value: currencyFormatter.format(student.finalFee) },
              { label: 'Total Paid', value: currencyFormatter.format(student.totalPaid) },
              { label: 'Balance', value: currencyFormatter.format(student.balance) },
            ]}
          />

          <section className="student-detail-group">
            <h3>Remarks</h3>
            <p className="student-detail-remarks">{student.remarks || 'No remarks added.'}</p>
          </section>

          <section className="student-detail-group">
            <div className="student-detail-group__heading">
              <div>
                <h3>Payment History</h3>
                <p>Recent payments for this admission.</p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/payment-history')}>
                View All Payments
                <ChevronRight aria-hidden="true" size={15} />
              </Button>
            </div>
            {payments.length > 0 ? (
              <Table className="student-payments-table">
                <thead>
                  <tr>
                    <th>Receipt ID</th>
                    <th>Payment Date</th>
                    <th>Fee Type</th>
                    <th>Amount Paid</th>
                    <th>Payment Mode</th>
                    <th>Previous Paid</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.receiptId}>
                      <td>{payment.receiptId}</td>
                      <td>{payment.paymentDate}</td>
                      <td>{payment.feeType}</td>
                      <td>{currencyFormatter.format(payment.amountPaid)}</td>
                      <td>{payment.paymentMode}</td>
                      <td>{currencyFormatter.format(payment.previousPaid)}</td>
                      <td>{currencyFormatter.format(payment.totalPaid)}</td>
                      <td>{currencyFormatter.format(payment.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="student-detail-remarks">No payments recorded yet.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}