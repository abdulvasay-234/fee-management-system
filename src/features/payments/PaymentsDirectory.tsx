import {
  BookOpenCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  IndianRupee,
  RotateCcw,
  RefreshCw,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchPayments, fetchStudents, type PaymentRecord as ApiPaymentRecord, type StudentRecord } from '../../services/api'
import type { Student } from '../students/studentTypes'
import { toPaymentSnapshot, toStudent } from '../students/studentWorkflow'
import { useWorkflow } from '../workflow/useWorkflow'
import type { PaymentRecord } from '../workflow/workflowTypes'
import { PaymentDetailsModal } from './PaymentDetailsModal'
import { summarizePaymentOverview } from './paymentOverview'
import { CourseLabel } from '../courseCodes/CourseLabel'
import { getCachedCourseCodes, getCourseCodes, getCourseCodeServiceStatus, subscribeToCourseCodes } from '../courseCodes/courseCodeService'
import { courseKey, courseNavigation } from '../students/studentDirectoryUtils'
import { getPaymentStatus } from '../../utils/amount'
import {
  changePaymentFilter, emptyPaymentFilters, filterPaymentHistory, filterStudentFees, paymentBatchOptions,
  paymentNavigationRecords, paymentSummaryScope, sortPaymentHistory, sortStudentFees,
  type PaymentDirectoryFilters, type PaymentSort, type PaymentView, type StudentFeeSort,
} from './paymentDirectoryUtils'

const pageSize = 10
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
})

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Pending Balance', value: 'pending' },
  { label: 'Paid', value: 'paid' },
] as const

const sortOptions = [
  { label: 'Newest payment first', value: 'date-desc' },
  { label: 'Oldest payment first', value: 'date-asc' },
  { label: 'Amount: high to low', value: 'amount-desc' },
  { label: 'Amount: low to high', value: 'amount-asc' },
  { label: 'Student name: A-Z', value: 'name-asc' },
  { label: 'Student name: Z-A', value: 'name-desc' },
]

