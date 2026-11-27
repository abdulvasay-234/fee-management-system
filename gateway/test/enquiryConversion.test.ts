import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

type ConversionResult = {
  success: boolean
  partial?: boolean
  studentIndexSynchronized?: boolean
  studentIndexWarning?: string
  recoveredAdmission?: boolean
  data: { enquiryId: string; admissionId: string; studentId: string }
  indexWarning?: string
  error?: string
}

type ConversionContext = vm.Context & {
  addStudent_: (payload: Record<string, unknown>) => { student: { studentId: string } }
  convertEnquiry_: (payload: { enquiryId: string; admission?: Record<string, unknown> }) => ConversionResult
  dispatchGatewayAction_: (action: string, parameters: object, identity: object) => ConversionResult
  getEnquiriesSourceSheet_: () => FakeSheet
  getEnquiriesSheet_: (propertyName: string) => FakeSheet
  getStudentDetails_: (parameters: { studentId: string }) => { student: Record<string, unknown>; payments: unknown[] }
  getStudentsIndexSheet_: () => FakeSheet
  findAdmissionSheetForCourse_: () => { sheet: FakeSheet }
  findCourseCodeByName_: (courseName: string) => { code: string; active: string }
  getCourseCodes_: () => Array<{ code: string; courseName: string; active: string }>
  readIndexedPayments_: () => unknown[]
  readIndexedStudents_: (filters: { studentId: string }) => Array<Record<string, unknown>>
  synchronizeStudentIndex_: (student: Record<string, unknown>) => void
  synchronizeEnquiryIndex_: (enquiry: Record<string, unknown>) => void
}

const TEST_ENQUIRY_ID = 'ENQ-000001'
const SECOND_TEST_ENQUIRY_ID = 'ENQ-000002'
const LEGACY_TEST_ENQUIRY_ID = 'ENQ-000009'
const FIRST_TEST_STUDENT_ID = '26020101'
const SECOND_TEST_STUDENT_ID = '26020102'
const OTHER_COURSE_TEST_STUDENT_ID = '26000101'
const TEST_PHONE_PRIMARY = '9000000001'
const TEST_PHONE_LEGACY = '9000000002'
const TEST_PHONE_EDITED = '9000000003'
const TEST_CONVERSION_PROPERTY_KEY = `LSA_ENQUIRY_CONVERSION_${TEST_ENQUIRY_ID}`
const TEST_CONVERSION_PROPERTY_CREATED_EVENT = `property:${TEST_CONVERSION_PROPERTY_KEY}`
const TEST_CONVERSION_PROPERTY_DELETED_EVENT = `property:delete:${TEST_CONVERSION_PROPERTY_KEY}`

const enquiryColumn = {
  courseInterestedIn: 8,
  otherProgramDetails: 9,
  status: 14,
  admissionId: 15,
  createdAt: 16,
  updatedAt: 17,
}

const admissionColumn = {
  otherProgramDetails: 28,
  enquiryId: 29,
  conversionFingerprint: 30,
}

function buildRow(headers: string[], values: Record<string, unknown>) {
  return headers.map((header) => values[header] ?? '')
}

function display(value: unknown): string {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return (value as Date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })
  }
  return String(value ?? '')
}

class FakeSheet {
  rows: unknown[][] = []
  failNextWrite = false
  failAfterNextWrite = false
  writes = 0

  constructor(readonly id: string, readonly headers: string[], readonly events: string[]) {}

  getLastColumn() { return this.headers.length }
  getLastRow() { return this.rows.length + 1 }
  getName() { return this.id }
  getParent() { return { getId: () => this.id } }

  getRange(row: number, column: number, height = 1, width = 1) {
    const range = {
      getValues: () => {
        return Array.from({ length: height }, (_, offset) => {
          const source = row + offset === 1 ? this.headers : this.rows[row + offset - 2] ?? []
          return Array.from({ length: width }, (_, index) => source[column + index - 1] ?? '')
        })
      },
      getDisplayValues() { return this.getValues().map((values) => values.map(display)) },
      getDisplayValue() { return this.getDisplayValues()[0][0] },
      getValue() { return this.getValues()[0][0] },
      setValues: (values: unknown[][]) => {
        if (row >= 2 && this.failNextWrite) {
          this.failNextWrite = false
          throw new Error('Enquiry source unavailable')
        }
        for (let index = 0; index < values.length; index++) {
          if (row + index === 1) {
            values[index].forEach((value, offset) => { this.headers[column + offset - 1] = String(value) })
            continue
          }
          const rowIndex = row + index - 2
          const current = this.rows[rowIndex] ?? Array(this.headers.length).fill('')
          values[index].forEach((value, offset) => { current[column + offset - 1] = value })
          this.rows[rowIndex] = current
          this.writes++
          this.events.push(`${this.id}:write`)
        }
        if (row >= 2 && this.failAfterNextWrite) {
          this.failAfterNextWrite = false
          throw new Error('Source write result unavailable')
        }
        return range
      },
      setValue(value: unknown) { return range.setValues([[value]]) },
      setNumberFormat() { return range },
    }
    return range
  }
}

