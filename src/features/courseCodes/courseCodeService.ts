import type { CourseCode, CourseCodeInput, CourseCodeType } from './courseCodeTypes'
import {
  addCourseCode as addCourseCodeRequest,
  deleteCourseCode as deleteCourseCodeRequest,
  fetchCourseCodes,
  updateCourseCode as updateCourseCodeRequest,
} from '../../services/api'

export type CourseCodeDataSource = 'uninitialized' | 'live' | 'unavailable'

export interface CourseCodeServiceStatus {
  source: CourseCodeDataSource
  error: Error | null
}

interface CourseCodeApiRecord {
  code: unknown
  courseName: unknown
  type: unknown
  active: unknown
}

interface CourseCodeApiResponse {
  success: unknown
  data: unknown
}

let courseCodes: CourseCode[] = []
let sourceStatus: CourseCodeServiceStatus = { source: 'uninitialized', error: null }
let loadPromise: Promise<CourseCode[]> | null = null
let highestIssuedRegularCode = getHighestRegularCode(courseCodes)
const listeners = new Set<() => void>()

function sortCourseCodes(courses: CourseCode[]) {
  return [...courses].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'Regular' ? -1 : 1
    return left.code.localeCompare(right.code)
  })
}

function getHighestRegularCode(courses: CourseCode[]) {
  return courses
    .filter((course) => course.type === 'Regular' && /^\d{2}$/.test(course.code))
    .reduce((highest, course) => Math.max(highest, Number(course.code)), 0)
}

function notifySubscribers() {
  listeners.forEach((listener) => listener())
}

function normalizeType(value: unknown): CourseCodeType | null {
  if (value === 'Regular') return 'Regular'
  if (value === 'Other') return 'Other'
  return null
}

function normalizeApiRecord(value: unknown): CourseCode | null {
  if (!value || typeof value !== 'object') return null
  const record = value as CourseCodeApiRecord
  const code = String(record.code ?? '').trim().padStart(2, '0')
  const name = typeof record.courseName === 'string' ? record.courseName.trim() : ''
  const type = normalizeType(record.type)
  const activeValue = String(record.active ?? '').trim().toLowerCase()

  if (!/^\d{2}$/.test(code) || !name || !type) return null
  if (code === '00' && type !== 'Other') return null
  if (code !== '00' && type !== 'Regular') return null
  if (!['yes', 'no', 'true', 'false'].includes(activeValue)) return null

  return {
    id: code === '00' ? 'other-programs' : `course-${code}`,
    code,
    name,
    type,
    active: activeValue === 'yes' || activeValue === 'true',
  }
}

async function fetchLiveCourseCodes() {
  const payload: CourseCodeApiResponse = { success: true, data: await fetchCourseCodes() }
  if (payload.success !== true || !Array.isArray(payload.data)) throw new Error('Course Codes API returned an unsuccessful or malformed response.')

  const normalized = payload.data.map(normalizeApiRecord)
  if (normalized.some((course) => course === null)) {
    throw new Error('Course Codes API returned unexpected course-code records.')
  }

  const courses = normalized as CourseCode[]
  if (courses.length === 0) throw new Error('Course Codes API returned no records.')
  if (!courses.some((course) => course.code === '00' && course.type === 'Other')) {
    throw new Error('Course Codes API is missing reserved code 00.')
  }
  if (new Set(courses.map((course) => course.code)).size !== courses.length) {
    throw new Error('Course Codes API returned duplicate codes.')
  }

  return courses
}

async function loadLiveCourseCodes() {
  const courses = await fetchLiveCourseCodes()
  courseCodes = courses
  highestIssuedRegularCode = getHighestRegularCode(courses)
  sourceStatus = { source: 'live', error: null }
  notifySubscribers()
  return sortCourseCodes(courseCodes)
}

