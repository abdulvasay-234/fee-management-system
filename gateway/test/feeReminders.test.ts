import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { filterFeeSchedule, studentFeeSchedule, validateFeeReminderQueue, feeReminderMessage, feeReminderWhatsAppUrl } =
  await import(fileURLToPath(new URL('../../src/features/payments/feeReminders.ts', import.meta.url)))

const initialStudents = [
  { studentId: '26020101', fullName: 'Test A & B', mobileNumber: '9000000001', course: 'Data Science', batch: '01', admissionDate: '11/01/2026', totalPaid: 40, balance: 60, latestPaymentDate: '2026-11-08', paymentCount: 1 },
  { studentId: '26020102', fullName: 'Test Never Paid', mobileNumber: '9000000002', course: 'Data Science', batch: '01', admissionDate: '11/01/2026', totalPaid: 0, balance: 100, latestPaymentDate: '', paymentCount: 0 },
  { studentId: '26020103', fullName: 'Test Upcoming', mobileNumber: '9000000003', course: 'Data Science', batch: '02', admissionDate: '2026-11-01', totalPaid: 40, balance: 60, latestPaymentDate: '2026-11-09', paymentCount: 1 },
  { studentId: '26020104', fullName: 'Test Paid', mobileNumber: '9000000004', course: 'Data Science', batch: '02', admissionDate: '2026-11-01', totalPaid: 100, balance: 0, latestPaymentDate: '2026-11-01', paymentCount: 1 },
  { studentId: '26020105', fullName: 'Test Invalid Mobile', mobileNumber: 'bad number', course: 'Data Science', batch: '02', admissionDate: '2026-11-01', totalPaid: 0, balance: 100, latestPaymentDate: '', paymentCount: 0 },
]

class ReminderSheet {
  rows: string[][] = []
  failAfterWrite = false
  getLastRow() { return this.rows.length }
  getRange(row: number, column: number, height = 1, width = 1) {
    return {
      getDisplayValues: () => Array.from({ length: height }, (_, index) =>
        Array.from({ length: width }, (_, offset) => this.rows[row + index - 1]?.[column + offset - 1] ?? '')),
      setValues: (values: string[][]) => {
        values.forEach((valuesRow, index) => { this.rows[row + index - 1] = valuesRow.slice() })
        if (row > 1 && this.failAfterWrite) {
          this.failAfterWrite = false
          throw new Error('Write response lost')
        }
      },
    }
  }
}

type Queue = {
  announcement: { id: string; status: string; currentRecipientId: string | null; creator: string }
  recipients: Array<{ id: string; studentId: string; status: string; dueDate: string; message: string; balance: number; updatedBy: string }>
  revision: number
}
type Backend = vm.Context & {
  getFeeReminders_: () => Queue[]
  createFeeReminder_: (payload: { id: string; studentIds: string[] }, identity: { email: string }) => Queue
  updateFeeReminder_: (payload: { id: string; revision: number; operationId: string; change: string; recipientId?: string }, identity: { email: string }) => Queue
  feeReminderDueDate_: (student: object) => string
}

const firstAdmin = { email: 'first@example.test' }
const secondAdmin = { email: 'second@example.test' }
const reminderId = 'reminder-test-001'

function setup(students = initialStudents.map((student) => ({ ...student }))) {
  const sheet = new ReminderSheet()
  let created = false
  let locked = false
  const context = vm.createContext({
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => created ? sheet : null,
        insertSheet: () => { created = true; return sheet },
      }),
      flush: () => {},
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_algorithm: string, value: string) => Array.from(createHash('sha256').update(value).digest()),
      base64EncodeWebSafe: (bytes: number[]) => Buffer.from(bytes).toString('base64url'),
      formatDate: (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    LockService: { getScriptLock: () => ({
      waitLock: () => { if (locked) throw new Error('Already locked'); locked = true },
      releaseLock: () => { locked = false },
    }) },
  }) as Backend
  for (const file of ['Code.js', 'ReadApi.js', 'FeeReminders.js']) {
    vm.runInContext(readFileSync(new URL(`../../apps-script/${file}`, import.meta.url), 'utf8'), context)
  }
  context.getStudents_ = (filters: { studentId?: string }) => students.filter((student) => !filters.studentId || student.studentId === filters.studentId).map((student) => ({ ...student }))
  const create = (ids = [initialStudents[0].studentId, initialStudents[1].studentId, initialStudents[4].studentId]) =>
    context.createFeeReminder_({ id: reminderId, studentIds: ids }, firstAdmin)
  let operation = 0
  const update = (queue: Queue, change: string, recipientId?: string, identity = firstAdmin) =>
    context.updateFeeReminder_({ id: reminderId, revision: queue.revision, operationId: `operation-${++operation}`, change, recipientId }, identity)
  return { context, sheet, students, create, update }
}

