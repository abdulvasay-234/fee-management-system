import {
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  Eye,
  Plus,
  RotateCcw,
  Search,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchStudent, fetchStudents, type PaymentRecord as ApiPaymentRecord, type StudentRecord } from '../../services/api'
import { getCachedCourseCodes, getCourseCodeServiceStatus, getCourseCodes, subscribeToCourseCodes } from '../courseCodes/courseCodeService'
import type { PaymentRecord } from '../workflow/workflowTypes'
import { useWorkflow } from '../workflow/useWorkflow'
import { StudentDetailsModal } from './StudentDetailsModal'
import { toPaymentSnapshot } from './studentWorkflow'
import type { Student } from './studentTypes'
import { batchNavigation, courseKey, courseNavigation, filterAdmissions, summarizeAdmissions, type StudentFilters } from './studentDirectoryUtils'

const emptyFilters: StudentFilters = {
  query: '',
  year: '',
}

function optionList(values: string[], allLabel: string) {
  return [
    { label: allLabel, value: '' },
    ...Array.from(new Set(values)).sort().map((value) => ({ label: value, value })),
  ]
}

function toStudent(record: StudentRecord): Student {
  const { finalFee, totalPaid, balance } = record
  if (typeof finalFee !== 'number' || typeof totalPaid !== 'number' || typeof balance !== 'number'
    || !Number.isFinite(finalFee) || !Number.isFinite(totalPaid) || !Number.isFinite(balance)) {
    throw new Error('An admission is missing financial totals. Please reconcile the records.')
  }
  return {
    ...record,
    discountPercentage: record.totalCourseFee ? (record.discount / record.totalCourseFee) * 100 : 0,
    totalPaid,
    balance,
  }
}

