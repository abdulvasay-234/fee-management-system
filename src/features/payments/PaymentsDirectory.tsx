import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  IndianRupee,
  RotateCcw,
  UserRound,
  UsersRound,
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
  month: string
  query: string
  sort: SortOption
  status: string
}

const initialFilters: PaymentFilters = {
  batch: '', course: '', date: '', month: '', query: '', sort: 'date-desc', status: '',
}

const pageSize = 10
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
})

const statusOptions = [
  { label: 'All Payment Status', value: '' },
  { label: 'Pending Balance', value: 'pending' },
  { label: 'Cleared', value: 'cleared' },
]

const sortOptions = [
  { label: 'Newest payment first', value: 'date-desc' },
  { label: 'Oldest payment first', value: 'date-asc' },
  { label: 'Amount: high to low', value: 'amount-desc' },
  { label: 'Amount: low to high', value: 'amount-asc' },
  { label: 'Student name: A-Z', value: 'name-asc' },
  { label: 'Student name: Z-A', value: 'name-desc' },
]

let paymentsLoadPromise: Promise<[ApiPaymentRecord[], StudentRecord[]]> | null = null

function loadPaymentsData() {
  if (!paymentsLoadPromise) {
    paymentsLoadPromise = Promise.all([fetchPayments(), fetchStudents()]).finally(() => {
      paymentsLoadPromise = null
    })
  }
  return paymentsLoadPromise
}

function getLocalDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function toStudent(record: StudentRecord): Student {
  return {
    ...record,
    discountPercentage: record.totalCourseFee ? (record.discount / record.totalCourseFee) * 100 : 0,
    totalPaid: record.totalPaid ?? 0,
    balance: record.balance ?? record.finalFee,
  }
}

