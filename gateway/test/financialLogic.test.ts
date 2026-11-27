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

function setup(students: Student[], payments: Payment[], mockIndexedReaders = true) {
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
  if (mockIndexedReaders) {
    context.readIndexedStudents_ = (filters: { studentId?: string }) =>
      students.filter((student) => !filters.studentId || student.studentId === filters.studentId).map((student) => ({ ...student }))
    context.readIndexedPayments_ = (filters: { studentId?: string }) =>
      payments.filter((payment) => !filters.studentId || payment.studentId === filters.studentId).map((payment) => ({ ...payment }))
  }
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
      clearContent: () => range.setValues(Array.from({ length: height }, () => Array<unknown>(width).fill(''))),
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

function indexedFinancialFixture() {
  const context = setup([], [], false)
  const properties = new Map<string, string>()
  const sheetFor = (name: string) => new PaymentSheet(vm.runInContext(`CONFIG.${name}.slice()`, context) as string[])
  const admissions = sheetFor('ADMISSION_HEADERS')
  const studentsIndex = sheetFor('STUDENTS_INDEX_HEADERS')
  const sourcePayments = sheetFor('PAYMENT_HEADERS')
  const paymentsIndex = sheetFor('PAYMENT_HEADERS')
  const rowFor = (sheet: PaymentSheet, values: Record<string, unknown>) => sheet.headers.map((header) => values[header] ?? '')
  const admission = {
    'Student ID': 'A', 'Full Name': 'Test Student', Course: 'Test', Batch: '01',
    'Admission Date': '2026-01-01', 'Total Course Fee': 20000.03, Discount: 0, 'Final Fee': 20000.03,
  }
  admissions.rows.push(rowFor(admissions, admission))
  studentsIndex.rows.push(rowFor(studentsIndex, { ...admission, 'Total Paid': '#NUM!', Balance: '#NUM!' }))
  for (const values of [
    { 'Receipt ID': 'R1', 'Amount Paid': 1000.01, 'Previous Paid': 0, 'Payment Date': '2026-02-01' },
    { 'Receipt ID': 'R2', 'Amount Paid': 500.02, 'Previous Paid': 1000.01, 'Payment Date': '2026-01-01' },
  ]) {
    const receipt = { ...values, 'Student ID': 'A', Course: 'Test', 'Total Paid': '#NUM!', Balance: '#NUM!' }
    sourcePayments.rows.push(rowFor(sourcePayments, receipt))
    paymentsIndex.rows.push(rowFor(paymentsIndex, receipt))
  }
  context.LockService = { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) }
  context.PropertiesService = { getScriptProperties: () => ({
    getProperty: (key: string) => properties.get(key) ?? null,
    getProperties: () => Object.fromEntries(properties),
    setProperty: (key: string, value: string) => properties.set(key, value),
    deleteProperty: (key: string) => properties.delete(key),
  }) }
  context.getCourseCodes_ = () => [{ code: '02', courseName: 'Test', type: 'regular' }]
  context.getCreatedBy_ = () => 'test'
  context.findAdmissionSheetForCourse_ = () => ({ sheet: admissions })
  context.findPaymentSheetForCourse_ = () => ({ sheet: sourcePayments })
  context.getStudentsIndexSheet_ = () => studentsIndex
  context.getPaymentsIndexSheet_ = () => paymentsIndex
  context.getVisitorsIndexSheet_ = () => sheetFor('VISITOR_HEADERS')
  context.getFollowUpsIndexSheet_ = () => sheetFor('FOLLOW_UP_HEADERS')
  context.readVisitorSourceRecords_ = () => []
  context.readFollowUpSourceRecords_ = () => []
  return { context, admissions, sourcePayments, studentsIndex, paymentsIndex, properties }
}

