import type { Student } from '../students/studentTypes'
import { courseKey, filterAdmissions } from '../students/studentDirectoryUtils'
import type { PaymentRecord } from '../workflow/workflowTypes'

export type PaymentView = 'students' | 'history'
export type FeeStatusFilter = '' | 'pending' | 'paid'
export type PaymentSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc' | 'name-desc'
export type StudentFeeSort = 'balance-desc' | 'fee-desc' | 'name-asc' | 'name-desc'

export interface PaymentDirectoryFilters {
  course: string
  batch: string
  year: string
  enrollmentMonth: string
  query: string
  status: FeeStatusFilter
  date: string
  paymentMonth: string
}

export const emptyPaymentFilters: PaymentDirectoryFilters = {
  course: '', batch: '', year: '', enrollmentMonth: '', query: '', status: '', date: '', paymentMonth: '',
}

function matchesCohort(record: { course: string; batch: string; enrollmentYear: string; enrollmentMonth: string }, filters: PaymentDirectoryFilters) {
  return (!filters.course || courseKey(record.course) === courseKey(filters.course))
    && (!filters.batch || record.batch.trim() === filters.batch)
    && (!filters.year || record.enrollmentYear.trim() === filters.year)
    && (!filters.enrollmentMonth || courseKey(record.enrollmentMonth) === courseKey(filters.enrollmentMonth))
}

function matchesStatus(student: Student | undefined, status: FeeStatusFilter) {
  if (!status) return true
  if (!student) return false
  return status === 'pending' ? student.balance > 0 : student.balance <= 0
}

export function paymentBatchOptions(students: Student[], payments: PaymentRecord[], filters: PaymentDirectoryFilters) {
  const cohortFilters = { ...filters, batch: '' }
  return Array.from(new Set(paymentNavigationRecords(students, payments)
    .filter((record) => matchesCohort(record, cohortFilters))
    .map((record) => record.batch.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

export function paymentNavigationRecords(students: Student[], payments: PaymentRecord[]) {
  const ids = new Set(students.map((student) => student.studentId.trim()))
  return [...students, ...payments.filter((payment) => !ids.has(payment.studentId.trim()))]
}

export function changePaymentFilter<Field extends keyof PaymentDirectoryFilters>(
  filters: PaymentDirectoryFilters, field: Field, value: PaymentDirectoryFilters[Field], students: Student[], payments: PaymentRecord[],
) {
  const next = { ...filters, [field]: value }
  if (['course', 'year', 'enrollmentMonth'].includes(field)
    && next.batch && !paymentBatchOptions(students, payments, next).includes(next.batch)) next.batch = ''
  return next
}

export function filterStudentFees(students: Student[], filters: PaymentDirectoryFilters) {
  return filterAdmissions(students, { query: filters.query, year: filters.year }, filters.course, filters.batch)
    .filter((student) => matchesCohort(student, filters) && matchesStatus(student, filters.status))
}

export function filterPaymentHistory(payments: PaymentRecord[], students: Student[], filters: PaymentDirectoryFilters) {
  const studentById = new Map(students.map((student) => [student.studentId.trim(), student]))
  const query = filters.query.trim().toLowerCase()
  return payments.filter((payment) => {
    const student = studentById.get(payment.studentId.trim())
    const searchValues = [payment.receiptId, payment.studentId, payment.studentName, student?.fullName ?? '', student?.mobileNumber ?? '', student?.email ?? '']
    return matchesCohort(student ?? payment, filters)
      && matchesStatus(student, filters.status)
      && (!query || searchValues.some((value) => value.toLowerCase().includes(query)))
      && (!filters.date || payment.paymentDate === filters.date)
      && (!filters.paymentMonth || payment.paymentDate.startsWith(filters.paymentMonth))
  })
}

export function paymentSummaryScope(view: PaymentView, filteredStudents: Student[], filteredPayments: PaymentRecord[], students: Student[], payments: PaymentRecord[]) {
  if (view === 'students') {
    const ids = new Set(filteredStudents.map((student) => student.studentId.trim()))
    return { students: filteredStudents, payments: payments.filter((payment) => ids.has(payment.studentId.trim())) }
  }
  const ids = new Set(filteredPayments.map((payment) => payment.studentId.trim()))
  return { students: students.filter((student) => ids.has(student.studentId.trim())), payments: filteredPayments }
}

export function sortStudentFees(students: Student[], sort: StudentFeeSort) {
  return [...students].sort((left, right) => {
    if (sort === 'balance-desc') return right.balance - left.balance || left.fullName.localeCompare(right.fullName)
    if (sort === 'fee-desc') return right.finalFee - left.finalFee || left.fullName.localeCompare(right.fullName)
    return sort === 'name-desc' ? right.fullName.localeCompare(left.fullName) : left.fullName.localeCompare(right.fullName)
  })
}

export function sortPaymentHistory(payments: PaymentRecord[], sort: PaymentSort) {
  return [...payments].sort((left, right) => {
    if (sort === 'date-desc') return right.paymentDate.localeCompare(left.paymentDate)
    if (sort === 'date-asc') return left.paymentDate.localeCompare(right.paymentDate)
    if (sort === 'amount-desc') return right.amountPaid - left.amountPaid
    if (sort === 'amount-asc') return left.amountPaid - right.amountPaid
    if (sort === 'name-desc') return right.studentName.localeCompare(left.studentName)
    return left.studentName.localeCompare(right.studentName)
  })
}
