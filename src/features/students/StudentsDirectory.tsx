import {
  Banknote,
  BookOpenCheck,
  Eye,
  IndianRupee,
  Plus,
  RotateCcw,
  Search,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchStudent, fetchStudents, type PaymentRecord as ApiPaymentRecord, type StudentRecord } from '../../services/api'
import type { PaymentRecord } from '../workflow/workflowTypes'
import { useWorkflow } from '../workflow/useWorkflow'
import { StudentDetailsModal } from './StudentDetailsModal'
import { toPaymentSnapshot } from './studentWorkflow'
import type { Student } from './studentTypes'

interface StudentFilters {
  batch: string
  course: string
  month: string
  query: string
  year: string
}

const emptyFilters: StudentFilters = {
  batch: '',
  course: '',
  month: '',
  query: '',
  year: '',
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function optionList(values: string[], allLabel: string) {
  return [
    { label: allLabel, value: '' },
    ...Array.from(new Set(values)).sort().map((value) => ({ label: value, value })),
  ]
}

function toStudent(record: StudentRecord): Student {
  return {
    ...record,
    discountPercentage: record.totalCourseFee ? (record.discount / record.totalCourseFee) * 100 : 0,
    totalPaid: record.totalPaid ?? 0,
    balance: record.balance ?? record.finalFee,
  }
}

export function StudentsDirectory() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdmission } = useWorkflow()
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedPayments, setSelectedPayments] = useState<PaymentRecord[]>([])
  const selectedStudentId = (location.state as { selectedStudentId?: string } | null)?.selectedStudentId
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    null,
  )

  useEffect(() => {
    let active = true
    void fetchStudents().then((records) => {
      if (!active) return
      const loadedStudents = records.map(toStudent)
      setStudents(loadedStudents)
      setSelectedStudent(loadedStudents.find((student) => student.studentId === selectedStudentId) ?? null)
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load students.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [selectedStudentId])

  const totalFees = students.reduce((total, student) => total + student.totalCourseFee, 0)
  const outstandingFees = students.reduce((total, student) => total + student.balance, 0)
  const courseOptions = optionList(students.map((student) => student.course), 'All Courses')
  const batchOptions = optionList(students.map((student) => student.batch), 'All Batches')
  const yearOptions = optionList(students.map((student) => student.enrollmentYear), 'All Years')
  const monthOptions = optionList(students.map((student) => student.enrollmentMonth), 'All Months')

  const filteredStudents = students.filter((student) => {
    const query = filters.query.trim().toLowerCase()
    const matchesQuery = !query || [student.studentId, student.fullName, student.mobileNumber]
      .some((value) => value.toLowerCase().includes(query))

    return matchesQuery
      && (!filters.course || student.course === filters.course)
      && (!filters.batch || student.batch === filters.batch)
      && (!filters.year || student.enrollmentYear === filters.year)
      && (!filters.month || student.enrollmentMonth === filters.month)
  })

  function updateFilter(field: keyof StudentFilters, value: string) {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(draftFilters)
  }

  function clearFilters() {
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
  }

  function makePayment(student: Student) {
    setAdmission(toPaymentSnapshot(student))
    setSelectedStudent(null)
    navigate('/fee-receipt', { state: { fromStudent: true } })
  }

  async function viewStudent(student: Student) {
    setSelectedStudent(student)
    try {
      const result = await fetchStudent(student.studentId)
      setSelectedStudent(toStudent({ ...result.student, totalPaid: result.totalPaid, balance: result.balance }))
      setSelectedPayments(result.payments.map((payment: ApiPaymentRecord) => ({ ...payment, paymentId: payment.receiptId })))
    } catch {
      setSelectedPayments([])
    }
  }

  return (
    <>
      <section className="student-summary-cards" aria-label="Student summary">
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><UsersRound aria-hidden="true" size={19} /></div>
          <div><span>Total Students</span><strong>{students.length}</strong></div>
        </Card>
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><BookOpenCheck aria-hidden="true" size={19} /></div>
          <div><span>Active Enrollments</span><strong>{students.length}</strong></div>
        </Card>
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><IndianRupee aria-hidden="true" size={19} /></div>
          <div><span>Total Course Fees</span><strong>{currencyFormatter.format(totalFees)}</strong></div>
        </Card>
        <Card className="student-summary-card student-summary-card--attention">
          <div className="student-summary-card__icon"><WalletCards aria-hidden="true" size={19} /></div>
          <div><span>Outstanding Fees</span><strong>{currencyFormatter.format(outstandingFees)}</strong></div>
        </Card>
      </section>

      <Card className="student-filters">
        <form onSubmit={handleSearch}>
          <Input
            containerClassName="student-filters__search"
            id="studentDirectorySearch"
            label="Search"
            placeholder="Search by admission number, name, or mobile number..."
            value={draftFilters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
          />
          <Select id="studentCourseFilter" label="Course" options={courseOptions} value={draftFilters.course} onChange={(event) => updateFilter('course', event.target.value)} />
          <Select id="studentBatchFilter" label="Batch" options={batchOptions} value={draftFilters.batch} onChange={(event) => updateFilter('batch', event.target.value)} />
          <Select id="studentYearFilter" label="Enrollment Year" options={yearOptions} value={draftFilters.year} onChange={(event) => updateFilter('year', event.target.value)} />
          <Select id="studentMonthFilter" label="Enrollment Month" options={monthOptions} value={draftFilters.month} onChange={(event) => updateFilter('month', event.target.value)} />
          <div className="student-filters__actions">
            <Button type="submit"><Search aria-hidden="true" size={15} />Search</Button>
            <Button type="button" variant="secondary" onClick={clearFilters}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>
          </div>
        </form>
      </Card>

      <div className="students-results-heading">
        <div><h2>Registered students</h2><p>{filteredStudents.length} records shown</p></div>
      </div>

      {isLoading ? <EmptyState title="Loading students" description="Fetching student records from the LSA Admin API." /> : loadError ? <EmptyState title="Unable to load students" description={loadError} /> : filteredStudents.length > 0 ? (
        <Table className="students-table">
          <thead>
            <tr>
              <th>Admission Number</th>
              <th>Student Name</th>
              <th>Mobile Number</th>
              <th>Course</th>
              <th>Batch</th>
              <th>Enrollment</th>
              <th>Final Fee</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.studentId}>
                <td><strong>{student.studentId}</strong></td>
                <td>{student.fullName}</td>
                <td>{student.mobileNumber}</td>
                <td>{student.course}</td>
                <td>{student.batch}</td>
                <td>{student.enrollmentMonth} {student.enrollmentYear}</td>
                <td>{currencyFormatter.format(student.finalFee)}</td>
                <td>{currencyFormatter.format(student.totalPaid)}</td>
                <td className={student.balance > 0 ? 'students-table__balance' : ''}>{currencyFormatter.format(student.balance)}</td>
                <td>
                  <div className="students-table__actions">
                    <Button variant="secondary" onClick={() => void viewStudent(student)}><Eye aria-hidden="true" size={14} />View</Button>
                    <Button onClick={() => makePayment(student)}><Banknote aria-hidden="true" size={14} />Make Payment</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          title="No students found"
          description="Try changing your search or filters."
          action={<Button onClick={() => navigate('/new-admission')}><Plus aria-hidden="true" size={16} />Add New Student</Button>}
        />
      )}

      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          payments={selectedPayments}
          onClose={() => setSelectedStudent(null)}
          onMakePayment={makePayment}
        />
      )}
    </>
  )
}