function setup(status = 'New', courseInterestedIn = 'Data Science', otherProgramDetails = '') {
  const properties = new Map<string, string>()
  const events: string[] = []
  const originalCreatedAt = new Date('2026-09-30T21:55:45.830Z')
  let locked = false
  let lockAcquisitions = 0
  let studentIndexWrites = 0
  let enquiryIndexWrites = 0
  let studentIndexFailures = 0
  let indexedStudent: Record<string, unknown> | null = null
  let indexedPayments: Array<Record<string, unknown>> = []
  let indexedEnquiry: Record<string, unknown> | null = null
  let failLedgerOnce = false
  let failEnquiryIndexOnce = false

  const scriptProperties = {
    getProperty: (key: string) => properties.get(key) ?? null,
    setProperty(key: string, value: string) { properties.set(key, value); events.push(`property:${key}`) },
    deleteProperty(key: string) { properties.delete(key); events.push(`property:delete:${key}`) },
    getProperties() {
      if (failLedgerOnce) {
        failLedgerOnce = false
        throw new Error('Idempotency response unavailable')
      }
      return Object.fromEntries(properties)
    },
  }
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({
      waitLock() { expect(locked).toBe(false); locked = true; lockAcquisitions++; events.push('lock:acquired') },
      releaseLock() { expect(locked).toBe(true); locked = false; events.push('lock:released') },
    }) },
    PropertiesService: { getScriptProperties: () => scriptProperties },
    SpreadsheetApp: { openById: (id: string) => ({ getSheets: () => [id === 'admissions' ? admissionSheet : null] }) },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm: string, text: string) => createHash('sha256').update(text).digest(),
      base64EncodeWebSafe: (digest: Buffer) => digest.toString('base64url'),
      formatDate: (date: Date, _zone: string, pattern: string) => {
        const dateOnly = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return pattern === 'yyyy-MM-dd' ? dateOnly : `${dateOnly}T00:00:00`
      },
    },
    Logger: { log: () => {} },
  }) as ConversionContext
  for (const filename of ['Code.js', 'IndexApi.js', 'ReadApi.js']) {
    vm.runInContext(readFileSync(new URL(`../../apps-script/${filename}`, import.meta.url), 'utf8'), context, { filename })
  }
  const enquiryHeaders = vm.runInContext('CONFIG.ENQUIRY_HEADERS', context) as string[]
  const admissionHeaders = vm.runInContext('CONFIG.ADMISSION_HEADERS', context) as string[]
  const enquirySheet = new FakeSheet('enquiries', enquiryHeaders, events)
  const admissionSheet = new FakeSheet('admissions', [...admissionHeaders], events)
  const enquiryRow = buildRow(enquiryHeaders, {
    'Enquiry ID': TEST_ENQUIRY_ID,
    'Full Name': 'Test Student Alpha',
    'Mobile Number': TEST_PHONE_PRIMARY,
    Email: 'student.alpha@example.test',
    College: 'Synthetic Test College 01',
    'Education Level': 'B.Tech',
    Specialization: 'Computer Science',
    'Year of Graduation': '2026',
    'Course Interested In': courseInterestedIn,
    'Other Program Details': otherProgramDetails,
    Referral: 'Website',
    'Notes / Remarks': 'Controlled Enquiries API test record',
    'Consulted By': 'Test Staff',
    'Enquiry Date': '2026-10-01',
    Status: status,
    'Admission ID': '',
    'Created At': originalCreatedAt,
    'Updated At': originalCreatedAt,
  })
  enquirySheet.rows.push(enquiryRow)
  context.getEnquiriesSourceSheet_ = () => enquirySheet
  context.findAdmissionSheetForCourse_ = () => ({ sheet: admissionSheet })
  context.findCourseCodeByName_ = (courseName) => courseName === 'Other Programs'
    ? { code: '00', active: 'Yes' }
    : { code: '02', active: 'Yes' }
  context.getCourseCodes_ = () => [
    { code: '02', courseName: 'Data Science', active: 'Yes' },
    { code: '00', courseName: 'Other Programs', active: 'Yes' },
  ]
  context.readIndexedPayments_ = () => indexedPayments
  const actualSynchronizeStudentIndex = context.synchronizeStudentIndex_
  context.synchronizeStudentIndex_ = (student: Record<string, unknown>) => {
    expect(locked).toBe(true)
    if (studentIndexFailures > 0) { studentIndexFailures--; throw new Error('Students Index unavailable') }
    studentIndexWrites++
    indexedStudent = { ...student }
    events.push('students:index')
  }
  context.synchronizeEnquiryIndex_ = (enquiry) => {
    expect(locked).toBe(true)
    if (failEnquiryIndexOnce) { failEnquiryIndexOnce = false; throw new Error('Index unavailable') }
    expect(enquirySheet.rows[0][enquiryColumn.status]).toBe('Converted')
    enquiryIndexWrites++
    indexedEnquiry = { ...enquiry }
    events.push('enquiries:index')
  }

  const admission = {
    fullName: 'Test Student Alpha', mobileNumber: TEST_PHONE_PRIMARY, email: 'student.alpha@example.test',
    course: 'Data Science', batch: '01', admissionDate: '2026-10-01', startTime: '18:00', endTime: '20:00',
    totalCourseFee: 45000, discount: 1000, remarks: 'Existing admission remarks',
  }
  const convert = (details: Record<string, unknown> = admission) => context.dispatchGatewayAction_(
    'convert-enquiry', { enquiryId: TEST_ENQUIRY_ID, admission: details }, {},
  )
  return {
    admission, admissionSheet, context, convert, enquirySheet, events, originalCreatedAt, properties,
    useRealStudentIndex() {
      const sheet = new FakeSheet('students-index', [], events)
      context.getStudentsIndexSheet_ = () => sheet
      context.synchronizeStudentIndex_ = actualSynchronizeStudentIndex
      return sheet
    },
    get enquiryRecord() {
      return vm.runInContext(
        `findStructuredRecord_(getEnquiriesSourceSheet_(), CONFIG.ENQUIRY_HEADERS, "Enquiry ID", "${TEST_ENQUIRY_ID}", mapEnquiryRow_).record`,
        context,
      ) as Record<string, unknown>
    },
    get lockAcquisitions() { return lockAcquisitions },
    get studentIndexWrites() { return studentIndexWrites },
    get indexedStudent() { return indexedStudent },
    get enquiryIndexWrites() { return enquiryIndexWrites },
    get indexedEnquiry() { return indexedEnquiry },
    failLedger() { failLedgerOnce = true },
    failEnquiryIndex() { failEnquiryIndexOnce = true },
    failStudentIndex(attempts: number) { studentIndexFailures = attempts },
    setPayments(payments: Array<Record<string, unknown>>) { indexedPayments = payments },
  }
}

