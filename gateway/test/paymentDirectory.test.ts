import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../../src/features/payments/paymentDirectoryUtils.ts', import.meta.url))
const {
  changePaymentFilter, emptyPaymentFilters, filterPaymentHistory, filterStudentFees,
  paymentBatchOptions, paymentSummaryScope, sortStudentFees, sortPaymentHistory,
} = await import(modulePath)
const overviewPath = fileURLToPath(new URL('../../src/features/payments/paymentOverview.ts', import.meta.url))
const { summarizePaymentOverview } = await import(overviewPath)

const students = [
  { studentId: 'A001', fullName: 'Anita', mobileNumber: '9876543210', email: 'anita@example.test', course: 'Data Science', batch: '01', enrollmentYear: '2025', enrollmentMonth: 'January', finalFee: 100, totalPaid: 40, balance: 60 },
  { studentId: 'A002', fullName: 'Bina', mobileNumber: '9876543211', email: 'bina@example.test', course: 'Data Science', batch: '01', enrollmentYear: '2026', enrollmentMonth: 'June', finalFee: 200, totalPaid: 200, balance: 0 },
  { studentId: 'A003', fullName: 'Chitra', mobileNumber: '9876543212', email: 'chitra@example.test', course: 'Cyber Security', batch: '02', enrollmentYear: '2026', enrollmentMonth: 'June', finalFee: 300, totalPaid: 0, balance: 300 },
  { studentId: 'A004', fullName: 'Deepa', mobileNumber: '9876543213', email: 'deepa@example.test', course: 'Cyber Security', batch: '03', enrollmentYear: '2025', enrollmentMonth: 'January', finalFee: 50, totalPaid: 55, balance: -5 },
]
const payments = [
  { receiptId: 'R001', studentId: 'A001', studentName: 'Anita', course: 'Old Course Name', batch: '99', enrollmentYear: '2024', enrollmentMonth: 'December', paymentDate: '2026-01-01', amountPaid: 10, balance: 90 },
  { receiptId: 'R002', studentId: 'A001', studentName: 'Anita', course: 'Data Science', batch: '01', enrollmentYear: '2025', enrollmentMonth: 'January', paymentDate: '2026-02-01', amountPaid: 30, balance: 60 },
  { receiptId: 'R003', studentId: 'A002', studentName: 'Bina', course: 'Data Science', batch: '01', enrollmentYear: '2026', enrollmentMonth: 'June', paymentDate: '2026-01-01', amountPaid: 100, balance: 100 },
  { receiptId: 'R004', studentId: 'A002', studentName: 'Bina', course: 'Data Science', batch: '01', enrollmentYear: '2026', enrollmentMonth: 'June', paymentDate: '2026-02-01', amountPaid: 100, balance: 0 },
  { receiptId: 'R005', studentId: 'A004', studentName: 'Deepa', course: 'Cyber Security', batch: '03', enrollmentYear: '2025', enrollmentMonth: 'January', paymentDate: '2026-02-01', amountPaid: 55, balance: -5 },
  { receiptId: 'R006', studentId: 'STANDALONE', studentName: 'Event attendee', course: 'Other Programs', batch: '', enrollmentYear: '2026', enrollmentMonth: 'June', paymentDate: '2026-02-01', amountPaid: 25, balance: 0 },
]
const ids = (records: { studentId: string }[]) => records.map((record) => record.studentId)

