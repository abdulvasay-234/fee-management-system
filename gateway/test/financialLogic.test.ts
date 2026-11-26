import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

type Student = { studentId: string; finalFee: number; admissionDate: string; course: string }
type Payment = {
  studentId: string
  receiptId: string
  amountPaid: number
  paymentDate: string
  totalPaid: number
  balance: number
  course: string
}

function setup(students: Student[], payments: Payment[]) {
  const context = vm.createContext({
    Utilities: {
      formatDate(date: Date, _zone: string, format: string) {
        const iso = date.toISOString()
        return format === 'yyyy-MM-dd' ? iso.slice(0, 10) : iso.slice(0, 19)
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(_algorithm: string, value: string) { return createHash('sha256').update(value).digest() },
      base64EncodeWebSafe(value: Buffer) { return value.toString('base64url') },
    },
    Session: { getScriptTimeZone: () => 'UTC' },
    Logger: { log: () => undefined },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  })
  for (const filename of ['Code.js', 'IndexApi.js', 'ReadApi.js']) {
    vm.runInContext(readFileSync(new URL(`../../apps-script/${filename}`, import.meta.url), 'utf8'), context)
  }
  context.readIndexedStudents_ = (filters: { studentId?: string }) =>
    students.filter((student) => !filters.studentId || student.studentId === filters.studentId).map((student) => ({ ...student }))
  context.readIndexedPayments_ = (filters: { studentId?: string }) =>
    payments.filter((payment) => !filters.studentId || payment.studentId === filters.studentId).map((payment) => ({ ...payment }))
  context.getCourseCodes_ = () => []
  return context
}

function student(studentId: string, finalFee = 20000): Student {
  return { studentId, finalFee, admissionDate: '2026-01-01', course: 'Test' }
}

function payment(studentId: string, receiptId: string, amountPaid: number, paymentDate: string): Payment {
  return { studentId, receiptId, amountPaid, paymentDate, totalPaid: 999, balance: 999, course: 'Test' }
}

class PaymentSheet {
  rows: unknown[][] = []
  failAfterNextWrite = false
  constructor(readonly headers: string[]) {}
  getLastRow() { return this.rows.length + 1 }
  getLastColumn() { return this.headers.length }
  getMaxColumns() { return 26 }
  getName() { return 'payments' }
  getParent() { return { getId: () => 'test-sheet' } }
  getRange(row: number, column: number, height = 1, width = 1) {
    const range = {
      getDisplayValues: () => Array.from({ length: height }, (_, offset) => {
        const source = row + offset === 1 ? this.headers : this.rows[row + offset - 2] ?? []
        return Array.from({ length: width }, (_, index) => {
          const value = source[column + index - 1]
          if (Object.prototype.toString.call(value) === '[object Date]') return (value as Date).toISOString().slice(0, 10)
          return String(value ?? '')
        })
      }),
      setValues: (values: unknown[][]) => {
        values.forEach((valueRow, offset) => {
          const target: unknown[] = row + offset === 1 ? this.headers : (this.rows[row + offset - 2] ??= [])
          valueRow.forEach((value, index) => { target[column + index - 1] = value })
        })
        if (row > 1 && this.failAfterNextWrite) {
          this.failAfterNextWrite = false
          throw new Error('Payment write response interrupted')
        }
        return range
      },
      setValue: (value: unknown) => range.setValues([[value]]),
      setNumberFormat: () => range,
    }
    return range
  }
}

function paymentFixture() {
  const context = setup([], [])
  const properties = new Map<string, string>()
  const headers = vm.runInContext('CONFIG.PAYMENT_HEADERS.slice()', context) as string[]
  const sheet = new PaymentSheet(headers)
  context.LockService = { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) }
  context.PropertiesService = { getScriptProperties: () => ({
    getProperty: (key: string) => properties.get(key) ?? null,
    getProperties: () => Object.fromEntries(properties),
    setProperty: (key: string, value: string) => properties.set(key, value),
    deleteProperty: (key: string) => properties.delete(key),
  }) }
  context.findCourseCodeByName_ = () => ({ code: '02', courseName: 'Test', active: 'Yes' })
  context.findAdmissionSheetForCourse_ = () => ({ sheet })
  context.findPaymentSheetForCourse_ = () => ({ sheet })
  context.findAdmissionByStudentId_ = (_sheet: unknown, id: string) => ({
    fullName: id, course: 'Test', batch: '01', enrollmentMonth: 'January', enrollmentYear: '2026', finalFee: 20000,
  })
  context.getCreatedBy_ = () => 'test'
  context.synchronizePaymentIndexes_ = () => undefined
  return { context, properties, sheet }
}