describe('Apps Script financial calculations', () => {
  it('loads real indexed dashboard, student details and receipt history despite #NUM! summaries without changing source cells', () => {
    const { context, sourcePayments } = indexedFinancialFixture()
    const before = structuredClone(sourcePayments.rows)
    expect(context.getDashboardData_()).toMatchObject({ totalStudents: 1, totalCollected: 1500.03, outstandingFees: 18500 })
    expect(context.getStudentDetails_({ studentId: 'A' })).toMatchObject({ totalPaid: 1500.03, balance: 18500 })
    expect(context.getPayments_({})).toMatchObject([
      { receiptId: 'R1', previousPaid: 0, totalPaid: 1000.01, balance: 19000.02 },
      { receiptId: 'R2', previousPaid: 1000.01, totalPaid: 1500.03, balance: 18500 },
    ])
    expect(sourcePayments.rows).toEqual(before)
  })

  it('ignores damaged student index totals even when no payment snapshot needs recovery', () => {
    const { context, paymentsIndex } = indexedFinancialFixture()
    for (const row of paymentsIndex.rows) {
      row[paymentsIndex.headers.indexOf('Total Paid')] = 999
      row[paymentsIndex.headers.indexOf('Balance')] = 999
    }
    expect(context.getStudents_({})).toMatchObject([{ totalPaid: 1500.03, balance: 18500 }])
    expect(context.getPayments_({})[0]).toMatchObject({ totalPaid: 999, balance: 999 })
  })

  it.each(['Amount Paid', 'Previous Paid', 'Final Fee', 'Total Course Fee', 'Discount'])(
    'still rejects #NUM! in %s instead of guessing a financial value',
    (column) => {
      const { context, admissions, studentsIndex, sourcePayments, paymentsIndex } = indexedFinancialFixture()
      const sheets = column.endsWith('Paid') ? [sourcePayments, paymentsIndex] : [admissions, studentsIndex]
      for (const sheet of sheets) sheet.rows[0]![sheet.headers.indexOf(column)] = '#NUM!'
      const before = structuredClone(sourcePayments.rows)
      expect(() => context.getDashboardData_()).toThrow('Invalid fee amount: #NUM!')
      expect(() => context.repairFinancialSummaries()).toThrow('Invalid fee amount: #NUM!')
      expect(sourcePayments.rows).toEqual(before)
    },
  )

  it('refuses to recover damaged snapshots without a matching admission or source receipt', () => {
    const { context, admissions, paymentsIndex } = indexedFinancialFixture()
    admissions.rows = []
    expect(() => context.getPayments_({})).toThrow('no matching admission')
    paymentsIndex.rows[0]![paymentsIndex.headers.indexOf('Previous Paid')] = ''
    paymentsIndex.rows[0]![paymentsIndex.headers.indexOf('Receipt ID')] = 'missing'
    expect(() => context.getPayments_({})).toThrow('source receipt "missing" was not found')
  })

  it.each([0, 1])('recovers blank Previous Paid from actual source receipts before receipt %s, not payment-date order', (index) => {
    const { context, sourcePayments, paymentsIndex } = indexedFinancialFixture()
    for (const sheet of [sourcePayments, paymentsIndex]) {
      sheet.rows[index]![sheet.headers.indexOf('Previous Paid')] = ''
    }
    expect(context.getPayments_({})[index]).toMatchObject(index === 0
      ? { previousPaid: 0, totalPaid: 1000.01, balance: 19000.02 }
      : { previousPaid: 1000.01, totalPaid: 1500.03, balance: 18500 })
    expect(context.repairFinancialSummaries().cellsRepaired).toBe(5)
    expect(sourcePayments.rows[index]![sourcePayments.headers.indexOf('Previous Paid')]).toBe(index === 0 ? 0 : 1000.01)
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 1500.03, outstandingFees: 18500 })
  })

  it('rejects a mismatched or duplicate source receipt instead of inventing missing Previous Paid', () => {
    const { context, sourcePayments, paymentsIndex } = indexedFinancialFixture()
    paymentsIndex.rows[0]![paymentsIndex.headers.indexOf('Previous Paid')] = ''
    paymentsIndex.rows[0]![paymentsIndex.headers.indexOf('Amount Paid')] = 999
    expect(() => context.getPayments_({})).toThrow('does not match its source payment')
    paymentsIndex.rows[0]![paymentsIndex.headers.indexOf('Amount Paid')] = 1000.01
    sourcePayments.rows.push([...sourcePayments.rows[0]!])
    expect(() => context.getPayments_({})).toThrow('Duplicate source receipt')
  })

  it('saves the first payment on an empty sheet, then settles the exact balance through real index writes and dashboard reads', () => {
    const { context, sourcePayments, paymentsIndex, properties } = indexedFinancialFixture()
    sourcePayments.rows = []
    paymentsIndex.rows = []
    const payload = {
      idempotencyKey: 'first-empty-sheet-payment', course: 'Test', studentId: 'A',
      paymentDate: '2026-02-01', amountPaid: 5000.01,
    }
    const first = context.addPayment_(payload)
    expect(first).toMatchObject({ receipt: { previousPaid: 0, totalPaid: 5000.01, balance: 15000.02 } })
    expect(first.indexWarning).toBeUndefined()
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 5000.01, outstandingFees: 15000.02 })
    expect(context.getStudentDetails_({ studentId: 'A' })).toMatchObject({ totalPaid: 5000.01, balance: 15000.02 })
    properties.clear()
    expect(context.addPayment_(payload).receipt).toEqual(first.receipt)
    expect(sourcePayments.rows).toHaveLength(1)
    const settled = context.addPayment_({
      ...payload, idempotencyKey: 'settle-empty-sheet-payment', paymentDate: '2026-01-01', amountPaid: 15000.02,
    })
    expect(settled).toMatchObject({ receipt: { previousPaid: 5000.01, totalPaid: 20000.03, balance: 0 } })
    expect(settled.indexWarning).toBeUndefined()
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 20000.03, outstandingFees: 0 })
    expect(context.getStudents_({})).toMatchObject([{ paymentStatus: 'Paid', paymentCount: 2, balance: 0 }])
    expect(() => context.addPayment_({ ...payload, idempotencyKey: 'overpaid-empty-sheet-payment', amountPaid: 0.01 }))
      .toThrow('exceeds')
    expect(sourcePayments.rows).toHaveLength(2)
    expect(paymentsIndex.rows).toHaveLength(2)
  })

  it.each([
    { previousPaid: undefined, totalPaid: Number.NaN, balance: Number.NaN },
    { previousPaid: 0, totalPaid: 5000, balance: Number.NaN },
    { previousPaid: 0, totalPaid: 5001, balance: 14999 },
    { previousPaid: 0, totalPaid: 5000, balance: 15000, paymentCount: Number.NaN },
  ])('rejects invalid financial snapshots before writing source cells: %j', (snapshot) => {
    const { context, sheet } = paymentFixture()
    expect(() => context.appendPayment_(sheet, { amountPaid: 5000, ...snapshot })).toThrow()
    expect(sheet.rows).toHaveLength(0)
  })

  it('previews without writing, repairs only damaged source summary cells, and rebuilds real indexes', () => {
    const { context, sourcePayments, studentsIndex, properties } = indexedFinancialFixture()
    const before = structuredClone(sourcePayments.rows)
    expect(context.previewFinancialSummaryRepair()).toMatchObject({ cellsToRepair: 4, studentCount: 1, paymentCount: 2 })
    expect(sourcePayments.rows).toEqual(before)
    expect(properties.size).toBe(0)
    expect(context.repairFinancialSummaries()).toMatchObject({ cellsRepaired: 4, studentCount: 1, paymentCount: 2 })
    const summaryColumns = ['Total Paid', 'Balance'].map((column) => sourcePayments.headers.indexOf(column))
    for (const [index, row] of sourcePayments.rows.entries()) {
      for (const [column, value] of row.entries()) {
        if (!summaryColumns.includes(column)) expect(value).toEqual(before[index]![column])
      }
    }
    expect(sourcePayments.rows.map((row) => summaryColumns.map((column) => row[column])))
      .toEqual([[1000.01, 19000.02], [1500.03, 18500]])
    expect(studentsIndex.rows[0]![studentsIndex.headers.indexOf('Total Paid')]).toBe(1500.03)
    expect(studentsIndex.rows[0]![studentsIndex.headers.indexOf('Balance')]).toBe(18500)
    expect(properties.size).toBe(0)
    expect(context.getDashboardData_()).toMatchObject({ totalCollected: 1500.03, outstandingFees: 18500 })
    expect(context.repairFinancialSummaries().cellsRepaired).toBe(0)
  })

  it('keeps financial access blocked if source repair or index rebuilding is interrupted', () => {
    for (const failureTarget of ['source', 'index']) {
      const { context, sourcePayments, paymentsIndex } = indexedFinancialFixture()
      const sheet = failureTarget === 'source' ? sourcePayments : paymentsIndex
      sheet.failAfterNextWrite = true
      expect(() => context.repairFinancialSummaries()).toThrow('Payment write response interrupted')
      expect(() => context.getDashboardData_()).toThrow('indexes need reconciliation')
      expect(context.repairFinancialSummaries()).toMatchObject({ studentCount: 1, paymentCount: 2 })
      expect(context.getDashboardData_()).toMatchObject({ totalCollected: 1500.03, outstandingFees: 18500 })
    }
  })

  it('recovers a retried payment with damaged source summaries without adding another transaction', () => {
    const { context, sheet, properties } = paymentFixture()
    const payload = { idempotencyKey: 'payment-num-recovery', course: 'Test', studentId: 'A', paymentDate: '2026-01-01', amountPaid: 5000 }
    context.addPayment_(payload)
    sheet.rows[0]![sheet.headers.indexOf('Total Paid')] = '#NUM!'
    sheet.rows[0]![sheet.headers.indexOf('Balance')] = '#NUM!'
    properties.clear()
    expect(context.addPayment_(payload).receipt).toMatchObject({ totalPaid: 5000, balance: 15000 })
    expect(sheet.rows).toHaveLength(1)
    expect(context.addPayment_({ ...payload, idempotencyKey: 'payment-num-next', amountPaid: 3000 }).receipt)
      .toMatchObject({ totalPaid: 8000, balance: 12000 })
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.rows[1]![sheet.headers.indexOf('Total Paid')]).toBe(8000)
    expect(sheet.rows[1]![sheet.headers.indexOf('Balance')]).toBe(12000)
  })

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

  it.each([undefined, '', '   '])('rejects Cash with missing receiver remarks (%s) before recording a payment', (remarks) => {
    const { context, sheet } = paymentFixture()
    expect(() => context.addPayment_({
      idempotencyKey: 'cash-receiver-required', course: 'Test', studentId: 'A',
      paymentDate: '2026-01-01', amountPaid: 5000, paymentMode: 'Cash', remarks,
    })).toThrow('LSA staff name who received the cash')
    expect(sheet.rows).toHaveLength(0)
  })

  it('stores the Cash receiver in source and index remarks without duplicating retries', () => {
    const { context, sheet } = paymentFixture()
    let indexedRemarks: string | undefined
    context.synchronizePaymentIndexes_ = (record: { remarks: string }) => { indexedRemarks = record.remarks }
    const payload = {
      idempotencyKey: 'cash-receiver-saved', course: 'Test', studentId: 'A',
      paymentDate: '2026-01-01', amountPaid: 5000, paymentMode: 'Cash', remarks: '  Test Staff  ',
    }
    expect(context.addPayment_(payload).receipt.totalPaid).toBe(5000)
    expect(sheet.rows[0][sheet.headers.indexOf('Remarks')]).toBe('Test Staff')
    expect(indexedRemarks).toBe('Test Staff')
    expect(context.addPayment_(payload).receipt.totalPaid).toBe(5000)
    expect(sheet.rows).toHaveLength(1)
  })

  it.each(['UPI', 'Bank Transfer'])('keeps remarks optional for %s', (paymentMode) => {
    const { context, sheet } = paymentFixture()
    expect(context.addPayment_({
      idempotencyKey: 'non-cash-remarks-optional', course: 'Test', studentId: 'A',
      paymentDate: '2026-01-01', amountPaid: 5000, paymentMode,
    }).receipt.totalPaid).toBe(5000)
    expect(sheet.rows).toHaveLength(1)
  })

  it('recovers an already-saved Cash payment without old receiver remarks', () => {
    const { context, sheet, properties } = paymentFixture()
    context.ensurePaymentIdempotencyColumns_(sheet)
    const payload = {
      idempotencyKey: 'legacy-cash-recovery', course: 'Test', studentId: 'A',
      paymentDate: '2026-01-01', amountPaid: 5000, paymentMode: 'Cash',
    }
    const idempotency = context.getIdempotencyContext_('add-payment', payload)
    const values: Record<string, unknown> = {
      'Receipt ID': 'TEST-LEGACY-CASH', 'Student ID': 'A', 'Student Name': 'Test Student',
      Course: 'Test', Batch: '01', 'Enrollment Month': 'January', 'Enrollment Year': '2026',
      'Payment Date': '2026-01-01', 'Amount Paid': 5000, 'Payment Mode': 'Cash',
      'Previous Paid': 0, 'Total Paid': 5000, Balance: 15000, 'Created At': '2026-01-01',
      'Idempotency Key': idempotency.key, 'Idempotency Fingerprint': idempotency.fingerprint,
    }
    sheet.rows.push(sheet.headers.map((header) => values[header] ?? ''))
    const dirtyProperty = vm.runInContext('FINANCIAL_INDEX_DIRTY_PROPERTY_', context) as string
    properties.set(dirtyProperty, `payment:${payload.idempotencyKey}`)
    expect(context.addPayment_(payload).receipt).toMatchObject({
      receiptId: 'TEST-LEGACY-CASH', totalPaid: 5000, balance: 15000,
    })
    expect(sheet.rows).toHaveLength(1)
    expect(properties.get(dirtyProperty)).toBeUndefined()
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