describe('Enquiry conversion safety', () => {
  it.each(['create', 'convert'])('persists a separate parents phone through source and real index readers: %s', (mode) => {
    const fixture = setup()
    const index = fixture.useRealStudentIndex()
    const details = { ...fixture.admission, fathersName: 'Test Parent', mothersName: '', parentsPhoneNumber: '09000 000001' }
    const result = mode === 'convert' ? fixture.convert(details) : fixture.context.addStudent_(details)
    const studentId = 'data' in result ? result.data.studentId : result.student.studentId
    expect(fixture.admissionSheet.rows[0][2]).toBe('Test Parent')
    expect(fixture.admissionSheet.rows[0][3]).toBe('')
    expect(fixture.admissionSheet.rows[0][fixture.admissionSheet.headers.indexOf('Parents Phone Number')]).toBe('09000000001')
    expect(index.rows[0][index.headers.indexOf('Parents Phone Number')]).toBe('09000000001')
    expect(fixture.context.getStudentDetails_({ studentId }).student).toMatchObject({
      fatherName: 'Test Parent', motherName: '', parentsPhoneNumber: '09000000001',
    })
  })

  it.each(['123', '9000000000abc'])('rejects invalid parent phones before writing an admission: %s', (parentsPhoneNumber) => {
    const fixture = setup()
    expect(() => fixture.context.addStudent_({ ...fixture.admission, parentsPhoneNumber })).toThrow('parents phone number')
    expect(fixture.admissionSheet.rows).toHaveLength(0)
    expect(fixture.studentIndexWrites).toBe(0)
  })

  it.each([undefined, 'Synthetic Optional College'])(
    'saves optional college in source and index sheets and preserves it on a status edit (%s)',
    (college) => {
      const fixture = setup()
      const headers = vm.runInContext('CONFIG.ENQUIRY_HEADERS', fixture.context) as string[]
      const source = new FakeSheet('enquiry-source', headers.filter((header) => header !== 'College'), fixture.events)
      const index = new FakeSheet('enquiry-index', headers.filter((header) => header !== 'College'), fixture.events)
      vm.runInContext(readFileSync(new URL('../../apps-script/IndexApi.js', import.meta.url), 'utf8'), fixture.context)
      const [sourceProperty, indexProperty] = vm.runInContext(
        '[CONFIG.ENQUIRIES_SOURCE_PROPERTY, CONFIG.ENQUIRIES_INDEX_PROPERTY]', fixture.context,
      ) as [string, string]
      fixture.context.getEnquiriesSheet_ = (propertyName) => {
        if (propertyName === sourceProperty) return source
        if (propertyName === indexProperty) return index
        throw new Error(`Unexpected enquiry sheet property: ${propertyName}`)
      }
      type SaveResult = { success: boolean; data: Record<string, unknown>; indexWarning?: string }
      const add = vm.runInContext('addEnquiry_', fixture.context) as (payload: Record<string, unknown>) => SaveResult
      const update = vm.runInContext('updateEnquiry_', fixture.context) as (payload: Record<string, unknown>) => SaveResult
      const read = vm.runInContext(
        '(function(sheet) { return readSheetRecords_(sheet, CONFIG.ENQUIRY_HEADERS, mapEnquiryRow_); })',
        fixture.context,
      ) as (sheet: FakeSheet) => Array<Record<string, unknown>>
      const saved = add({
        fullName: 'Synthetic College Test', mobileNumber: TEST_PHONE_PRIMARY,
        educationLevel: 'B.Tech', courseInterestedIn: 'Data Science', enquiryDate: '2026-11-27',
        referral: 'Website', consultedBy: 'Test Staff',
        ...(college === undefined ? {} : { college }),
      })
      expect(saved.success).toBe(true)
      expect(saved.indexWarning).toBeUndefined()
      const edited = update({ enquiryId: saved.data.enquiryId, status: 'Follow-up' })
      expect(edited.indexWarning).toBeUndefined()
      for (const sheet of [source, index]) {
        expect(sheet.headers.filter((header) => header === 'College')).toHaveLength(1)
        expect(read(sheet)).toMatchObject([{
          enquiryId: saved.data.enquiryId, college: college ?? '', status: 'Follow-up',
          referral: 'Website', consultedBy: 'Test Staff', enquiryDate: '2026-11-27',
        }])
        expect(sheet.rows[0][sheet.headers.indexOf('College')]).toBe(college ?? '')
      }
    },
  )

  it.each([
    { field: 'referral', value: 'Different Referral', label: 'Referral' },
    { field: 'referral', value: '', label: 'Referral' },
    { field: 'consultedBy', value: 'Different Consultant', label: 'Consulted By' },
    { field: 'consultedBy', value: '', label: 'Consulted By' },
    { field: 'enquiryDate', value: '2026-11-27', label: 'Enquiry Date' },
    { field: 'enquiryDate', value: '', label: 'Enquiry Date' },
  ])('rejects changing or clearing saved $field before writing', ({ field, value, label }) => {
    const fixture = setup()
    const update = vm.runInContext('updateEnquiry_', fixture.context) as (payload: Record<string, unknown>) => unknown
    expect(() => update({ enquiryId: TEST_ENQUIRY_ID, [field]: value })).toThrow(
      `${label} cannot be changed after it has been saved.`,
    )
    expect(fixture.enquirySheet.writes).toBe(0)
    expect(fixture.enquiryIndexWrites).toBe(0)
  })

  it('allows first-time attribution and unchanged saved values while preserving other edits', () => {
    const fixture = setup()
    const parse = vm.runInContext('enquiryFromPayload_', fixture.context) as (
      payload: Record<string, unknown>, existing: Record<string, unknown> | null,
    ) => Record<string, unknown>
    const saved = parse(
      { referral: 'Custom Referral', consultedBy: 'Custom Consultant' },
      { ...fixture.enquiryRecord, referral: '', consultedBy: '' },
    )
    const edited = parse({
      referral: ' Custom Referral ', consultedBy: 'Custom Consultant', enquiryDate: saved.enquiryDate,
      status: 'Follow-up', notes: 'Updated notes',
    }, saved)
    expect(edited).toMatchObject({
      referral: 'Custom Referral', consultedBy: 'Custom Consultant', enquiryDate: '2026-10-01',
      status: 'Follow-up', notes: 'Updated notes',
    })
    expect(() => parse({ consultedBy: 'Replacement Consultant' }, edited)).toThrow('Consulted By cannot be changed')
    expect(() => parse({ referral: '' }, edited)).toThrow('Referral cannot be changed')
    expect(parse({ ...fixture.enquiryRecord, referral: 'New Referral', consultedBy: 'New Consultant' }, null)).toMatchObject({
      referral: 'New Referral', consultedBy: 'New Consultant',
    })
  })

  it('migrates legacy enquiry headers by name and preserves historical row values', () => {
    const fixture = setup()
    const legacyHeaders = [
      'Enquiry ID', 'Full Name', 'Mobile Number', 'Email', 'College', 'Degree / Course',
      'Year of Graduation', 'Course Interested In', 'Referral', 'Notes / Remarks',
      'Consulted By', 'Enquiry Date', 'Status', 'Admission ID', 'Created At', 'Updated At',
    ]
    const legacySheet = new FakeSheet('legacy-enquiries', legacyHeaders, fixture.events)
    const historical = buildRow(legacyHeaders, {
      'Enquiry ID': LEGACY_TEST_ENQUIRY_ID, 'Full Name': 'Legacy Test Student', 'Mobile Number': TEST_PHONE_LEGACY,
      'Degree / Course': 'B.Tech', 'Year of Graduation': '2022', 'Course Interested In': 'Data Science',
      'Enquiry Date': '2026-09-01', Status: 'Follow-up', 'Created At': fixture.originalCreatedAt,
      'Updated At': fixture.originalCreatedAt,
    })
    legacySheet.rows.push(historical)
    const migrate = vm.runInContext('ensureEnquirySheetHeaders_', fixture.context) as (sheet: FakeSheet) => unknown
    const find = vm.runInContext('findStructuredRecord_', fixture.context) as (
      sheet: FakeSheet,
      headers: string[],
      keyHeader: string,
      keyValue: string,
      mapper: (...args: unknown[]) => unknown,
    ) => { record: Record<string, unknown> } | null
    const mapper = vm.runInContext('mapEnquiryRow_', fixture.context) as (...args: unknown[]) => unknown
    const headers = vm.runInContext('CONFIG.ENQUIRY_HEADERS', fixture.context) as string[]
    migrate(legacySheet)
    const migrated = find(legacySheet, headers, 'Enquiry ID', LEGACY_TEST_ENQUIRY_ID, mapper)
    expect(legacySheet.headers[5]).toBe('Education Level')
    expect(legacySheet.headers).toContain('Specialization')
    expect(legacySheet.headers).toContain('Other Program Details')
    expect(legacySheet.rows[0].slice(0, historical.length)).toEqual(historical)
    expect(migrated?.record).toMatchObject({ educationLevel: 'B.Tech', specialization: '', otherProgramDetails: '' })
  })

  it('stores Other Programs details in dedicated Admission and Students Index fields', () => {
    const fixture = setup('Follow-up', 'Other Programs', 'AI for Business')
    const result = fixture.convert({ ...fixture.admission, course: 'Other Programs', degreeCourse: 'B.Tech - Computer Science', otherProgramDetails: 'AI for Business' })
    expect(result.data.studentId).toBe(OTHER_COURSE_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.admissionSheet.rows[0][12]).toBe('Other Programs')
    expect(fixture.admissionSheet.rows[0][28]).toBe('AI for Business')
    expect(fixture.admissionSheet.rows[0][27]).toBe('B.Tech - Computer Science')
    expect(fixture.admissionSheet.rows[0][23]).toBe('Existing admission remarks')
    expect(fixture.indexedStudent).toMatchObject({ otherProgramDetails: 'AI for Business', remarks: 'Existing admission remarks' })
    expect(fixture.enquirySheet.rows[0][enquiryColumn.otherProgramDetails]).toBe('AI for Business')
    expect(fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID }).data.studentId).toBe(OTHER_COURSE_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('returns confirmation-only fields from the authoritative Admission source via the existing student GET', () => {
    const fixture = setup('Follow-up', 'Other Programs', 'AI for Business')
    const converted = fixture.convert({
      ...fixture.admission,
      course: 'Other Programs',
      degreeCourse: 'B.Tech - CSE',
      collegeName: 'Synthetic Test College 02',
      yearOfPassing: '2026',
      otherProgramDetails: 'AI for Business',
    })
    fixture.context.readIndexedStudents_ = () => [fixture.indexedStudent ?? {}]
    const details = fixture.context.getStudentDetails_({ studentId: converted.data.studentId })
    expect(details.student).toMatchObject({
      studentId: converted.data.studentId,
      collegeName: 'Synthetic Test College 02',
      degreeCourse: 'B.Tech - CSE',
      yearOfPassing: '2026',
      otherProgramDetails: 'AI for Business',
    })
    expect(details.payments).toEqual([])
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('creates and links one admission while preserving the source metadata', () => {
    const fixture = setup()
    expect(fixture.enquiryRecord).toMatchObject({ educationLevel: 'B.Tech', specialization: 'Computer Science', admissionId: '' })
    const result = fixture.convert()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ enquiryId: TEST_ENQUIRY_ID, admissionId: FIRST_TEST_STUDENT_ID, studentId: FIRST_TEST_STUDENT_ID })
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.admissionSheet.rows[0][23]).toBe('Existing admission remarks')
    expect(fixture.admissionSheet.headers.slice(-3)).toEqual(['Enquiry ID', 'Conversion Fingerprint', 'Parents Phone Number'])
    expect(fixture.admissionSheet.rows[0][fixture.admissionSheet.headers.indexOf('Enquiry ID')]).toBe(TEST_ENQUIRY_ID)
    expect(fixture.admissionSheet.rows[0][admissionColumn.conversionFingerprint]).toBeTruthy()
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('Converted')
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.createdAt]).toBe(fixture.originalCreatedAt)
    expect((fixture.enquirySheet.rows[0][enquiryColumn.updatedAt] as Date).getTime()).toBeGreaterThan(fixture.originalCreatedAt.getTime())
    expect(fixture.indexedEnquiry).toMatchObject({ enquiryId: TEST_ENQUIRY_ID, admissionId: FIRST_TEST_STUDENT_ID, status: 'Converted' })
    expect(fixture.indexedEnquiry?.createdAt).toBe(fixture.enquirySheet.rows[0][enquiryColumn.createdAt])
    expect(fixture.indexedEnquiry?.updatedAt).toBe(fixture.enquirySheet.rows[0][enquiryColumn.updatedAt])
    expect(fixture.events.indexOf('enquiries:write')).toBeLessThan(fixture.events.indexOf('enquiries:index'))
    expect(fixture.events.indexOf(TEST_CONVERSION_PROPERTY_CREATED_EVENT)).toBeLessThan(fixture.events.indexOf('admissions:write'))
    expect(fixture.events.indexOf('lock:acquired')).toBeLessThan(fixture.events.indexOf(TEST_CONVERSION_PROPERTY_CREATED_EVENT))
    expect(fixture.events.lastIndexOf('students:index')).toBeLessThan(fixture.events.indexOf('enquiries:write'))
    expect(fixture.events.indexOf('enquiries:index')).toBeLessThan(fixture.events.indexOf(TEST_CONVERSION_PROPERTY_DELETED_EVENT))
    expect(fixture.events.indexOf(TEST_CONVERSION_PROPERTY_DELETED_EVENT)).toBeLessThan(fixture.events.indexOf('lock:released'))
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(false)
    expect(fixture.studentIndexWrites).toBe(2)
    expect(fixture.enquiryIndexWrites).toBe(1)
    expect(fixture.lockAcquisitions).toBe(1)
  })

  it('returns the existing admission without a second write, even without form data', () => {
    const fixture = setup()
    fixture.convert()
    const result = fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID })
    expect(result.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.admissionSheet.writes).toBe(2)
    expect(fixture.enquirySheet.writes).toBe(1)
  })

  it('returns a linked admission after editable Enquiry identity and course fields change', () => {
    const fixture = setup()
    fixture.convert()
    fixture.enquirySheet.rows[0][1] = 'Updated Test Student'
    fixture.enquirySheet.rows[0][2] = TEST_PHONE_EDITED
    fixture.enquirySheet.rows[0][enquiryColumn.courseInterestedIn] = 'Another Course'
    const result = fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID })
    expect(result.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][1]).toBe('Updated Test Student')
  })

  it('preserves the original add-student lock, remarks and index behavior', () => {
    const fixture = setup()
    expect(fixture.context.addStudent_(fixture.admission).student.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.lockAcquisitions).toBe(1)
    expect(fixture.admissionSheet.rows[0][23]).toBe('Existing admission remarks')
    expect(fixture.studentIndexWrites).toBe(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(false)
  })

  it('recovers a conversion-key admission without an enquiry link instead of creating another with changed form data', () => {
    const fixture = setup()
    fixture.context.addStudent_({ ...fixture.admission, idempotencyKey: `convert-enquiry:${TEST_ENQUIRY_ID}` })
    const before = [...fixture.admissionSheet.rows[0]]
    const result = fixture.convert({ ...fixture.admission, batch: '08', totalCourseFee: 99000, degreeCourse: 'B.E. - CSE' })
    expect(result).toMatchObject({ success: true, recoveredAdmission: true, data: { studentId: FIRST_TEST_STUDENT_ID } })
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    for (let column = 0; column < before.length; column++) {
      if (column !== admissionColumn.enquiryId && column !== admissionColumn.conversionFingerprint) {
        expect(fixture.admissionSheet.rows[0][column]).toEqual(before[column])
      }
    }
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('Converted')
    expect(fixture.indexedStudent).toMatchObject({ studentId: FIRST_TEST_STUDENT_ID, batch: '01', totalCourseFee: 45000, finalFee: 44000 })
    expect(fixture.indexedEnquiry?.admissionId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID }).data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('restores an already-linked legacy admission whose source conversion metadata is missing', () => {
    const fixture = setup()
    fixture.context.addStudent_({ ...fixture.admission, idempotencyKey: `convert-enquiry:${TEST_ENQUIRY_ID}` })
    fixture.enquirySheet.rows[0][enquiryColumn.admissionId] = FIRST_TEST_STUDENT_ID
    fixture.enquirySheet.rows[0][enquiryColumn.status] = 'Converted'
    const result = fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID })
    expect(result.recoveredAdmission).toBe(true)
    expect(result.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows[0][fixture.admissionSheet.headers.indexOf('Enquiry ID')]).toBe(TEST_ENQUIRY_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('recovers a metadata write that committed but reported failure without appending an admission', () => {
    const fixture = setup()
    fixture.context.addStudent_({ ...fixture.admission, idempotencyKey: `convert-enquiry:${TEST_ENQUIRY_ID}` })
    fixture.admissionSheet.failAfterNextWrite = true
    expect(() => fixture.convert()).toThrow()
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('Converted')
  })

  it.each(['missing', 'wrong-phone', 'different-enquiry'] as const)('does not bypass a %s source admission for a saved conversion key', (problem) => {
    const fixture = setup()
    fixture.context.addStudent_({ ...fixture.admission, idempotencyKey: `convert-enquiry:${TEST_ENQUIRY_ID}` })
    if (problem === 'missing') fixture.admissionSheet.rows = []
    if (problem === 'wrong-phone') fixture.admissionSheet.rows[0][fixture.admissionSheet.headers.indexOf('Mobile Number')] = TEST_PHONE_EDITED
    if (problem === 'different-enquiry') {
      fixture.admissionSheet.headers.push('Other Program Details', 'Enquiry ID', 'Conversion Fingerprint')
      fixture.admissionSheet.rows[0][fixture.admissionSheet.headers.indexOf('Enquiry ID')] = SECOND_TEST_ENQUIRY_ID
    }
    const before = fixture.admissionSheet.rows.map((row) => [...row])
    expect(() => fixture.convert()).toThrow(/saved conversion/)
    expect(fixture.admissionSheet.rows).toEqual(before)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
  })

  it('retains an unreadable conversion key instead of clearing it and creating a duplicate admission', () => {
    const fixture = setup()
    const key = `LSA_IDEMPOTENCY_convert-enquiry:${TEST_ENQUIRY_ID}`
    fixture.properties.set(key, '{broken')
    expect(() => fixture.convert()).toThrow(/unreadable/)
    expect(fixture.properties.get(key)).toBe('{broken')
    expect(fixture.admissionSheet.rows).toHaveLength(0)
  })

  it('saves incrementing YYCCBBSS admission IDs and starts a separate serial for a new batch or year', () => {
    const fixture = setup()
    const inputs = [
      { batch: '01', admissionDate: '2026-10-01' },
      { batch: '01', admissionDate: '2026-11-01' },
      { batch: '01', admissionDate: '2026-11-27' },
      { batch: '02', admissionDate: '2026-11-27' },
      { batch: '01', admissionDate: '2027-01-01' },
    ]
    const ids = inputs.map((details) => fixture.context.addStudent_({ ...fixture.admission, ...details }).student.studentId)
    expect(ids).toEqual(['26020101', '26020102', '26020103', '26020201', '27020101'])
    expect(fixture.admissionSheet.rows.map((row) => row[0])).toEqual(ids)
    expect(fixture.lockAcquisitions).toBe(5)
    expect(fixture.studentIndexWrites).toBe(5)
  })

  it('allows normal admission on a legacy sheet without conversion or education headers', () => {
    const fixture = setup()
    fixture.admissionSheet.headers.splice(25)
    const historical = Array(fixture.admissionSheet.headers.length).fill('')
    historical[0] = FIRST_TEST_STUDENT_ID
    historical[22] = 44000
    fixture.admissionSheet.rows.push(historical)
    fixture.context.addStudent_(fixture.admission)
    expect(fixture.admissionSheet.headers).toHaveLength(29)
    expect(fixture.admissionSheet.rows[0]).toEqual(historical)
    expect(fixture.admissionSheet.rows[1][0]).toBe(SECOND_TEST_STUDENT_ID)
  })

  it('extends only headers on first conversion and leaves existing rows with blank metadata', () => {
    const fixture = setup()
    const historical = Array(fixture.admissionSheet.headers.length).fill('')
    historical[0] = FIRST_TEST_STUDENT_ID
    historical[22] = 44000
    fixture.admissionSheet.rows.push(historical)
    const original = [...historical]
    const converted = fixture.convert()
    expect(converted.data.studentId).toBe(SECOND_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.headers.slice(-3)).toEqual(['Enquiry ID', 'Conversion Fingerprint', 'Parents Phone Number'])
    expect(fixture.admissionSheet.rows[0]).toEqual(original)
    expect(fixture.admissionSheet.rows[0][admissionColumn.otherProgramDetails]).toBeUndefined()
    expect(fixture.admissionSheet.rows[1][admissionColumn.otherProgramDetails]).toBe('')
    expect(fixture.admissionSheet.rows[1][admissionColumn.enquiryId]).toBe(TEST_ENQUIRY_ID)
    expect(fixture.admissionSheet.rows[1][admissionColumn.conversionFingerprint]).toBeTruthy()
  })

  it('writes blank internal metadata for normal admissions on a converted course sheet', () => {
    const fixture = setup()
    fixture.convert()
    const first = [...fixture.admissionSheet.rows[0]]
    fixture.context.addStudent_(fixture.admission)
    expect(fixture.admissionSheet.rows[0]).toEqual(first)
    expect(fixture.admissionSheet.rows[1][0]).toBe(SECOND_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows[1][admissionColumn.enquiryId]).toBe('')
    expect(fixture.admissionSheet.rows[1][admissionColumn.conversionFingerprint]).toBe('')
  })

  it('preserves user Remarks byte-for-byte during conversion but retains normal admission trimming', () => {
    const conversion = setup()
    conversion.convert({ ...conversion.admission, remarks: '  Original remarks  ' })
    expect(conversion.admissionSheet.rows[0][23]).toBe('  Original remarks  ')
    expect(conversion.admissionSheet.rows[0][admissionColumn.enquiryId]).toBe(TEST_ENQUIRY_ID)

    const regular = setup()
    regular.context.addStudent_({ ...regular.admission, remarks: '  Original remarks  ' })
    expect(regular.admissionSheet.rows[0][23]).toBe('Original remarks')
  })

  it('recovers a committed admission when idempotency result writing fails', () => {
    const fixture = setup()
    fixture.failLedger()
    const result = fixture.convert()
    expect(result.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('recovers an admission committed before its write acknowledgement', () => {
    const fixture = setup()
    fixture.admissionSheet.failAfterNextWrite = true
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('surfaces a transient Students Index warning even when source-based repair succeeds', () => {
    const fixture = setup()
    fixture.failStudentIndex(1)
    const result = fixture.convert()
    expect(result.studentIndexSynchronized).toBe(true)
    expect(result.studentIndexWarning).toMatch(/Students Index synchronization failed/)
    expect(fixture.studentIndexWrites).toBe(1)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('keeps existing payment enrichment when rebuilding Students Index from admission source', () => {
    const fixture = setup()
    fixture.setPayments([{
      studentId: FIRST_TEST_STUDENT_ID, receiptId: 'FEE-001', paymentDate: '2026-10-01', amountPaid: 5000, totalPaid: 5000, balance: 39000,
    }])
    fixture.convert()
    expect(fixture.indexedStudent).toMatchObject({
      studentId: FIRST_TEST_STUDENT_ID, finalFee: 44000, totalPaid: 5000, balance: 39000,
      paymentCount: 1, latestReceiptId: 'FEE-001',
    })
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('reports an unrepaired Students Index, then repairs it from admission source without appending', () => {
    const fixture = setup()
    fixture.failStudentIndex(2)
    const partial = fixture.convert()
    expect(partial).toMatchObject({ success: true, partial: true, studentIndexSynchronized: false })
    expect(partial.indexWarning).toMatch(/Students Index synchronization failed/)
    expect(partial.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    const recovered = fixture.convert()
    expect(recovered.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(recovered.studentIndexSynchronized).toBe(true)
    expect(fixture.studentIndexWrites).toBe(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('Converted')
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('keeps the enquiry unchanged when admission append fails and safely retries the reservation', () => {
    const fixture = setup()
    fixture.admissionSheet.failNextWrite = true
    expect(() => fixture.convert()).toThrow(/source unavailable/)
    expect(fixture.admissionSheet.rows).toHaveLength(0)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
    expect(fixture.enquirySheet.rows[0][enquiryColumn.createdAt]).toBe(fixture.originalCreatedAt)
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(true)
    const reserved = JSON.parse(fixture.properties.get(TEST_CONVERSION_PROPERTY_KEY) ?? '')
    expect(reserved).toMatchObject({
      enquiryId: TEST_ENQUIRY_ID, studentId: FIRST_TEST_STUDENT_ID, sheetId: 'admissions', state: 'reserved',
    })
    expect(() => fixture.convert({ ...fixture.admission, totalCourseFee: 46000 })).toThrow(/details differ/)
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(reserved.createdAt).toBeTruthy()
  })

  it('retains the original reservation audit timestamp through repeated failed appends', () => {
    const fixture = setup()
    fixture.admissionSheet.failNextWrite = true
    expect(() => fixture.convert()).toThrow(/source unavailable/)
    const initial = JSON.parse(fixture.properties.get(TEST_CONVERSION_PROPERTY_KEY) ?? '')
    fixture.admissionSheet.failNextWrite = true
    expect(() => fixture.convert()).toThrow(/source unavailable/)
    const retried = JSON.parse(fixture.properties.get(TEST_CONVERSION_PROPERTY_KEY) ?? '')
    expect(retried.createdAt).toBe(initial.createdAt)
    expect(retried.studentId).toBe(initial.studentId)
    expect(retried.state).toBe('reserved')
    expect(fixture.admissionSheet.rows).toHaveLength(0)
    expect(fixture.convert().data.studentId).toBe(initial.studentId)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('recovers a source-link failure on retry without creating another admission', () => {
    const fixture = setup()
    fixture.enquirySheet.failNextWrite = true
    const partial = fixture.convert()
    expect(partial.partial).toBe(true)
    expect(partial.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    const recovered = fixture.convert()
    expect(recovered.partial).toBeUndefined()
    expect(recovered.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.createdAt]).toBe(fixture.originalCreatedAt)
    expect(fixture.enquiryIndexWrites).toBe(1)
  })

  it('recovers an unlinked reservation after Enquiry name, mobile, and course are edited', () => {
    const fixture = setup()
    fixture.enquirySheet.failNextWrite = true
    expect(fixture.convert().partial).toBe(true)
    fixture.enquirySheet.rows[0][1] = 'Edited Test Student'
    fixture.enquirySheet.rows[0][2] = TEST_PHONE_EDITED
    fixture.enquirySheet.rows[0][enquiryColumn.courseInterestedIn] = 'Another Course'
    const recovered = fixture.convert()
    expect(recovered.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][1]).toBe('Edited Test Student')
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('recovers Converted without an ID only with a valid reservation and admission row', () => {
    const fixture = setup()
    fixture.enquirySheet.failNextWrite = true
    expect(fixture.convert().partial).toBe(true)
    fixture.enquirySheet.rows[0][enquiryColumn.status] = 'Converted'
    const recovered = fixture.convert()
    expect(recovered.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('does not recreate admission if the enquiry link committed but reported an error', () => {
    const fixture = setup()
    fixture.enquirySheet.failAfterNextWrite = true
    expect(fixture.convert().partial).toBe(true)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    const updatedAt = fixture.enquirySheet.rows[0][enquiryColumn.updatedAt]
    expect(fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID }).data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(false)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.updatedAt]).toBe(updatedAt)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.createdAt]).toBe(fixture.originalCreatedAt)
  })

  it('keeps source success when Enquiries Index synchronization fails, then resynchronizes on retry', () => {
    const fixture = setup()
    fixture.failEnquiryIndex()
    expect(fixture.convert().indexWarning).toMatch(/Index synchronization failed/)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.admissionId]).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquiryIndexWrites).toBe(0)
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(true)
    expect(fixture.convert().data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.enquiryIndexWrites).toBe(1)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.properties.has(TEST_CONVERSION_PROPERTY_KEY)).toBe(false)
  })

  it('returns the existing ID if an already-linked Students Index repair fails', () => {
    const fixture = setup()
    fixture.convert()
    fixture.failStudentIndex(1)
    const result = fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID })
    expect(result).toMatchObject({ partial: true, studentIndexSynchronized: false })
    expect(result.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID }).studentIndexSynchronized).toBe(true)
  })

  it('fails closed on malformed or conflicting reservation metadata', () => {
    const malformed = setup()
    malformed.properties.set(TEST_CONVERSION_PROPERTY_KEY, '{broken')
    expect(() => malformed.convert()).toThrow(/reservation is invalid/)
    expect(malformed.admissionSheet.rows).toHaveLength(0)

    const empty = setup()
    empty.properties.set(TEST_CONVERSION_PROPERTY_KEY, 'null')
    expect(() => empty.convert()).toThrow(/reservation is invalid/)
    expect(empty.admissionSheet.rows).toHaveLength(0)

    const inconsistent = setup()
    inconsistent.properties.set(TEST_CONVERSION_PROPERTY_KEY, JSON.stringify({
      enquiryId: SECOND_TEST_ENQUIRY_ID, studentId: FIRST_TEST_STUDENT_ID, sheetId: 'admissions', fingerprint: 'wrong',
      createdAt: new Date().toISOString(), state: 'reserved',
    }))
    expect(() => inconsistent.convert()).toThrow(/reservation is incomplete or inconsistent/)
    expect(inconsistent.admissionSheet.rows).toHaveLength(0)

    const invalidTimestamp = setup()
    invalidTimestamp.properties.set(TEST_CONVERSION_PROPERTY_KEY, JSON.stringify({
      enquiryId: TEST_ENQUIRY_ID, studentId: FIRST_TEST_STUDENT_ID, sheetId: 'admissions', fingerprint: 'wrong',
      createdAt: 'not-a-date', state: 'reserved',
    }))
    expect(() => invalidTimestamp.convert()).toThrow(/reservation is incomplete or inconsistent/)
    expect(invalidTimestamp.admissionSheet.rows).toHaveLength(0)
  })

  it('fails closed when a linked admission conflicts with a lingering reservation', () => {
    const fixture = setup()
    fixture.convert()
    fixture.properties.set(TEST_CONVERSION_PROPERTY_KEY, JSON.stringify({
      enquiryId: TEST_ENQUIRY_ID, studentId: SECOND_TEST_STUDENT_ID, sheetId: 'admissions', fingerprint: 'wrong',
      createdAt: new Date().toISOString(), state: 'reserved',
    }))
    expect(() => fixture.context.convertEnquiry_({ enquiryId: TEST_ENQUIRY_ID })).toThrow(/conflicts with its conversion reservation/)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
  })

  it('serializes conversions for different enquiries and assigns different student IDs', () => {
    const fixture = setup()
    const second = [...fixture.enquirySheet.rows[0]]
    second[0] = SECOND_TEST_ENQUIRY_ID
    fixture.enquirySheet.rows.push(second)
    const first = fixture.convert()
    const next = fixture.context.convertEnquiry_({ enquiryId: SECOND_TEST_ENQUIRY_ID, admission: fixture.admission })
    expect(first.data.studentId).toBe(FIRST_TEST_STUDENT_ID)
    expect(next.data.studentId).toBe(SECOND_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(2)
    expect(fixture.lockAcquisitions).toBe(2)
    expect(fixture.enquirySheet.rows[1][enquiryColumn.admissionId]).toBe(SECOND_TEST_STUDENT_ID)
  })

  it('keeps a single admission when two same-enquiry requests are scheduled together', async () => {
    const fixture = setup()
    const results = await Promise.all([
      Promise.resolve().then(() => fixture.convert()),
      Promise.resolve().then(() => fixture.convert()),
    ])
    expect(results.map((result) => result.data.studentId)).toEqual([FIRST_TEST_STUDENT_ID, FIRST_TEST_STUDENT_ID])
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.lockAcquisitions).toBe(2)
  })

  it('assigns distinct admissions when two different-enquiry requests are scheduled together', async () => {
    const fixture = setup()
    const second = [...fixture.enquirySheet.rows[0]]
    second[0] = SECOND_TEST_ENQUIRY_ID
    fixture.enquirySheet.rows.push(second)
    const results = await Promise.all([
      Promise.resolve().then(() => fixture.convert()),
      Promise.resolve().then(() => fixture.context.convertEnquiry_({ enquiryId: SECOND_TEST_ENQUIRY_ID, admission: fixture.admission })),
    ])
    expect(results.map((result) => result.data.studentId)).toEqual([FIRST_TEST_STUDENT_ID, SECOND_TEST_STUDENT_ID])
    expect(fixture.admissionSheet.rows).toHaveLength(2)
    expect(fixture.lockAcquisitions).toBe(2)
  })

  it('ignores a historical admission whose Remarks contain the old marker', () => {
    const fixture = setup()
    fixture.admissionSheet.rows.push(Array(fixture.admissionSheet.headers.length).fill(''))
    const row = fixture.admissionSheet.rows[0]
    row[0] = FIRST_TEST_STUDENT_ID
    row[1] = 'Test Student Alpha'
    row[6] = TEST_PHONE_PRIMARY
    row[13] = 'Data Science'
    row[23] = '[Enquiry:ENQ-000001]'
    const result = fixture.convert()
    expect(result.data.studentId).toBe(SECOND_TEST_STUDENT_ID)
    expect(fixture.admissionSheet.rows).toHaveLength(2)
    expect(row[23]).toBe('[Enquiry:ENQ-000001]')
    expect(fixture.admissionSheet.rows[1][23]).toBe('Existing admission remarks')
  })

  it('rejects a conflicting internal association without creating another admission', () => {
    const fixture = setup()
    fixture.admissionSheet.headers.push('Other Program Details', 'Enquiry ID', 'Conversion Fingerprint')
    const row = Array(fixture.admissionSheet.headers.length).fill('')
    row[0] = FIRST_TEST_STUDENT_ID
    row[1] = 'Another Test Student'
    row[6] = TEST_PHONE_PRIMARY
    row[13] = 'Data Science'
    row[admissionColumn.enquiryId] = TEST_ENQUIRY_ID
    row[admissionColumn.conversionFingerprint] = 'other-fingerprint'
    fixture.admissionSheet.rows.push(row)
    expect(() => fixture.convert()).toThrow(/association does not match/)
    expect(fixture.admissionSheet.rows).toHaveLength(1)
    expect(fixture.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
  })

  it('rejects invalid IDs, admission data, Not Interested, and inconsistent Converted enquiries', () => {
    const invalidId = setup()
    expect(() => invalidId.context.convertEnquiry_({ enquiryId: 'bad', admission: invalidId.admission })).toThrow(/valid Enquiry ID/)
    expect(invalidId.lockAcquisitions).toBe(0)

    const invalidAdmission = setup()
    expect(() => invalidAdmission.convert({ ...invalidAdmission.admission, discount: 99999 })).toThrow(/Discount cannot be greater/)
    expect(invalidAdmission.admissionSheet.rows).toHaveLength(0)
    expect(invalidAdmission.enquirySheet.rows[0][enquiryColumn.status]).toBe('New')
    expect(invalidAdmission.properties.size).toBe(0)

    const notInterested = setup('Not Interested')
    expect(() => notInterested.convert()).toThrow(/cannot be converted/)
    expect(notInterested.admissionSheet.rows).toHaveLength(0)

    const missingIdentity = setup()
    missingIdentity.enquirySheet.rows[0][1] = ''
    expect(() => missingIdentity.convert()).toThrow(/missing required admission details/)
    expect(missingIdentity.admissionSheet.rows).toHaveLength(0)

    const convertedWithoutId = setup('Converted')
    expect(() => convertedWithoutId.convert()).toThrow(/no recoverable admission association/)
    expect(convertedWithoutId.admissionSheet.rows).toHaveLength(0)
  })
})