describe('Apps Script financial calculations', () => {
  it.each([
    [[], 0, 20000, 'Unpaid'],
    [[5000], 5000, 15000, 'Partially Paid'],
    [[5000, 5000, 3000], 13000, 7000, 'Partially Paid'],
    [[10000, 5000, 5000], 20000, 0, 'Paid'],
    [[20000, 1], 20001, -1, 'Overpaid'],
  ])('derives paid amount and balance from transactions: %j', (amounts, paid, balance, status) => {
    const records = amounts.map((amount, index) => payment('A', `R${index}`, amount, `2026-01-0${index + 1}`))
    const context = setup([student('A')], records)
    const [result] = context.getStudents_({})
    expect(result).toMatchObject({ totalPaid: paid, balance, paymentStatus: status })
    expect(context.getStudentDetails_({ studentId: 'A' })).toMatchObject({ totalPaid: paid, balance })
    expect(context.getDashboardData_()).toMatchObject({
      totalCollected: paid,
      outstandingFees: Math.max(balance, 0),
    })
  })

  it('isolates students, handles backdated payments and sums paise without relying on receipt snapshots', () => {
    const context = setup(
      [student('A', 20000.03), student('B', 0)],
      [payment('A', 'R1', 5000.01, '2026-02-01'), payment('A', 'R2', 3000.02, '2026-01-01')],
    )
    expect(context.getStudents_({})).toMatchObject([
      { totalPaid: 8000.03, balance: 12000, paymentStatus: 'Partially Paid', latestReceiptId: 'R1' },
      { totalPaid: 0, balance: 0, paymentStatus: 'Paid' },
    ])
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 8000.03, outstandingFees: 12000 })
  })

  it('does not net one student’s overpayment against another student’s outstanding fee', () => {
    const context = setup([student('A', 10), student('B', 10)], [payment('A', 'R1', 15, '2026-01-01')])
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 15, outstandingFees: 10 })
  })

  it('links transactions to admissions across courses and reconciles dashboard outstanding fees', () => {
    const admissions = [
      { ...student('A', 100.05), course: 'Cyber Security' },
      { ...student('B', 200), course: 'Cyber Security' },
      { ...student('C', 300), course: 'Data Science' },
      { ...student('D', 50), course: 'Data Science' },
    ]
    const transactions = [
      payment('A', 'R1', 10.01, '2026-01-01'),
      payment('A', 'R2', 5.04, '2026-01-02'),
      payment('B', 'R3', 200, '2026-01-03'),
      payment('D', 'R4', 55, '2026-01-04'),
    ]
    const context = setup(admissions, transactions)
    const records = context.getStudents_({})
    expect(records).toMatchObject([
      { studentId: 'A', totalPaid: 15.05, balance: 85 },
      { studentId: 'B', totalPaid: 200, balance: 0 },
      { studentId: 'C', totalPaid: 0, balance: 300 },
      { studentId: 'D', totalPaid: 55, balance: -5 },
    ])
    expect(context.getDashboardData_().outstandingFees).toBe(385)
    for (const record of records) {
      expect(context.getStudentDetails_({ studentId: record.studentId }))
        .toMatchObject({ totalPaid: record.totalPaid, balance: record.balance })
    }
  })

  it('uses the payment date for daily and monthly collection totals', () => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const earlier = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const context = setup(
      [student('A')],
      [payment('A', 'R1', 100.25, today), payment('A', 'R2', 75.5, earlier)],
    )
    expect(context.getDashboardData_()).toMatchObject({
      todaysCollection: 100.25,
      collectionOverview: { today: 100.25, thisMonth: 100.25, total: 175.75 },
    })
  })

  it('returns an empty payment summary for a new payment sheet', () => {
    const context = setup([], [])
    context.getPaymentHeaderInfo_ = () => ({ headers: ['Student ID', 'Amount Paid'], columns: { 'Student ID': 1, 'Amount Paid': 2 } })
    expect(context.getPreviousPaid_({ getLastRow: () => 1 }, 'A')).toMatchObject({ totalPaid: 0, paymentCount: 0 })
  })

  it('rejects monetary amounts with fractions of a paisa', () => {
    const context = setup([student('A')], [payment('A', 'R1', 1.001, '2026-01-01')])
    expect(() => context.getStudents_({})).toThrow('at most two decimal places')
  })

  it('preserves legacy standalone Other Programs receipts but rejects other unlinked payments', () => {
    const context = setup([], [])
    const legacy = { ...payment('R1', 'R1', 5000, '2026-01-01'), course: 'Other Programs' }
    expect(context.validateIndexes_([], [legacy], [], [], [])).toMatchObject({
      paymentCount: 1, paymentsWithoutStudents: 1, unlinkedOtherProgramPayments: 1,
    })
    expect(() => context.validateIndexes_([], [{ ...legacy, studentId: 'missing' }], [], [], []))
      .toThrow('Payment without matching student')
  })

  it('refuses to rebuild from missing sheets or duplicate source receipts', () => {
    const context = setup([], [])
    context.findPaymentSheetForCourse_ = () => { throw new Error('Payment sheet unavailable') }
    expect(() => context.readPaymentsForCourses_([{ courseName: 'Test' }], {})).toThrow('Payment sheet unavailable')

    const headers = vm.runInContext('CONFIG.PAYMENT_HEADERS.slice()', context) as string[]
    const sheet = new PaymentSheet(headers)
    const row = headers.map((header) => ({
      'Receipt ID': 'duplicate', 'Student ID': 'A', Course: 'Test',
      'Payment Date': '2026-01-01', 'Amount Paid': '5000',
    } as Record<string, string>)[header] ?? '')
    sheet.rows.push([...row], [...row])
    context.findPaymentSheetForCourse_ = () => ({ sheet })
    expect(() => context.readPaymentsForCourses_([{ courseName: 'Test' }], {})).toThrow('Duplicate Receipt ID')
  })

  it('records installments once for a retried idempotency key and keeps students separate', () => {
    const { context, sheet, properties } = paymentFixture()
    const first = { idempotencyKey: 'payment-key-1', course: 'Test', studentId: 'A', paymentDate: '2026-01-01', amountPaid: 5000 }
    expect(context.addPayment_(first).receipt).toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(sheet.headers.slice(-2)).toEqual(['Idempotency Key', 'Idempotency Fingerprint'])
    expect(context.addPayment_(first).receipt).toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(sheet.rows).toHaveLength(1)
    properties.clear()
    expect(context.addPayment_(first).receipt).toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(sheet.rows).toHaveLength(1)
    properties.clear()
    expect(() => context.addPayment_({ ...first, amountPaid: 6000 })).toThrow('reused with different request data')
    expect(context.addPayment_({ ...first, idempotencyKey: 'payment-key-2', amountPaid: 3000 }).receipt)
      .toMatchObject({ totalPaid: 8000, balance: 12000 })
    expect(context.addPayment_({ ...first, idempotencyKey: 'payment-key-3', studentId: 'B' }).receipt)
      .toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(() => context.addPayment_({ ...first, idempotencyKey: 'payment-key-4', amountPaid: 15000 }))
      .toThrow('exceeds')
    expect(sheet.rows).toHaveLength(3)

    context.findCourseCodeByName_ = () => ({ code: '00', courseName: 'Other Programs', active: 'Yes' })
    context.findAdmissionByStudentId_ = () => ({
      fullName: 'C', course: 'Other Programs', batch: '01', enrollmentMonth: 'January', enrollmentYear: '2026', finalFee: 20000,
    })
    expect(context.addPayment_({ ...first, idempotencyKey: 'payment-key-5', course: 'Other Programs', studentId: 'C' }).receipt)
      .toMatchObject({ studentId: 'C', totalPaid: 5000, balance: 15000 })
  })

  it('recovers a payment when the source row was saved but the response was interrupted', () => {
    const { context, sheet } = paymentFixture()
    const payload = { idempotencyKey: 'payment-key-recovery', course: 'Test', studentId: 'A', paymentDate: '2026-01-01', amountPaid: 5000 }
    sheet.failAfterNextWrite = true
    expect(() => context.addPayment_(payload)).toThrow('Payment write response interrupted')
    expect(sheet.rows).toHaveLength(1)
    expect(context.addPayment_(payload).receipt).toMatchObject({ studentId: 'A', totalPaid: 5000, balance: 15000 })
    expect(sheet.rows).toHaveLength(1)
  })

  it('blocks financial reads and unrelated payments until a failed payment index sync is repaired', () => {
    const { context, sheet } = paymentFixture()
    const payload = { idempotencyKey: 'payment-key-index', course: 'Test', studentId: 'A', paymentDate: '2026-01-01', amountPaid: 5000 }
    context.synchronizePaymentIndexes_ = () => { throw new Error('Index unavailable') }
    expect(context.addPayment_(payload).indexWarning).toMatch(/Index synchronization failed/)
    expect(() => context.getDashboardData_()).toThrow('indexes need reconciliation')
    expect(() => context.addPayment_({ ...payload, idempotencyKey: 'payment-key-other' })).toThrow('indexes need reconciliation')
    context.synchronizePaymentIndexes_ = () => undefined
    expect(context.addPayment_(payload).receipt).toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(sheet.rows).toHaveLength(1)
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 0 })
  })
})
