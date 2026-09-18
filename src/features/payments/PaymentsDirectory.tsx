import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  IndianRupee,
  RotateCcw,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchPayments, fetchStudents, type PaymentRecord as ApiPaymentRecord, type StudentRecord } from '../../services/api'
import type { Student } from '../students/studentTypes'
import { toPaymentSnapshot } from '../students/studentWorkflow'
import { useWorkflow } from '../workflow/useWorkflow'
import type { PaymentRecord } from '../workflow/workflowTypes'
import { PaymentDetailsModal } from './PaymentDetailsModal'

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc' | 'name-desc'

interface PaymentFilters {
  batch: string
  course: string
  date: string
  feeType: string
  paymentMode: string
  query: string
  sort: SortOption
}

const initialFilters: PaymentFilters = {
  batch: '', course: '', date: '', feeType: '', paymentMode: '', query: '', sort: 'date-desc',
}

const pageSize = 10
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
})

const courseOptions = [{ label: 'All Courses', value: '' }]
const batchOptions = [{ label: 'All Batches', value: '' }]
const paymentModeOptions = [{ label: 'All Modes', value: '' }, ...['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'].map((value) => ({ label: value, value }))]
const feeTypeOptions = [{ label: 'All Fee Types', value: '' }, ...['Admission Fee', 'Installment', 'Full Payment', 'Other'].map((value) => ({ label: value, value }))]
const dateOptions = [
  { label: 'All Dates', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]
const sortOptions = [
  { label: 'Newest payment first', value: 'date-desc' },
  { label: 'Oldest payment first', value: 'date-asc' },
  { label: 'Amount: high to low', value: 'amount-desc' },
  { label: 'Amount: low to high', value: 'amount-asc' },
  { label: 'Student name: A-Z', value: 'name-asc' },
  { label: 'Student name: Z-A', value: 'name-desc' },
]

function getLocalDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function matchesDate(paymentDate: string, filter: string) {
  if (!filter) return true
  const today = new Date(`${getLocalDate()}T00:00:00`)
  const date = new Date(`${paymentDate}T00:00:00`)

  if (filter === 'today') return paymentDate === getLocalDate()
  if (filter === 'month') return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()

  const day = today.getDay() || 7
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - day + 1)
  return date >= weekStart && date <= today
}

function sortPayments(payments: PaymentRecord[], sort: SortOption) {
  return [...payments].sort((left, right) => {
    if (sort === 'date-desc') return right.paymentDate.localeCompare(left.paymentDate)
    if (sort === 'date-asc') return left.paymentDate.localeCompare(right.paymentDate)
    if (sort === 'amount-desc') return right.amountPaid - left.amountPaid
    if (sort === 'amount-asc') return left.amountPaid - right.amountPaid
    if (sort === 'name-desc') return right.studentName.localeCompare(left.studentName)
    return left.studentName.localeCompare(right.studentName)
  })
}