export async function getCourseCodes(forceRefresh = false) {
  if (!forceRefresh && sourceStatus.source !== 'uninitialized') {
    return sortCourseCodes(courseCodes)
  }
  if (loadPromise) return loadPromise

  loadPromise = loadLiveCourseCodes()
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error('Unable to load Course Codes.')
      console.error('Course Codes API unavailable.', error)
      courseCodes = []
      highestIssuedRegularCode = 0
      sourceStatus = { source: 'unavailable', error }
      notifySubscribers()
      return sortCourseCodes(courseCodes)
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

export function getCachedCourseCodes() {
  return sortCourseCodes(courseCodes)
}

export function getCourseCodeServiceStatus() {
  return sourceStatus
}

export function subscribeToCourseCodes(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCourseCodeByName(name: string) {
  return courseCodes.find((course) => course.name === name)
}

export function getCourseByCode(code: string) {
  return courseCodes.find((course) => course.code === code)
}

export function getSuggestedCourseCode(courses: CourseCode[]) {
  const highestRegularCode = getHighestRegularCode(courses)
  if (highestRegularCode >= 99) return ''
  return String(highestRegularCode + 1).padStart(2, '0')
}

export function getNextAvailableCourseCode() {
  if (highestIssuedRegularCode >= 99) return ''
  return String(highestIssuedRegularCode + 1).padStart(2, '0')
}

export function getAvailableRegularCodeCount() {
  return 99 - highestIssuedRegularCode
}

export function isSystemCourseCode(course: CourseCode) {
  return /^0[0-6]$/.test(course.code)
}

export function validateCourseCodeInput(input: CourseCodeInput, editingId?: string) {
  const errors: Partial<Record<keyof CourseCodeInput, string>> = {}
  const name = input.name.trim()

  if (!name) errors.name = 'Enter a course name.'
  if (!/^\d{2}$/.test(input.code)) {
    errors.code = 'Course code must contain exactly two numeric digits.'
  } else if (input.code === '00') {
    errors.code = '00 is reserved for Other Programs.'
  } else if (courseCodes.some((course) => course.code === input.code && course.id !== editingId)) {
    errors.code = `Course code ${input.code} is already in use. Please select another available code.`
  }

  if (name && courseCodes.some(
    (course) => course.name.toLowerCase() === name.toLowerCase() && course.id !== editingId,
  )) {
    errors.name = 'A course with this name already exists.'
  }

  return errors
}

function invalidateCourseCodes() {
  sourceStatus = { source: 'uninitialized', error: null }
}

async function refreshAfterMutation() {
  loadPromise = null
  return getCourseCodes(true)
}

export async function addCourseCode(input: CourseCodeInput) {
  const errors = validateCourseCodeInput(input)
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0])

  await addCourseCodeRequest({
    code: input.code,
    courseName: input.name.trim(),
    type: 'Regular',
    active: 'Yes',
  })
  invalidateCourseCodes()
  return refreshAfterMutation()
}

export async function updateCourseCode(id: string, input: CourseCodeInput) {
  const existingCourse = courseCodes.find((course) => course.id === id)
  if (!existingCourse || existingCourse.type === 'Other') {
    throw new Error('Reserved course codes cannot be changed.')
  }
  const immutableInput = { ...input, code: existingCourse.code }
  const errors = validateCourseCodeInput(immutableInput, id)
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0])

  await updateCourseCodeRequest({
    code: existingCourse.code,
    courseName: input.name.trim(),
    type: existingCourse.type,
    active: existingCourse.active ? 'Yes' : 'No',
  })
  invalidateCourseCodes()
  return refreshAfterMutation()
}

export async function deleteCourseCode(id: string) {
  const course = courseCodes.find((item) => item.id === id)
  if (!course || course.type === 'Other' || isSystemCourseCode(course)) return false

  await deleteCourseCodeRequest(course.code)
  invalidateCourseCodes()
  await refreshAfterMutation()
  return true
}

export function getRegularCourseOptions() {
  return getCachedCourseCodes()
    .filter((course) => course.type === 'Regular' && course.active)
    .map((course) => ({ label: `${course.code} - ${course.name}`, value: course.name }))
}
