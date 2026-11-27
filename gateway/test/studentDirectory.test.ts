import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/features/courseCodes/CourseLabel.tsx', () => ({
  CourseLabel: ({ name }: { name: string }) => name,
}))

vi.mock('../../src/features/courseCodes/courseCodeService.ts', () => ({
  getCourseCodeByName: (name: string) => name === 'Data Science'
    ? { code: '02' }
    : name === 'Cyber Security' ? { code: '03' } : undefined,
}))

const modulePath = fileURLToPath(new URL('../../src/features/students/studentDirectoryUtils.ts', import.meta.url))
const { summarizeAdmissions, courseNavigation, batchNavigation, filterAdmissions, formatAdmissionFeeStatus } = await import(modulePath)
const { getAdmissionNumberPreview, initialAdmissionForm, createInitialAdmissionForm, normalizeAdmissionEmail, validateAdmissionForm } = await import(fileURLToPath(new URL('../../src/features/admissions/admissionFormUtils.ts', import.meta.url)))

const students = [
  { studentId: 'A001', fullName: 'Anita Rao', mobileNumber: '9876543210', email: 'anita@example.test', course: 'Data Science', batch: '01', enrollmentYear: '2025', admissionDate: '2026-02-28' },
  { studentId: 'A002', fullName: 'Bina Shah', mobileNumber: '9876543211', email: 'bina@example.test', course: 'data science', batch: '02', enrollmentYear: '2026', admissionDate: '2/1/2026' },
  { studentId: 'A003', fullName: 'Chitra Roy', mobileNumber: '9876543212', email: 'chitra@example.test', course: 'Legacy Course', batch: '01', enrollmentYear: '2025', admissionDate: '2025-02-28' },
]