describe('fee payment due dates and filters', () => {
  it.each([
    ['2026-11-08', '2026-11-28'], ['2026-12-20', '2027-01-09'],
    ['2028-02-10', '2028-03-01'], ['2026-02-10', '2026-03-02'],
  ])('uses exactly 20 calendar days after %s in both frontend and backend', (latestPaymentDate, expected) => {
    const { context } = setup()
    const student = { ...initialStudents[0], latestPaymentDate }
    expect(studentFeeSchedule(student, '2026-11-28').dueDate).toBe(expected)
    expect(context.feeReminderDueDate_(student)).toBe(expected)
  })

  it('uses admission day before the first payment, distinguishes partial/full payment, and never invents missing dates', () => {
    const { context } = setup()
    expect(studentFeeSchedule(initialStudents[1], '2026-11-28')).toMatchObject({ status: 'overdue', dueDate: '2026-11-01' })
    expect(context.feeReminderDueDate_(initialStudents[1])).toBe('2026-11-01')
    const ids = (filter: string) => filterFeeSchedule(initialStudents, filter, '2026-11-28').map((student: { studentId: string }) => student.studentId)
    expect(ids('due')).toEqual(['26020101', '26020102', '26020105'])
    expect(ids('overdue')).toEqual(['26020102', '26020105'])
    expect(ids('upcoming')).toEqual(['26020103'])
    expect(ids('never-paid')).toEqual(['26020102', '26020105'])
    expect(ids('partial')).toEqual(['26020101', '26020103'])
    expect(studentFeeSchedule(initialStudents[3])).toMatchObject({ status: 'paid', dueDate: null })
    expect(studentFeeSchedule({ ...initialStudents[0], latestPaymentDate: '' })).toMatchObject({ status: 'unavailable', dueDate: null })
    expect(studentFeeSchedule({ ...initialStudents[1], admissionDate: '02/30/2026' }).status).toBe('unavailable')
    expect(studentFeeSchedule({ ...initialStudents[1], latestPaymentDate: null }).status).toBe('unavailable')
    expect(studentFeeSchedule({ ...initialStudents[1], admissionDate: 5 }).status).toBe('unavailable')
    expect(() => context.feeReminderDueDate_({ ...initialStudents[1], admissionDate: '5' })).toThrow('unavailable')
  })

  it('uses the India calendar day for timestamped admissions and rejects rolled-over timestamp dates', () => {
    const { context } = setup()
    const student = { ...initialStudents[1], admissionDate: '2026-11-01T20:30:00Z' }
    expect(studentFeeSchedule(student).dueDate).toBe('2026-11-02')
    expect(context.feeReminderDueDate_(student)).toBe('2026-11-02')
    expect(studentFeeSchedule({ ...student, admissionDate: '2026-02-30T00:00:00Z' }).status).toBe('unavailable')
    expect(() => context.feeReminderDueDate_({ ...student, admissionDate: '2026-02-30T00:00:00Z' })).toThrow('Invalid admission/payment date')
  })
})

