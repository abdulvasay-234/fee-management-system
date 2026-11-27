import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/features/courseCodes/CourseLabel.tsx', () => ({
  CourseLabel: ({ name }: { name: string }) => name,
}))

const modulePath = fileURLToPath(new URL('../../src/features/students/studentDirectoryUtils.ts', import.meta.url))
const { summarizeAdmissions, courseNavigation, batchNavigation, filterAdmissions, formatAdmissionFeeStatus } = await import(modulePath)

const students = [
  { studentId: 'A001', fullName: 'Anita Rao', mobileNumber: '9876543210', email: 'anita@example.test', course: 'Data Science', batch: '01', enrollmentYear: '2025', admissionDate: '2026-02-28' },
  { studentId: 'A002', fullName: 'Bina Shah', mobileNumber: '9876543211', email: 'bina@example.test', course: 'data science', batch: '02', enrollmentYear: '2026', admissionDate: '2/1/2026' },
  { studentId: 'A003', fullName: 'Chitra Roy', mobileNumber: '9876543212', email: 'chitra@example.test', course: 'Legacy Course', batch: '01', enrollmentYear: '2025', admissionDate: '2025-02-28' },
]

describe('admissions directory', () => {
  it.each([
    { balance: 0, blocked: true },
    { balance: -10, blocked: true },
    { balance: 0.01, blocked: false },
  ])('blocks Make Payment only when no fees remain (balance $balance)', async ({ balance, blocked }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { StudentDetailsModal } = await import(fileURLToPath(new URL('../../src/features/students/StudentDetailsModal.tsx', import.meta.url)))
    const { mockStudents } = await import(fileURLToPath(new URL('../../src/features/students/mockStudentData.ts', import.meta.url)))
    const student = { ...mockStudents[0], balance, totalPaid: mockStudents[0].finalFee - balance }
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StudentDetailsModal, {
      student, onClose: vi.fn(), onMakePayment: vi.fn(), payments: [], paymentsError: '', paymentsLoading: false,
    })))
    const attributes = html.match(/<button\b([^>]*)>(?:(?!<\/button>)[\s\S])*?Make Payment<\/button>/)?.[1]
    expect(attributes).toBeDefined()
    expect(/\bdisabled=/i.test(attributes ?? '')).toBe(blocked)
  })

  it('shows the recorded pending due or paid without treating missing balances as paid', () => {
    expect(formatAdmissionFeeStatus(12000.50)).toBe('Pending Due: ₹12,000.50')
    expect(formatAdmissionFeeStatus(0.01)).toBe('Pending Due: ₹0.01')
    expect(formatAdmissionFeeStatus(0)).toBe('Paid')
    expect(formatAdmissionFeeStatus(-50)).toBe('Paid')
    expect(formatAdmissionFeeStatus(undefined)).toBe('Unavailable')
    expect(formatAdmissionFeeStatus(NaN)).toBe('Unavailable')
    expect(formatAdmissionFeeStatus(Infinity)).toBe('Unavailable')
  })

  it.each([
    { count: 5, loading: false, error: '', expected: '5' },
    { count: 0, loading: false, error: '', expected: '0' },
    { count: 5, loading: true, error: '', expected: 'Loading...' },
    { count: 5, loading: false, error: 'Payment history unavailable.', expected: 'Unavailable' },
  ])('shows the completed payment count in Fee Information ($expected)', async ({ count, loading, error, expected }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { StudentDetailsModal } = await import(fileURLToPath(new URL('../../src/features/students/StudentDetailsModal.tsx', import.meta.url)))
    const { mockStudents } = await import(fileURLToPath(new URL('../../src/features/students/mockStudentData.ts', import.meta.url)))
    const student = mockStudents[0]
    const payments = Array.from({ length: count }, (_, index) => ({
      paymentId: `TEST-PAYMENT-${index + 1}`, receiptId: `TEST-RECEIPT-${index + 1}`,
      studentId: student.studentId, studentName: student.fullName, course: student.course, batch: student.batch,
      enrollmentMonth: student.enrollmentMonth, enrollmentYear: student.enrollmentYear,
      paymentDate: '2026-11-27', feeType: 'Course Fee', amountPaid: 1000, paymentMode: 'Cash',
      previousPaid: index * 1000, totalPaid: (index + 1) * 1000, balance: student.finalFee - (index + 1) * 1000,
      createdBy: 'Test Staff', createdAt: '2026-11-27', remarks: '',
    }))
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StudentDetailsModal, {
      student, onClose: vi.fn(), onMakePayment: vi.fn(), payments, paymentsError: error, paymentsLoading: loading,
    })))
    const feeSection = html.match(/<section class="student-detail-group"><h3>Fee Information<\/h3>[\s\S]*?<\/section>/)?.[0]
    expect(feeSection).toContain(`<dt>Number of Instalments / Payments Done</dt><dd>${expected}</dd>`)
  })

  it('counts unique admissions by their local calendar admission date', () => {
    expect(summarizeAdmissions(students, new Date(2026, 1, 28, 23, 30))).toEqual({
      totalStudents: 3,
      admissionsToday: 1,
      admissionsThisMonth: 2,
      invalidDates: 0,
      courses: [{ name: 'Data Science', count: 2 }, { name: 'Legacy Course', count: 1 }],
    })
    expect(summarizeAdmissions(students, new Date(2026, 2, 1))).toMatchObject({ admissionsToday: 0, admissionsThisMonth: 0 })
    const timestamp = new Date(2026, 1, 28, 0, 30).toISOString()
    expect(summarizeAdmissions([{ ...students[0], admissionDate: timestamp }], new Date(2026, 1, 28))).toMatchObject({ admissionsToday: 1 })
    expect(summarizeAdmissions([{ ...students[0], admissionDate: '2026-02-29' }]).invalidDates).toBe(1)
    expect(summarizeAdmissions([{ ...students[0], admissionDate: '' }]).invalidDates).toBe(1)
    expect(summarizeAdmissions([{ ...students[0], admissionDate: '2024-02-29' }], new Date(2024, 1, 29))).toMatchObject({ admissionsToday: 1, invalidDates: 0 })
  })

  it('includes all admissions by course regardless of date, and handles an empty directory', () => {
    expect(summarizeAdmissions([{ ...students[0], admissionDate: '' }, students[1]]).courses)
      .toEqual([{ name: 'Data Science', count: 2 }])
    expect(summarizeAdmissions([]).courses).toEqual([])
  })

  it('rejects missing or duplicate admission IDs and missing courses', () => {
    expect(() => summarizeAdmissions([...students, { ...students[0], studentId: ' A001 ' }])).toThrow(/duplicate admission ID/)
    expect(() => summarizeAdmissions([{ ...students[0], studentId: ' ' }])).toThrow(/missing or duplicate admission ID/)
    expect(() => summarizeAdmissions([{ ...students[0], course: ' ' }])).toThrow(/has no course/)
  })

  it('includes active catalog courses and historical admission courses without duplicates', () => {
    const catalog = [
      { name: 'Data Science', active: true },
      { name: 'Cyber Security', active: true },
      { name: 'Legacy Course', active: false },
      { name: 'Unused Course', active: false },
    ]
    expect(courseNavigation(catalog, students)).toEqual([
      { name: 'Cyber Security', active: true },
      { name: 'Data Science', active: true },
      { name: 'Legacy Course', active: false },
    ])
    expect(courseNavigation([], students)).toEqual([
      { name: 'Data Science', active: null },
      { name: 'Legacy Course', active: null },
    ])
  })

  it('derives batches and admission counts only from the selected course', () => {
    expect(batchNavigation(students, '')).toEqual([])
    expect(batchNavigation(students, 'DATA SCIENCE')).toEqual([{ name: '01', count: 1 }, { name: '02', count: 1 }])
    expect(batchNavigation(students, 'Legacy Course')).toEqual([{ name: '01', count: 1 }])
    expect(batchNavigation(students, 'Cyber Security')).toEqual([])
    expect(batchNavigation([...students, { ...students[0], studentId: 'A004' }], 'Data Science')[0]).toEqual({ name: '01', count: 2 })
  })

  it('combines course, batch and year with search across all supported fields', () => {
    const filters = { query: '', year: '' }
    expect(filterAdmissions(students, filters, '', '')).toHaveLength(3)
    for (const query of ['a001', 'ANITA', '43210', 'anita@example']) {
      expect(filterAdmissions(students, { ...filters, query }, 'DATA SCIENCE', '01').map((student: { studentId: string }) => student.studentId)).toEqual(['A001'])
    }
    expect(filterAdmissions(students, { query: '', year: '2025' }, 'Data Science', '01').map((student: { studentId: string }) => student.studentId)).toEqual(['A001'])
    expect(filterAdmissions(students, { query: '', year: '2025' }, 'Data Science', '02')).toEqual([])
  })
})