export function PaymentsDirectory() {
  const navigate = useNavigate()
  const { setAdmission } = useWorkflow()
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    void loadPaymentsData().then(([paymentRecords, studentRecords]) => {
      if (!active) return
      setPayments(paymentRecords.map((payment: ApiPaymentRecord) => ({ ...payment, paymentId: payment.receiptId })))
      setStudents(studentRecords.map(toStudent))
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load payments.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const courseOptions = [{ label: 'All Courses', value: '' }, ...Array.from(new Set(students.map((student) => student.course))).sort().map((value) => ({ label: value, value }))]
  const batchOptions = [{ label: 'All Batches', value: '' }, ...Array.from(new Set(students.map((student) => student.batch))).sort().map((value) => ({ label: value, value }))]
  const studentById = new Map(students.map((student) => [student.studentId, student]))
  const filteredPayments = sortPayments(payments.filter((payment) => {
    const query = filters.query.trim().toLowerCase()
    const mobile = studentById.get(payment.studentId)?.mobileNumber ?? ''
    return (!query || [payment.studentId, payment.studentName, mobile].some((value) => value.toLowerCase().includes(query)))
      && (!filters.course || payment.course === filters.course)
      && (!filters.batch || payment.batch === filters.batch)
      && (!filters.date || payment.paymentDate === filters.date)
      && (!filters.month || payment.paymentDate.startsWith(filters.month))
      && (!filters.status || (filters.status === 'pending' ? payment.balance > 0 : payment.balance <= 0))
  }), filters.sort)

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagePayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totalCollected = payments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const todaysCollection = payments.filter((payment) => payment.paymentDate === getLocalDate()).reduce((sum, payment) => sum + payment.amountPaid, 0)
  const outstandingFees = students.reduce((sum, student) => sum + student.balance, 0)
  const studentsWithPendingBalance = students.filter((student) => student.balance > 0).length

  function updateFilter(field: keyof PaymentFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }

  function makePayment(student: Student) {
    setAdmission(toPaymentSnapshot(student))
    setSelectedPayment(null)
    navigate('/fee-receipt', { state: { fromStudent: true } })
  }

  function viewStudent(student: Student) {
    setSelectedPayment(null)
    navigate('/admissions', { state: { selectedStudentId: student.studentId } })
  }

  const selectedStudent = selectedPayment ? studentById.get(selectedPayment.studentId) : undefined

  return (
    <>
      <section className="payment-summary-cards" aria-label="Payments summary">
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><IndianRupee aria-hidden="true" size={19} /></div><div><span>Total Collection</span><strong>{currencyFormatter.format(totalCollected)}</strong></div></Card>
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><CalendarDays aria-hidden="true" size={19} /></div><div><span>Today's Collection</span><strong>{currencyFormatter.format(todaysCollection)}</strong></div></Card>
        <Card className="payment-summary-card payment-summary-card--attention"><div className="payment-summary-card__icon"><WalletCards aria-hidden="true" size={19} /></div><div><span>Outstanding Amount</span><strong>{currencyFormatter.format(outstandingFees)}</strong></div></Card>
        <Card className="payment-summary-card"><div className="payment-summary-card__icon"><UsersRound aria-hidden="true" size={19} /></div><div><span>Students With Pending Balance</span><strong>{studentsWithPendingBalance}</strong></div></Card>
      </section>

      <Card className="payments-filters">
        <div className="payments-filters__search-sort">
          <Input id="paymentsSearch" label="Search payments" placeholder="Search by student ID, name, or mobile..." value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
          <Select id="paymentsSort" label="Sort by" options={sortOptions} value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value as SortOption)} />
        </div>
        <div className="payments-filters__options">
          <Select id="paymentsCourse" label="Course" options={courseOptions} value={filters.course} onChange={(event) => updateFilter('course', event.target.value)} />
          <Select id="paymentsBatch" label="Batch" options={batchOptions} value={filters.batch} onChange={(event) => updateFilter('batch', event.target.value)} />
          <Input id="paymentsDate" label="Payment Date" type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          <Input id="paymentsMonth" label="Payment Month" type="month" value={filters.month} onChange={(event) => updateFilter('month', event.target.value)} />
          <Select id="paymentsStatus" label="Payment Status" options={statusOptions} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} />
          <Button variant="secondary" onClick={() => { setFilters(initialFilters); setPage(1) }}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>
        </div>
      </Card>

      <div className="payments-results-heading"><div><h2>Payment records</h2><p>{filteredPayments.length} payments found</p></div></div>

      {isLoading ? <EmptyState title="Loading payments" description="Fetching payment records from the LSA Admin API." /> : loadError ? <EmptyState title="Unable to load payments" description={loadError} /> : pagePayments.length > 0 ? (
        <>
          <Table className="payments-table">
            <thead><tr><th>Payment Date</th><th>Student ID</th><th>Student Name</th><th>Course</th><th>Batch</th><th>Amount Paid</th><th>Previous Paid</th><th>Total Paid</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {pagePayments.map((payment) => {
                const student = studentById.get(payment.studentId)
                return (
                  <tr key={payment.paymentId}>
                    <td>{payment.paymentDate}</td><td><strong>{payment.studentId}</strong></td><td>{payment.studentName}</td><td>{payment.course}</td><td>{payment.batch}</td><td>{currencyFormatter.format(payment.amountPaid)}</td><td>{currencyFormatter.format(payment.previousPaid)}</td><td>{currencyFormatter.format(payment.totalPaid)}</td><td className={payment.balance > 0 ? 'payments-table__balance' : ''}>{currencyFormatter.format(payment.balance)}</td>
                    <td><div className="payments-table__actions"><Button variant="secondary" onClick={() => setSelectedPayment(payment)}><Eye aria-hidden="true" size={14} />View</Button>{student && <Button variant="secondary" onClick={() => viewStudent(student)}><UserRound aria-hidden="true" size={14} />View Student</Button>}</div></td>
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

      {selectedPayment && selectedStudent && <PaymentDetailsModal payment={selectedPayment} student={selectedStudent} onClose={() => setSelectedPayment(null)} onMakePayment={makePayment} onViewStudent={viewStudent} />}
    </>
  )
}
