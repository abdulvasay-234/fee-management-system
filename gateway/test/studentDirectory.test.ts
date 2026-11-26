import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../../src/features/students/studentDirectoryUtils.ts', import.meta.url))
const { summarizeAdmissions, courseNavigation, batchNavigation, filterAdmissions } = await import(modulePath)

const students = [
  { studentId: 'A001', fullName: 'Anita Rao', mobileNumber: '9876543210', email: 'anita@example.test', course: 'Data Science', batch: '01', enrollmentYear: '2025', admissionDate: '2026-02-28' },
  { studentId: 'A002', fullName: 'Bina Shah', mobileNumber: '9876543211', email: 'bina@example.test', course: 'data science', batch: '02', enrollmentYear: '2026', admissionDate: '2/1/2026' },
  { studentId: 'A003', fullName: 'Chitra Roy', mobileNumber: '9876543212', email: 'chitra@example.test', course: 'Legacy Course', batch: '01', enrollmentYear: '2025', admissionDate: '2025-02-28' },
]

describe('admissions directory', () => {
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