describe('shared manual fee reminder history', () => {
  it('persists selected snapshots with personalized fees/dates and excludes invalid mobiles from queue progress', () => {
    const { context, create, students } = setup()
    expect(context.getFeeReminders_()).toEqual([])
    const queue = create()
    expect(validateFeeReminderQueue(queue).announcement.status).toBe('paused')
    expect(queue.recipients.map((recipient) => recipient.status)).toEqual(['ready', 'ready', 'invalid'])
    expect(queue.recipients[0].message).toBe(feeReminderMessage(queue.recipients[0]))
    const url = new URL(feeReminderWhatsAppUrl(validateFeeReminderQueue(queue).recipients[0]))
    expect(url.origin + url.pathname).toBe('https://wa.me/919000000001')
    expect(url.searchParams.get('text')).toContain('Dear Test A & B')
    expect(url.searchParams.get('text')).toContain('Payment Due Date: 28 November 2026')
    expect(context.getFeeReminders_()[0]).toEqual(queue)
    expect(students).toEqual(initialStudents)
  })

  describe('fee reminder API confirmation', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    async function loadApi() {
      vi.resetModules()
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
      vi.stubGlobal('window', { setTimeout, clearTimeout })
      const auth = await import(fileURLToPath(new URL('../../src/auth/authService.ts', import.meta.url)))
      auth.setIdToken('synthetic-test-token')
      return import(fileURLToPath(new URL('../../src/services/api.ts', import.meta.url)))
    }

    it('allows a shared reminder write to finish after the old 15-second browser timeout', async () => {
      vi.useFakeTimers()
      const api = await loadApi()
      const queue = setup().create()
      vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        setTimeout(() => resolve(Response.json({ success: true, data: queue })), 20_000)
      })))
      const request = api.createFeeReminder(reminderId, ['26020101', '26020102', '26020105'])
      await vi.advanceTimersByTimeAsync(20_000)
      expect((await request).recipients).toHaveLength(3)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('reports an unresolved tracking update without automatically repeating it', async () => {
      vi.useFakeTimers()
      const api = await loadApi()
      vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })))
      const request = api.updateFeeReminder({ id: reminderId, revision: 0, operationId: 'operation-timeout-001', change: 'resume' })
        .catch((cause: unknown) => cause)
      await vi.advanceTimersByTimeAsync(35_000)
      expect(await request).toBeInstanceOf(api.ApiOutcomeUnknownError)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ operationId: 'operation-timeout-001', revision: 0 })
    })
  })

  it('reuses the original creation after a lost write response without creating duplicates', () => {
    const { create, context, sheet } = setup()
    sheet.failAfterWrite = true
    expect(create).toThrow('Write response lost')
    const queue = create()
    expect(context.getFeeReminders_()).toHaveLength(1)
    expect(queue.recipients).toHaveLength(3)
    expect(sheet.rows).toHaveLength(5)
    expect(() => create(['26020102'])).toThrow('different students')
  })

  it('reports orphaned tracking records instead of returning an empty successful history', () => {
    const { create, context, sheet } = setup()
    create()
    sheet.rows.splice(1, 1)
    expect(() => context.getFeeReminders_()).toThrow('missing or duplicated')
  })

  it('shares progress across administrators, rejects stale revisions, and never counts unopened chats as sent', () => {
    const { create, update, context } = setup()
    const initial = create()
    const active = update(initial, 'resume')
    expect(() => update(active, 'sent', active.announcement.currentRecipientId!)).toThrow('Open WhatsApp first')
    expect(() => update(initial, 'pause', undefined, secondAdmin)).toThrow('another administrator')
    const opened = update(active, 'opened', active.announcement.currentRecipientId!, secondAdmin)
    const sent = update(opened, 'sent', opened.announcement.currentRecipientId!, secondAdmin)
    expect(sent.recipients[0]).toMatchObject({ status: 'sent', updatedBy: secondAdmin.email })
    const completed = update(sent, 'skipped', sent.announcement.currentRecipientId!)
    expect(completed.announcement).toMatchObject({ status: 'completed', currentRecipientId: null })
    expect(validateFeeReminderQueue(context.getFeeReminders_()[0]).recipients.map((recipient: { status: string }) => recipient.status)).toEqual(['sent', 'skipped', 'invalid'])
    expect(() => update(completed, 'resume')).toThrow('complete')
  })

  it('replays lost tracking responses exactly once and rejects reused update IDs with different data', () => {
    const { create, update, context, sheet } = setup()
    const queue = update(create(), 'resume')
    const request = { id: reminderId, revision: queue.revision, operationId: 'operation-retry-001', change: 'opened', recipientId: queue.announcement.currentRecipientId! }
    sheet.failAfterWrite = true
    expect(() => context.updateFeeReminder_(request, firstAdmin)).toThrow('Write response lost')
    const recovered = context.updateFeeReminder_(request, secondAdmin)
    expect(recovered.revision).toBe(2)
    expect(recovered.recipients[0].updatedBy).toBe(firstAdmin.email)
    expect(context.updateFeeReminder_(request, firstAdmin).revision).toBe(2)
    expect(() => context.updateFeeReminder_({ ...request, change: 'sent' }, firstAdmin)).toThrow('different data')
  })

  it('blocks reminders for cleared or changed fees and rejects paid/all-invalid selections without saving a queue', () => {
    const { create, update, students, context } = setup()
    const active = update(create(), 'resume')
    students[0].balance = 0
    expect(() => update(active, 'opened', active.announcement.currentRecipientId!)).toThrow('no pending fee balance')
    students[0].balance = 50
    expect(() => update(active, 'opened', active.announcement.currentRecipientId!)).toThrow('details changed')
    expect(() => context.createFeeReminder_({ id: 'reminder-paid-001', studentIds: ['26020104'] }, firstAdmin)).toThrow('no pending fee balance')
    expect(() => context.createFeeReminder_({ id: 'reminder-invalid-001', studentIds: ['26020105'] }, firstAdmin)).toThrow('valid mobile numbers')
    expect(context.getFeeReminders_()).toHaveLength(1)
  })

  it('keeps a large select-all queue in separate cells instead of exceeding the Google Sheets 50,000-character cell limit', () => {
    const students = Array.from({ length: 500 }, (_, index) => ({ ...initialStudents[0], studentId: String(26020000 + index), fullName: `Synthetic ${index}` }))
    const { create, sheet } = setup(students)
    const queue = create(students.map((student) => student.studentId))
    expect(queue.recipients).toHaveLength(500)
    expect(sheet.rows).toHaveLength(502)
    expect(sheet.rows.slice(1).reduce((total, row) => total + row[3].length, 0)).toBeGreaterThan(50_000)
    expect(Math.max(...sheet.rows.slice(1).map((row) => row[3].length))).toBeLessThan(50_000)
  })
})