export function PaymentsDirectory() {
  const navigate = useNavigate()
  const { setAdmission, setPayment } = useWorkflow()
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([fetchPayments(), fetchStudents()]).then(([paymentRecords, studentRecords]) => {
      if (!active) return
      setPayments(paymentRecords.map((payment: ApiPaymentRecord) => ({ ...payment, paymentId: payment.receiptId })))
      setStudents(studentRecords.map((student: StudentRecord) => ({
        ...student,
        discountPercentage: student.totalCourseFee ? (student.discount / student.totalCourseFee) * 100 : 0,
        totalPaid: student.totalPaid ?? 0,
        balance: student.balance ?? student.finalFee,
      })))
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load payments.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const filteredPayments = sortPayments(payments.filter((payment) => {
    const query = filters.query.trim().toLowerCase()
    return (!query || [payment.receiptId, payment.studentId, payment.studentName].some((value) => value.toLowerCase().includes(query)))
      && (!filters.course || payment.course === filters.course)
      && (!filters.batch || payment.batch === filters.batch)
      && (!filters.paymentMode || payment.paymentMode === filters.paymentMode)
      && (!filters.feeType || payment.feeType === filters.feeType)
      && matchesDate(payment.paymentDate, filters.date)
  }), filters.sort)

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagePayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totalCollected = filteredPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const todaysCollection = filteredPayments.filter((payment) => payment.paymentDate === getLocalDate()).reduce((sum, payment) => sum + payment.amountPaid, 0)
  const representedStudentIds = new Set(filteredPayments.map((payment) => payment.studentId))
  const outstandingFees = students.filter((student) => representedStudentIds.has(student.studentId)).reduce((sum, student) => sum + student.balance, 0)

  function updateFilter(field: keyof PaymentFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }

  function getStudent(studentId: string) {
    const student = students.find((record) => record.studentId === studentId)
    if (!student) throw new Error(`Missing student ${studentId}`)
    return student
  }

  function makePayment(student: Student) {
    setAdmission(toPaymentSnapshot(student))
    setSelectedPayment(null)
    navigate('/fee-receipt', { state: { fromStudent: true } })
  }

  function viewReceipt(payment: PaymentRecord, student: Student) {
    setAdmission(toPaymentSnapshot(student))
    setPayment(payment)
    setSelectedPayment(null)
    navigate('/fee-receipt', { state: { fromStudent: true } })
  }

  function viewStudent(student: Student) {
    setSelectedPayment(null)
    navigate('/students', { state: { selectedStudentId: student.studentId } })
  }

  return (
    <>
      <section className="payment-summary-cards" aria-label="Payments summary">
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><WalletCards aria-hidden="true" size={19} /></div><div><span>Total Payments</span><strong>{filteredPayments.length}</strong></div></Card>
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><IndianRupee aria-hidden="true" size={19} /></div><div><span>Total Collected</span><strong>{currencyFormatter.format(totalCollected)}</strong></div></Card>
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><CalendarDays aria-hidden="true" size={19} /></div><div><span>Today's Collection</span><strong>{currencyFormatter.format(todaysCollection)}</strong></div></Card>
        <Card className="payment-summary-card payment-summary-card--attention"><div className="payment-summary-card__icon"><Banknote aria-hidden="true" size={19} /></div><div><span>Outstanding Fees</span><strong>{currencyFormatter.format(outstandingFees)}</strong></div></Card>
      </section>

      <Card className="payments-filters">
        <div className="payments-filters__search-sort">
          <Input id="paymentsSearch" label="Search payments" placeholder="Search by receipt ID, admission number, or student name..." value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
          <Select id="paymentsSort" label="Sort by" options={sortOptions} value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value as SortOption)} />
        </div>
        <div className="payments-filters__options">
          <Select id="paymentsCourse" label="Course" options={courseOptions} value={filters.course} onChange={(event) => updateFilter('course', event.target.value)} />
          <Select id="paymentsBatch" label="Batch" options={batchOptions} value={filters.batch} onChange={(event) => updateFilter('batch', event.target.value)} />
          <Select id="paymentsMode" label="Payment Mode" options={paymentModeOptions} value={filters.paymentMode} onChange={(event) => updateFilter('paymentMode', event.target.value)} />
          <Select id="paymentsFeeType" label="Fee Type" options={feeTypeOptions} value={filters.feeType} onChange={(event) => updateFilter('feeType', event.target.value)} />
          <Select id="paymentsDate" label="Date" options={dateOptions} value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          <Button variant="secondary" onClick={() => { setFilters(initialFilters); setPage(1) }}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>
        </div>
      </Card>

      <div className="payments-results-heading"><div><h2>Payment records</h2><p>{filteredPayments.length} payments found</p></div></div>

      {isLoading ? <EmptyState title="Loading payments" description="Fetching payment records from the LSA Admin API." /> : loadError ? <EmptyState title="Unable to load payments" description={loadError} /> : pagePayments.length > 0 ? (
        <>
          <Table className="payments-table">
            <thead><tr><th>Receipt ID</th><th>Admission Number</th><th>Student Name</th><th>Course</th><th>Batch</th><th>Payment Date</th><th>Fee Type</th><th>Amount Paid</th><th>Payment Mode</th><th>Previous Paid</th><th>Total Paid</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {pagePayments.map((payment) => {
                const student = getStudent(payment.studentId)
                return (
                  <tr key={payment.paymentId}>
                    <td><strong>{payment.receiptId}</strong></td><td>{payment.studentId}</td><td>{payment.studentName}</td><td>{payment.course}</td><td>{payment.batch}</td><td>{payment.paymentDate}</td><td>{payment.feeType}</td><td>{currencyFormatter.format(payment.amountPaid)}</td><td>{payment.paymentMode}</td><td>{currencyFormatter.format(payment.previousPaid)}</td><td>{currencyFormatter.format(payment.totalPaid)}</td><td className={payment.balance > 0 ? 'payments-table__balance' : ''}>{currencyFormatter.format(payment.balance)}</td>
                    <td><div className="payments-table__actions"><Button variant="secondary" onClick={() => setSelectedPayment(payment)}><Eye aria-hidden="true" size={14} />View</Button><Button variant="secondary" onClick={() => viewReceipt(payment, student)}><FileText aria-hidden="true" size={14} />View Receipt</Button><Button variant="secondary" onClick={() => viewStudent(student)}><UserRound aria-hidden="true" size={14} />View Student</Button></div></td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          {totalPages > 1 && (
            <nav className="payments-pagination" aria-label="Payments pagination">
              <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft aria-hidden="true" size={15} />Previous</Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Button key={number} variant={number === currentPage ? 'primary' : 'secondary'} aria-current={number === currentPage ? 'page' : undefined} onClick={() => setPage(number)}>{number}</Button>)}
              <Button variant="secondary" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight aria-hidden="true" size={15} /></Button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState title="No payments found" description="Try changing your search or filters." action={<Button variant="secondary" onClick={() => { setFilters(initialFilters); setPage(1) }}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>} />
      )}

      {selectedPayment && (
        <PaymentDetailsModal payment={selectedPayment} student={getStudent(selectedPayment.studentId)} onClose={() => setSelectedPayment(null)} onMakePayment={makePayment} onViewReceipt={viewReceipt} onViewStudent={viewStudent} />
      )}
    </>
  )
}