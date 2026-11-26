import type { StudentRecord } from '../../services/api'
import type { CourseCode } from '../courseCodes/courseCodeTypes'

export interface StudentFilters {
  query: string
  year: string
}

export function courseKey(name: string) {
  return name.trim().toLowerCase()
}

function admissionDateParts(value: string) {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (iso || us) {
    const year = Number(iso ? iso[1] : us?.[3])
    const month = Number(iso ? iso[2] : us?.[1])
    const day = Number(iso ? iso[3] : us?.[2])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return { year, month, day }
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null
  const date = new Date(text)
  if (!Number.isFinite(date.getTime())) return null
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function summarizeAdmissions(students: StudentRecord[], today = new Date()) {
  const ids = new Set<string>()
  const courses = new Map<string, { name: string; count: number }>()
  let admissionsToday = 0
  let admissionsThisMonth = 0
  let invalidDates = 0

  students.forEach((student) => {
    const id = student.studentId.trim()
    if (!id || ids.has(id)) throw new Error('Admissions contain a missing or duplicate admission ID. Please reconcile the records.')
    ids.add(id)
    const key = courseKey(student.course)
    if (!key) throw new Error(`Admission ${id} has no course. Please reconcile the record.`)
    const course = courses.get(key)
    if (course) course.count++
    else courses.set(key, { name: student.course.trim(), count: 1 })
    const date = admissionDateParts(student.admissionDate)
    if (!date) {
      invalidDates++
      return
    }
    if (date.year === today.getFullYear() && date.month === today.getMonth() + 1) {
      admissionsThisMonth++
      if (date.day === today.getDate()) admissionsToday++
    }
  })

  return {
    totalStudents: ids.size,
    admissionsToday,
    admissionsThisMonth,
    invalidDates,
    courses: Array.from(courses.values()).sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export function courseNavigation(courses: CourseCode[], students: StudentRecord[]) {
  const options = new Map<string, { name: string; active: boolean | null }>()
  courses.forEach((course) => {
    if (course.active) options.set(courseKey(course.name), { name: course.name, active: true })
  })
  students.forEach((student) => {
    const key = courseKey(student.course)
    if (!options.has(key)) {
      const catalogCourse = courses.find((course) => courseKey(course.name) === key)
      options.set(key, { name: student.course.trim(), active: catalogCourse ? catalogCourse.active : null })
    }
  })
  return Array.from(options.values()).sort((left, right) => left.name.localeCompare(right.name))
}

export function batchNavigation(students: StudentRecord[], course: string) {
  const batches = new Map<string, number>()
  if (!course) return []
  students.forEach((student) => {
    const batch = student.batch.trim()
    if (courseKey(student.course) === courseKey(course) && batch) {
      batches.set(batch, (batches.get(batch) ?? 0) + 1)
    }
  })
  return Array.from(batches, ([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
}

export function filterAdmissions(students: StudentRecord[], filters: StudentFilters, course: string, batch: string) {
  const query = filters.query.trim().toLowerCase()
  return students.filter((student) =>
    (!query || [student.studentId, student.fullName, student.mobileNumber, student.email]
      .some((value) => value.toLowerCase().includes(query)))
    && (!course || courseKey(student.course) === courseKey(course))
    && (!batch || student.batch.trim() === batch)
    && (!filters.year || student.enrollmentYear === filters.year)
  )
}