describe('admissions directory', () => {
  it.each([
    { parentsPhoneNumber: '', invalid: false },
    { parentsPhoneNumber: '+91 90000 00001', invalid: false },
    { parentsPhoneNumber: '12345', invalid: true },
    { parentsPhoneNumber: '9000000000abc', invalid: true },
  ])('validates optional parents phone numbers before submission: "$parentsPhoneNumber"', ({ parentsPhoneNumber, invalid }) => {
    expect(Boolean(validateAdmissionForm({ ...initialAdmissionForm, parentsPhoneNumber }).parentsPhoneNumber)).toBe(invalid)
  })

  it('computes the local admission date each time a form opens or resets, including after midnight', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 10, 27, 23, 59))
      const firstForm = createInitialAdmissionForm()
      expect(firstForm.admissionDate).toBe('2026-11-27')
      vi.setSystemTime(new Date(2026, 10, 28, 0, 1))
      expect(createInitialAdmissionForm().admissionDate).toBe('2026-11-28')
      expect(firstForm.admissionDate).toBe('2026-11-27')
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    { email: '@gmail.com', saved: '', invalid: false },
    { email: '', saved: '', invalid: false },
    { email: ' student@gmail.com ', saved: 'student@gmail.com', invalid: false },
    { email: 'student@example.test', saved: 'student@example.test', invalid: false },
    { email: 'student@', saved: 'student@', invalid: true },
  ])('handles editable admission email defaults without saving an incomplete suffix: "$email"', ({ email, saved, invalid }) => {
    expect(normalizeAdmissionEmail(email)).toBe(saved)
    expect(Boolean(validateAdmissionForm({ ...initialAdmissionForm, email }).email)).toBe(invalid)
  })

  it('previews the next serial after the highest matching saved admission, including gaps and reordered records', () => {
    const admissions = ['26020103', '27020188', '26020299', '26030199', '26020101', ' 26020109 ', '260201100', '260201xx']
      .map((studentId) => ({ studentId }))
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '01', admissions)).toEqual({ number: '26020110' })
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '01', [])).toEqual({ number: '26020101' })
  })

  it('keeps serial sequences separate for each year, course code and batch', () => {
    const admissions = [{ studentId: '26020101' }, { studentId: '26020102' }]
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '01', admissions).number).toBe('26020103')
    expect(getAdmissionNumberPreview('2027-01-01', 'Data Science', '01', admissions).number).toBe('27020101')
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '02', admissions).number).toBe('26020201')
    expect(getAdmissionNumberPreview('2026-11-27', 'Cyber Security', '01', admissions).number).toBe('26030101')
  })

  it('does not invent serial 01 when records or required admission details are unavailable', () => {
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '01', null)).toEqual({ number: '260201SS' })
    expect(getAdmissionNumberPreview('', 'Unknown course', '', [])).toEqual({ number: 'YYCCBBSS' })
  })

  it('reports the existing two-digit serial limit instead of previewing a nine-digit ID', () => {
    expect(getAdmissionNumberPreview('2026-11-27', 'Data Science', '01', [{ studentId: '26020199' }])).toEqual({
      number: '260201SS',
      error: 'All 99 serial numbers for this year, course and batch have been used. Choose another batch.',
    })
  })

  it.each([
    { balance: 4250.50, mobileNumber: '9000000001', available: true, error: false },
    { balance: 0.01, mobileNumber: '9000000001', available: true, error: false },
    { balance: 0, mobileNumber: '9000000001', available: false, error: false },
    { balance: -10, mobileNumber: '9000000001', available: false, error: false },
    { balance: 4250.50, mobileNumber: '', available: false, error: true },
    { balance: NaN, mobileNumber: '9000000001', available: false, error: true },
  ])('offers fee reminders only for valid outstanding fees (balance $balance, contact "$mobileNumber")', async ({ balance, mobileNumber, available, error }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { StudentDetailsModal } = await import(fileURLToPath(new URL('../../src/features/students/StudentDetailsModal.tsx', import.meta.url)))
    const { mockStudents } = await import(fileURLToPath(new URL('../../src/features/students/mockStudentData.ts', import.meta.url)))
    const student = { ...mockStudents[0], balance, mobileNumber, totalPaid: mockStudents[0].finalFee - balance }
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StudentDetailsModal, {
      student, onClose: vi.fn(), onMakePayment: vi.fn(), payments: [], paymentsError: 'Payment history unavailable.', paymentsLoading: false,
    })))
    const link = html.match(/<a\b[^>]*aria-label="Remind fees on WhatsApp"[^>]*>/)?.[0]
    expect(Boolean(link)).toBe(available)
    expect(html).toContain('Remind Fees')
    expect(html.includes('Fee reminder is unavailable.')).toBe(error)
    if (available) {
      const href = link?.match(/href="([^"]+)"/)?.[1]
      const message = new URL(href ?? '').searchParams.get('text')
      const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balance)
      expect(message).toContain(`Balance Left: ${amount}`)
      expect(message).toContain(`Admission Number: ${student.studentId}`)
    } else {
      expect(html.match(/<button\b[^>]*aria-label="Remind fees on WhatsApp"[^>]*>/)?.[0]).toMatch(/\bdisabled=/)
    }
  })

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
    { name: 'payment history unavailable', mobileNumber: '9000000001', error: 'Payment history unavailable.', loading: false, available: true },
    { name: 'payment history loading', mobileNumber: '9000000001', error: '', loading: true, available: true },
    { name: 'missing contact details', mobileNumber: '', error: '', loading: false, available: false },
  ])('offers a later confirmation in paid student records ($name)', async ({ mobileNumber, error, loading, available }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { StudentDetailsModal } = await import(fileURLToPath(new URL('../../src/features/students/StudentDetailsModal.tsx', import.meta.url)))
    const { mockStudents } = await import(fileURLToPath(new URL('../../src/features/students/mockStudentData.ts', import.meta.url)))
    const student = { ...mockStudents[0], mobileNumber, balance: 0, totalPaid: mockStudents[0].finalFee }
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StudentDetailsModal, {
      student, onClose: vi.fn(), onMakePayment: vi.fn(), payments: [], paymentsError: error, paymentsLoading: loading,
    })))
    const header = html.match(/<header class="student-detail-modal__header">[\s\S]*?<\/header>/)?.[0] ?? ''
    expect(header).toContain('View Admission Document')
    const link = header.match(/<a\b[^>]*aria-label="Send admission confirmation on WhatsApp"[^>]*>/)?.[0]
    expect(Boolean(link)).toBe(available)
    if (available) {
      const href = link?.match(/href="([^"]+)"/)?.[1]
      const message = new URL(href ?? '').searchParams.get('text')
      expect(message).toContain(`Dear ${student.fullName}`)
      expect(message).toContain(`Course: ${student.course}`)
      expect(message).toContain('minimum of 90% attendance')
      expect(message).not.toContain('Payment Received:')
    } else {
      expect(header.match(/<button\b[^>]*aria-label="Send admission confirmation on WhatsApp"[^>]*>/)?.[0]).toMatch(/\bdisabled=/)
      expect(html).toContain('Admission confirmation is unavailable.')
    }
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