describe('Payments directory filters', () => {
  it('includes zero-payment students in pending and cleared/overpaid students in paid', () => {
    expect(ids(filterStudentFees(students, emptyPaymentFilters))).toEqual(['A001', 'A002', 'A003', 'A004'])
    expect(ids(filterStudentFees(students, { ...emptyPaymentFilters, status: 'pending' }))).toEqual(['A001', 'A003'])
    expect(ids(filterStudentFees(students, { ...emptyPaymentFilters, status: 'paid' }))).toEqual(['A002', 'A004'])
  })

  it('combines course, reused batch code, enrollment year/month and student search', () => {
    for (const query of ['a001', 'ANITA', '43210', 'anita@example']) {
      expect(ids(filterStudentFees(students, { ...emptyPaymentFilters, course: 'data science', batch: '01', year: '2025', enrollmentMonth: 'January', query, status: 'pending' }))).toEqual(['A001'])
    }
    expect(ids(filterStudentFees(students, { ...emptyPaymentFilters, batch: '01', year: '2026', enrollmentMonth: 'June' }))).toEqual(['A002'])
    expect(filterStudentFees(students, { ...emptyPaymentFilters, batch: '01', year: '2025', enrollmentMonth: 'June' })).toEqual([])
  })

  it('uses current admission status and cohort, never historical receipt balances', () => {
    const paid = filterPaymentHistory(payments, students, { ...emptyPaymentFilters, course: 'Data Science', status: 'paid' })
    expect(paid.map((payment: { receiptId: string }) => payment.receiptId)).toEqual(['R003', 'R004'])
    const oldBatch = filterPaymentHistory(payments, students, { ...emptyPaymentFilters, course: 'Data Science', batch: '01', year: '2025' })
    expect(oldBatch.map((payment: { receiptId: string }) => payment.receiptId)).toEqual(['R001', 'R002'])
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, status: 'pending', query: 'R003' })).toEqual([])
  })

  it('searches receipts and contact fields and restricts receipt dates only in history', () => {
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, query: 'R002' })).toHaveLength(1)
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, query: 'bina@example', paymentMonth: '2026-01', date: '2026-01-01' })).toHaveLength(1)
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, paymentMonth: '2026-01', date: '2026-02-01' })).toEqual([])
    expect(filterStudentFees(students, { ...emptyPaymentFilters, paymentMonth: '1900-01', date: '1900-01-01' })).toHaveLength(4)
  })

  it('keeps standalone receipts in history but never labels them paid or pending', () => {
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, course: 'Other Programs' })).toHaveLength(1)
    expect(filterPaymentHistory(payments, students, { ...emptyPaymentFilters, course: 'Other Programs', status: 'paid' })).toEqual([])
  })

  it('derives batches from the current course/cohort and resets incompatible selections', () => {
    expect(paymentBatchOptions(students, payments, { ...emptyPaymentFilters, course: 'Data Science' })).toEqual(['01'])
    expect(paymentBatchOptions(students, payments, { ...emptyPaymentFilters, course: 'Cyber Security', year: '2025' })).toEqual(['03'])
    const selected = { ...emptyPaymentFilters, course: 'Data Science', batch: '01' }
    expect(changePaymentFilter(selected, 'course', 'Cyber Security', students, payments).batch).toBe('')
    const cyber = { ...emptyPaymentFilters, course: 'Cyber Security', batch: '03' }
    expect(changePaymentFilter(cyber, 'year', '2026', students, payments).batch).toBe('')
    expect(changePaymentFilter(selected, 'year', '2025', students, payments).batch).toBe('01')
  })

  it('reconciles filtered summaries without losing unpaid admissions or counting admissions per receipt', () => {
    const pending = filterStudentFees(students, { ...emptyPaymentFilters, status: 'pending' })
    const scope = paymentSummaryScope('students', pending, [], students, payments)
    expect(summarizePaymentOverview(scope.payments, scope.students)).toMatchObject({ totalFees: 400, totalCollected: 40, outstanding: 360, pendingAdmissions: 2 })
    const history = filterPaymentHistory(payments, students, { ...emptyPaymentFilters, course: 'Data Science' })
    const receiptScope = paymentSummaryScope('history', [], history, students, payments)
    expect(summarizePaymentOverview(receiptScope.payments, receiptScope.students)).toMatchObject({ totalFees: 300, totalCollected: 240, outstanding: 60 })
    const monthly = history.filter((payment: { paymentDate: string }) => payment.paymentDate === '2026-01-01')
    const monthlyScope = paymentSummaryScope('history', [], monthly, students, payments)
    expect(summarizePaymentOverview(monthlyScope.payments, monthlyScope.students)).toMatchObject({ totalFees: 300, totalCollected: 110, outstanding: 60 })
    const empty = paymentSummaryScope('students', [], [], students, payments)
    expect(summarizePaymentOverview(empty.payments, empty.students)).toMatchObject({ totalFees: 0, totalCollected: 0, outstanding: 0 })
  })

  it('sorts highest pending balances first and preserves receipt sort choices without mutating data', () => {
    expect(ids(sortStudentFees(students, 'balance-desc'))).toEqual(['A003', 'A001', 'A002', 'A004'])
    expect(ids(sortStudentFees(students, 'fee-desc'))).toEqual(['A003', 'A002', 'A001', 'A004'])
    expect(sortPaymentHistory(payments, 'amount-desc')[0].amountPaid).toBe(100)
    expect(students[0].studentId).toBe('A001')
    expect(payments[0].receiptId).toBe('R001')
  })
})