const studentSortOptions = [
  { label: 'Highest pending due first', value: 'balance-desc' },
  { label: 'Highest final fee first', value: 'fee-desc' },
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

function CourseAmounts({ courses, metric, isLoading, loadError }: {
  courses: ReturnType<typeof summarizePaymentOverview>['courses']
  metric: 'totalFees' | 'outstanding'
  isLoading: boolean
  loadError: string
}) {
  if (isLoading) return <small>Loading courses…</small>
  if (loadError) return <small>Unavailable</small>
  if (!courses.length) return <small>No matching admissions</small>

  return (
    <>
      <ul className={courses.length > 4 ? 'payment-course-summary__list--scrollable' : undefined} tabIndex={courses.length > 4 ? 0 : undefined} aria-label={metric === 'outstanding' ? 'Outstanding by course' : 'Final fees by course'}>
        {courses.map((course) => <li key={course.name}><CourseLabel name={course.name} variant="inline" /><strong>{currencyFormatter.format(course[metric])}</strong></li>)}
      </ul>
      {courses.length > 4 && <small>Scroll for more courses</small>}
    </>
  )
}

export function PaymentsDirectory() {
  const navigate = useNavigate()
  const { setAdmission } = useWorkflow()
  const [filters, setFilters] = useState(emptyPaymentFilters)
  const [view, setView] = useState<PaymentView>('students')
  const [studentSort, setStudentSort] = useState<StudentFeeSort>('balance-desc')
  const [paymentSort, setPaymentSort] = useState<PaymentSort>('date-desc')
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [, setCourseRevision] = useState(0)
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
      const loadedPayments = paymentRecords.map((payment: ApiPaymentRecord) => ({ ...payment, paymentId: payment.receiptId }))
      const loadedStudents = studentRecords.map(toStudent)
      summarizePaymentOverview(loadedPayments, loadedStudents)
      setPayments(loadedPayments)
      setStudents(loadedStudents)
      setFilters((current) => current.batch && !paymentBatchOptions(loadedStudents, loadedPayments, current).includes(current.batch)
        ? { ...current, batch: '' } : current)
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load payments.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [refreshRevision])

  useEffect(() => {
    const unsubscribe = subscribeToCourseCodes(() => setCourseRevision((revision) => revision + 1))
    void getCourseCodes()
    return () => { unsubscribe() }
  }, [])

  const navigationRecords = paymentNavigationRecords(students, payments)
  const courseOptions = courseNavigation(getCachedCourseCodes(), navigationRecords)
  const courseStatus = getCourseCodeServiceStatus()
  const batchOptions = paymentBatchOptions(students, payments, filters)
  const yearOptions = [{ label: 'All Years', value: '' }, ...Array.from(new Set(navigationRecords.map((record) => record.enrollmentYear.trim()).filter(Boolean)))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true })).map((value) => ({ label: value, value }))]
  const enrollmentMonthOptions = [{ label: 'All Months', value: '' }, ...Array.from(new Set(navigationRecords.map((record) => record.enrollmentMonth.trim()).filter(Boolean)))
    .sort().map((value) => ({ label: value, value }))]
  const studentById = new Map(students.map((student) => [student.studentId.trim(), student]))
  const filteredStudents = sortStudentFees(filterStudentFees(students, filters), studentSort)
  const filteredPayments = sortPaymentHistory(filterPaymentHistory(payments, students, filters), paymentSort)
  const feeCounts = filterStudentFees(students, { ...filters, status: '' })
  const scope = paymentSummaryScope(view, filteredStudents, filteredPayments, students, payments)
  const summary = summarizePaymentOverview(scope.payments, scope.students)
  const unlinkedPayments = payments.filter((payment) => !studentById.has(payment.studentId.trim())).length
  const resultsCount = view === 'students' ? filteredStudents.length : filteredPayments.length
  const totalPages = Math.max(1, Math.ceil(resultsCount / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagePayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function updateFilter<Field extends keyof PaymentDirectoryFilters>(field: Field, value: PaymentDirectoryFilters[Field]) {
    setFilters((current) => changePaymentFilter(current, field, value, students, payments))
    setPage(1)
  }

  function clearFilters() {
    setFilters(emptyPaymentFilters)
    setStudentSort('balance-desc')
    setPaymentSort('date-desc')
    setPage(1)
  }

  function refresh() {
    setIsLoading(true)
    setLoadError('')
    setSelectedPayment(null)
    setRefreshRevision((revision) => revision + 1)
    setPage(1)
  }

  function changeView(next: PaymentView) {
    setView(next)
    setFilters((current) => ({ ...current, date: '', paymentMonth: '' }))
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

  const selectedStudent = selectedPayment ? studentById.get(selectedPayment.studentId.trim()) : undefined

  return (
    <>
      <section className="payment-summary-cards" aria-label="Payments summary">
        <Card className="payment-summary-card">
          <div className="payment-summary-card__icon"><IndianRupee aria-hidden="true" size={19} /></div>
          <div><span>Total Amount</span><strong>{isLoading || loadError ? '—' : currencyFormatter.format(summary.totalFees)}</strong><small>Amount received: {isLoading || loadError ? '—' : currencyFormatter.format(summary.totalCollected)}</small></div>
        </Card>
        <Card className="payment-summary-card payment-summary-card--courses">
          <div className="payment-summary-card__icon"><UsersRound aria-hidden="true" size={19} /></div>
          <div className="payment-course-summary"><span>Total Fee per Course</span><CourseAmounts courses={summary.courses} metric="totalFees" isLoading={isLoading} loadError={loadError} /></div>
        </Card>
        <Card className="payment-summary-card payment-summary-card--courses">
          <div className="payment-summary-card__icon"><BookOpenCheck aria-hidden="true" size={19} /></div>
          <div className="payment-course-summary"><span>Outstanding Fee per Course</span><CourseAmounts courses={summary.courses} metric="outstanding" isLoading={isLoading} loadError={loadError} /></div>
        </Card>
        <Card className="payment-summary-card payment-summary-card--attention">
          <div className="payment-summary-card__icon"><WalletCards aria-hidden="true" size={19} /></div>
          <div><span>Outstanding Amount</span><strong>{isLoading || loadError ? '—' : currencyFormatter.format(summary.outstanding)}</strong></div>
        </Card>
      </section>

      <nav className="payments-view-nav" aria-label="Payments view">
        <button type="button" className={`student-course-nav__item${view === 'students' ? ' student-course-nav__item--active' : ''}`} aria-pressed={view === 'students'} onClick={() => changeView('students')}>Student Fee Status</button>
        <button type="button" className={`student-course-nav__item${view === 'history' ? ' student-course-nav__item--active' : ''}`} aria-pressed={view === 'history'} onClick={() => changeView('history')}>Payment History</button>
        <Button variant="secondary" disabled={isLoading} onClick={refresh}><RefreshCw aria-hidden="true" size={15} />Refresh</Button>
      </nav>

      <nav className="student-course-nav" aria-label="Filter payments by course">
        <span className="student-course-nav__label">Courses</span>
        <div className="student-course-nav__list">
          <button type="button" className={`student-course-nav__item${!filters.course ? ' student-course-nav__item--active' : ''}`} aria-pressed={!filters.course} onClick={() => updateFilter('course', '')}>All Courses</button>
          {courseOptions.map((course) => (
            <button type="button" key={courseKey(course.name)} className={`student-course-nav__item${courseKey(filters.course) === courseKey(course.name) ? ' student-course-nav__item--active' : ''}`} aria-pressed={courseKey(filters.course) === courseKey(course.name)} onClick={() => updateFilter('course', course.name)}>
              <CourseLabel name={course.name} variant="inline" />{course.active === false && <small>Inactive</small>}
            </button>
          ))}
        </div>
      </nav>
      {courseStatus.source === 'unavailable' && <p className="student-course-nav__notice" role="status">Course catalog unavailable. Showing courses from loaded records.</p>}

      <nav className="student-course-nav" aria-label="Filter payments by batch">
        <span className="student-course-nav__label">Batches</span>
        <div className="student-course-nav__list">
          <button type="button" className={`student-course-nav__item${!filters.batch ? ' student-course-nav__item--active' : ''}`} aria-pressed={!filters.batch} onClick={() => updateFilter('batch', '')}>All Batches</button>
          {batchOptions.map((batch) => <button type="button" key={batch} className={`student-course-nav__item${filters.batch === batch ? ' student-course-nav__item--active' : ''}`} aria-pressed={filters.batch === batch} onClick={() => updateFilter('batch', batch)}>Batch {batch}</button>)}
        </div>
      </nav>

      <Card className="payments-filters">
        <div className="payments-filters__search-sort">
          <Input id="paymentsSearch" label={view === 'students' ? 'Search students' : 'Search payment history'} placeholder={view === 'students' ? 'Admission ID, name, mobile, or email...' : 'Receipt ID, admission ID, name, mobile, or email...'} value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
          {view === 'students'
            ? <Select id="studentFeeSort" label="Sort by" options={studentSortOptions} value={studentSort} onChange={(event) => { setStudentSort(event.target.value as StudentFeeSort); setPage(1) }} />
            : <Select id="paymentsSort" label="Sort by" options={sortOptions} value={paymentSort} onChange={(event) => { setPaymentSort(event.target.value as PaymentSort); setPage(1) }} />}
        </div>
        <div className={`payments-filters__options${view === 'students' ? ' payments-filters__options--students' : ''}`}>
          <Select id="paymentsEnrollmentYear" label="Enrollment Year" options={yearOptions} value={filters.year} onChange={(event) => updateFilter('year', event.target.value)} />
          <Select id="paymentsEnrollmentMonth" label="Enrollment Month" options={enrollmentMonthOptions} value={filters.enrollmentMonth} onChange={(event) => updateFilter('enrollmentMonth', event.target.value)} />
          {view === 'history' && <>
            <Input id="paymentsDate" label="Payment Date" type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
            <Input id="paymentsMonth" label="Payment Month" type="month" value={filters.paymentMonth} onChange={(event) => updateFilter('paymentMonth', event.target.value)} />
          </>}
          <Button variant="secondary" onClick={clearFilters}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>
        </div>
        <div className="payments-status-nav" role="group" aria-label="Current fee status">
          {statusOptions.map((option) => {
            const count = option.value === 'pending' ? feeCounts.filter((student) => student.balance > 0).length
              : option.value === 'paid' ? feeCounts.filter((student) => student.balance <= 0).length : feeCounts.length
            return <button type="button" key={option.value} className={`student-course-nav__item${filters.status === option.value ? ' student-course-nav__item--active' : ''}`} aria-pressed={filters.status === option.value} onClick={() => updateFilter('status', option.value)}>{option.label}{view === 'students' && <small>{isLoading || loadError ? '—' : count}</small>}</button>
          })}
        </div>
      </Card>

      <div className="payments-results-heading">
        <h2>{view === 'students' ? 'Student fee status' : 'Payment history'}</h2>
        {view === 'students' && unlinkedPayments > 0 && <p role="status">{unlinkedPayments} receipts without a linked admission are available in Payment History, not included in student fee totals.</p>}
      </div>

      {isLoading ? <EmptyState title="Loading payments" description="Fetching admissions and payment records from the LSA Admin API." /> : loadError ? <EmptyState title="Unable to load payments" description={loadError} action={<Button variant="secondary" onClick={refresh}>Try Again</Button>} /> : resultsCount > 0 ? (
        <>
          {view === 'students' ? <Table className="payment-fees-table payment-directory-table">
            <thead><tr><th>Admission ID</th><th>Student</th><th>Course</th><th>Batch / Enrollment</th><th>Final Fee</th><th>Amount Received</th><th>Pending Due</th><th>Fee Status</th><th>Actions</th></tr></thead>
            <tbody>
              {pageStudents.map((student) => <tr key={student.studentId}>
                <td data-label="Admission ID"><strong>{student.studentId}</strong></td>
                <td data-label="Student"><div><strong>{student.fullName}</strong><small className="students-table__secondary">{student.mobileNumber}</small><small className="students-table__secondary">{student.email}</small></div></td>
                <td data-label="Course"><CourseLabel name={student.course} /></td>
                <td data-label="Batch / Enrollment"><div>Batch {student.batch || 'Not provided'}<small className="students-table__secondary">{student.enrollmentMonth} {student.enrollmentYear}</small></div></td>
                <td data-label="Final Fee">{currencyFormatter.format(student.finalFee)}</td>
                <td data-label="Amount Received">{currencyFormatter.format(student.totalPaid)}</td>
                <td data-label="Pending Due" className={student.balance > 0 ? 'payments-table__balance' : ''}>{currencyFormatter.format(Math.max(student.balance, 0))}</td>
                <td data-label="Fee Status"><Badge variant={student.balance > 0 ? 'red' : 'neutral'}>{getPaymentStatus(student.totalPaid, student.balance)}</Badge></td>
                <td data-label="Actions"><div className="payments-table__actions"><Button variant="secondary" onClick={() => viewStudent(student)}><UserRound aria-hidden="true" size={14} />View Student</Button>{student.balance > 0 && <Button onClick={() => makePayment(student)}><Banknote aria-hidden="true" size={14} />Make Payment</Button>}</div></td>
              </tr>)}
            </tbody>
          </Table> : <Table className="payments-table payment-directory-table">
            <thead><tr><th>Payment Date</th><th>Receipt ID</th><th>Student</th><th>Course</th><th>Batch / Enrollment</th><th>Amount Received</th><th>Current Fee Status</th><th>Actions</th></tr></thead>
            <tbody>
              {pagePayments.map((payment) => {
                const student = studentById.get(payment.studentId.trim())
                return (
                  <tr key={payment.paymentId}>
                    <td data-label="Payment Date">{payment.paymentDate}</td>
                    <td data-label="Receipt ID"><strong>{payment.receiptId}</strong></td>
                    <td data-label="Student"><div>{payment.studentName}<small className="students-table__secondary">{payment.studentId}</small></div></td>
                    <td data-label="Course"><CourseLabel name={student?.course ?? payment.course} /></td>
                    <td data-label="Batch / Enrollment"><div>Batch {(student?.batch ?? payment.batch) || 'Not provided'}<small className="students-table__secondary">{student?.enrollmentMonth ?? payment.enrollmentMonth} {student?.enrollmentYear ?? payment.enrollmentYear}</small></div></td>
                    <td data-label="Amount Received">{currencyFormatter.format(payment.amountPaid)}</td>
                    <td data-label="Current Fee Status"><Badge variant={student && student.balance > 0 ? 'red' : 'neutral'}>{student ? getPaymentStatus(student.totalPaid, student.balance) : 'Admission not linked'}</Badge></td>
                    <td data-label="Actions"><div className="payments-table__actions"><Button variant="secondary" onClick={() => setSelectedPayment(payment)}><Eye aria-hidden="true" size={14} />View Receipt</Button>{student && <Button variant="secondary" onClick={() => viewStudent(student)}><UserRound aria-hidden="true" size={14} />View Student</Button>}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </Table>}
          {totalPages > 1 && (
            <nav className="payments-pagination" aria-label="Payments pagination">
              <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft aria-hidden="true" size={15} />Previous</Button>
              <span>Page {currentPage} of {totalPages}</span>
              <Button variant="secondary" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight aria-hidden="true" size={15} /></Button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState title={view === 'students' ? 'No students found' : 'No receipts found'} description="Try changing your course, batch, enrollment period, status, or search." action={<Button variant="secondary" onClick={clearFilters}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>} />
      )}

      {selectedPayment && <PaymentDetailsModal payment={selectedPayment} student={selectedStudent} onClose={() => setSelectedPayment(null)} onMakePayment={makePayment} onViewStudent={viewStudent} />}
    </>
  )
}