export function StudentsDirectory() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdmission } = useWorkflow()
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [, setCourseRevision] = useState(0)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [today, setToday] = useState(() => new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedPayments, setSelectedPayments] = useState<PaymentRecord[]>([])
  const [detailsError, setDetailsError] = useState('')
  const [detailsLoadingId, setDetailsLoadingId] = useState('')
  const detailsGeneration = useRef(0)
  const selectedStudentId = (location.state as { selectedStudentId?: string } | null)?.selectedStudentId
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    null,
  )

  const invalidateDetails = useCallback(() => { detailsGeneration.current++ }, [])
  const viewStudent = useCallback(async (student: StudentRecord) => {
    const generation = ++detailsGeneration.current
    setSelectedStudent(null)
    setSelectedPayments([])
    setDetailsError('')
    setDetailsLoadingId(student.studentId)
    try {
      const result = await fetchStudent(student.studentId)
      if (generation !== detailsGeneration.current) return
      setSelectedStudent(toStudent({ ...result.student, totalPaid: result.totalPaid, balance: result.balance }))
      setSelectedPayments(result.payments.map((payment: ApiPaymentRecord) => ({ ...payment, paymentId: payment.receiptId })))
    } catch (error) {
      if (generation === detailsGeneration.current) setDetailsError(error instanceof Error ? error.message : 'Unable to load the student record.')
    } finally {
      if (generation === detailsGeneration.current) setDetailsLoadingId('')
    }
  }, [])

  useEffect(() => {
    let timer: number
    function scheduleMidnight() {
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setToday(new Date())
        scheduleMidnight()
      }, midnight.getTime() - now.getTime() + 50)
    }
    function refreshDate() {
      setToday(new Date())
      scheduleMidnight()
    }
    scheduleMidnight()
    window.addEventListener('focus', refreshDate)
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', refreshDate) }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToCourseCodes(() => setCourseRevision((revision) => revision + 1))
    void getCourseCodes()
    return () => { unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    void fetchStudents().then((records) => {
      if (!active) return
      summarizeAdmissions(records)
      setLoadError('')
      setStudents(records)
      const selected = records.find((student) => student.studentId === selectedStudentId)
      if (selected) void viewStudent(selected)
      else {
        setSelectedStudent(null)
        setDetailsLoadingId('')
        setDetailsError('')
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load students.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false; invalidateDetails() }
  }, [selectedStudentId, viewStudent, invalidateDetails])

  const summary = summarizeAdmissions(students, today)
  const courseOptions = courseNavigation(getCachedCourseCodes(), students)
  const courseStatus = getCourseCodeServiceStatus()
  const batchOptions = batchNavigation(students, selectedCourse)
  const yearOptions = optionList(students.map((student) => student.enrollmentYear), 'All Years')
  const filteredStudents = filterAdmissions(students, filters, selectedCourse, selectedBatch)

  function selectCourse(course: string) {
    setSelectedCourse(course)
    setSelectedBatch((current) => course && batchNavigation(students, course).some((batch) => batch.name === current) ? current : '')
  }

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
    setSelectedCourse('')
    setSelectedBatch('')
  }

  function makePayment(student: Student) {
    setAdmission(toPaymentSnapshot(student))
    setSelectedStudent(null)
    navigate('/fee-receipt', { state: { fromStudent: true } })
  }

  return (
    <>
      <section className="student-summary-cards" aria-label="Student summary">
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><UsersRound aria-hidden="true" size={19} /></div>
          <div><span>Total Students</span><strong>{isLoading || loadError ? '—' : summary.totalStudents}</strong><small>Unique admission IDs</small></div>
        </Card>
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><CalendarDays aria-hidden="true" size={19} /></div>
          <div><span>Admissions Today</span><strong>{isLoading || loadError || summary.invalidDates ? '—' : summary.admissionsToday}</strong><small>By admission date</small></div>
        </Card>
        <Card className="student-summary-card">
          <div className="student-summary-card__icon"><CalendarRange aria-hidden="true" size={19} /></div>
          <div><span>Admissions This Month</span><strong>{isLoading || loadError || summary.invalidDates ? '—' : summary.admissionsThisMonth}</strong><small>By admission date</small></div>
        </Card>
        <Card className="student-summary-card student-summary-card--courses">
          <div className="student-summary-card__icon"><BookOpenCheck aria-hidden="true" size={19} /></div>
          <div className="student-course-summary">
            <span>Admissions by Course</span>
            <small>All admission IDs; enrollment status not tracked</small>
            {isLoading ? <small>Loading courses…</small> : loadError ? <small>Unavailable</small> : summary.courses.length ? (
              <>
                <ul className={summary.courses.length > 4 ? 'student-course-summary__list--scrollable' : undefined} tabIndex={summary.courses.length > 4 ? 0 : undefined} aria-label="Admissions by course">
                  {summary.courses.map((course) => <li key={courseKey(course.name)}><span>{course.name}</span><strong>{course.count}</strong></li>)}
                </ul>
                {summary.courses.length > 4 && <small>Scroll for more courses</small>}
              </>
            ) : <small>No admissions yet</small>}
          </div>
        </Card>
      </section>
      {!isLoading && !loadError && summary.invalidDates > 0 && <p className="student-course-nav__notice" role="status">Admission dates are missing or invalid for {summary.invalidDates} record{summary.invalidDates === 1 ? '' : 's'}. Date-based totals are unavailable until the records are corrected.</p>}

      <nav className="student-course-nav" aria-label="Filter admissions by course">
        <span className="student-course-nav__label">Courses</span>
        <div className="student-course-nav__list">
          <button type="button" className={`student-course-nav__item${!selectedCourse ? ' student-course-nav__item--active' : ''}`} aria-pressed={!selectedCourse} onClick={() => selectCourse('')}>All Courses</button>
          {courseOptions.map((course) => (
            <button type="button" key={courseKey(course.name)} className={`student-course-nav__item${courseKey(selectedCourse) === courseKey(course.name) ? ' student-course-nav__item--active' : ''}`} aria-pressed={courseKey(selectedCourse) === courseKey(course.name)} onClick={() => selectCourse(course.name)}>
              {course.name}{course.active === false && <small>Inactive</small>}
            </button>
          ))}
        </div>
      </nav>
      {courseStatus.source === 'unavailable' && <p className="student-course-nav__notice" role="status">Course list unavailable. Showing courses from admission records.</p>}
      {selectedCourse && (
        <nav className="student-course-nav" aria-label={`Filter ${selectedCourse} admissions by batch`}>
          <span className="student-course-nav__label">Batches</span>
          <div className="student-course-nav__list">
            <button type="button" className={`student-course-nav__item${!selectedBatch ? ' student-course-nav__item--active' : ''}`} aria-pressed={!selectedBatch} onClick={() => setSelectedBatch('')}>All Batches</button>
            {batchOptions.map((batch) => (
              <button type="button" key={batch.name} className={`student-course-nav__item${selectedBatch === batch.name ? ' student-course-nav__item--active' : ''}`} aria-pressed={selectedBatch === batch.name} onClick={() => setSelectedBatch(batch.name)}>
                Batch {batch.name} <small>{batch.count} {batch.count === 1 ? 'admission' : 'admissions'}</small>
              </button>
            ))}
          </div>
        </nav>
      )}
      {selectedCourse && !isLoading && !loadError && batchOptions.length === 0 && <p className="student-course-nav__notice" role="status">No batches found in admissions for {selectedCourse}.</p>}

      <Card className="student-filters">
        <form onSubmit={handleSearch}>
          <Input
            containerClassName="student-filters__search"
            id="studentDirectorySearch"
            label="Search"
            placeholder="Search by ID, name, mobile, or email..."
            value={draftFilters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
          />
          <Select id="studentYearFilter" label="Enrollment Year" options={yearOptions} value={draftFilters.year} onChange={(event) => updateFilter('year', event.target.value)} />
          <div className="student-filters__actions">
            <Button type="submit"><Search aria-hidden="true" size={15} />Search</Button>
            <Button type="button" variant="secondary" onClick={clearFilters}><RotateCcw aria-hidden="true" size={15} />Clear Filters</Button>
          </div>
        </form>
      </Card>

      <div className="students-results-heading">
        <div><h2>Registered students</h2><p>{isLoading ? 'Loading records…' : loadError ? 'Records unavailable' : `${filteredStudents.length} records shown · ${selectedCourse || 'All Courses'}${selectedCourse ? ` · ${selectedBatch ? `Batch ${selectedBatch}` : 'All Batches'}` : ''}`}</p><p>Enrollment status is not tracked.</p></div>
      </div>
      {detailsError && <p className="student-course-nav__notice" role="alert">{detailsError}</p>}

      {isLoading ? <EmptyState title="Loading students" description="Fetching student records from the LSA Admin API." /> : loadError ? <EmptyState title="Unable to load students" description={loadError} /> : filteredStudents.length > 0 ? (
        <Table className="students-table">
          <thead>
            <tr>
              <th>Admission Number</th>
              <th>Student</th>
              <th>Mobile Number</th>
              <th>Course</th>
              <th>Batch</th>
              <th>Admission Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.studentId}>
                <td data-label="Admission Number"><strong>{student.studentId}</strong></td>
                <td data-label="Student"><div><strong>{student.fullName}</strong><small className="students-table__secondary">{student.email || 'Email not provided'}</small></div></td>
                <td data-label="Mobile Number">{student.mobileNumber}</td>
                <td data-label="Course">{student.course}</td>
                <td data-label="Batch">{student.batch}</td>
                <td data-label="Admission Date">{student.admissionDate}</td>
                <td data-label="Actions">
                  <div className="students-table__actions">
                    <Button variant="secondary" disabled={detailsLoadingId === student.studentId} onClick={() => void viewStudent(student)}><Eye aria-hidden="true" size={14} />{detailsLoadingId === student.studentId ? 'Loading…' : 'View Admission'}</Button>
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
          paymentsError=""
          paymentsLoading={false}
          onClose={() => { invalidateDetails(); setSelectedStudent(null) }}
          onMakePayment={makePayment}
        />
      )}
    </>
  )
}