import { getIdToken, notifyAuthFailure } from '../auth/authService'
import { encodeEnquiryPayload, normalizeEnquiryRecord } from '../features/enquiries/enquiryEducation'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const REQUEST_TIMEOUT_MS = 15_000
const CONVERSION_TIMEOUT_MS = 35_000

export class ApiHttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiHttpError'
    this.status = status
  }
}

export class ApiOutcomeUnknownError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiOutcomeUnknownError'
  }
}

export interface ApiError {
  message: string
}

export interface CourseCode {
  code: string
  courseName: string
  type: string
  active: string
}

export interface AdmissionPayload {
  idempotencyKey?: string
  fullName: string
  fathersName: string
  mothersName: string
  parentsPhoneNumber?: string
  dateOfBirth: string
  gender: string
  mobileNumber: string
  email: string
  address: string
  city: string
  collegeName: string
  state: string
  pincode: string
  degreeCourse: string
  course: string
  batch: string
  startTime: string
  endTime: string
  admissionDate: string
  courseDuration: string
  totalCourseFee: number
  discount: number
  remarks: string
  yearOfPassing: string
  otherProgramDetails?: string
}

export interface AdmissionResponse {
  indexWarning?: string
  student: {
    studentId: string
    fullName: string
    course: string
    courseCode: string
    batch: string
    admissionDate: string
    enrollmentMonth: string
    enrollmentYear: string
    courseDuration: string
    totalCourseFee: number
    discount: number
    finalFee: number
  }
}

export interface PaymentPayload {
  idempotencyKey?: string
  studentId: string
  course: string
  amountPaid: number
  paymentDate: string
  feeType?: string
  paymentMode?: string
  remarks: string
}

export interface PaymentResponse {
  indexWarning?: string
  receipt: {
    receiptId: string
    studentId: string
    previousPaid: number
    totalPaid: number
    balance: number
  }
  sheet: {
    name: string
    id: string
    row: number
  }
}

export interface StudentRecord {
  studentId: string
  fullName: string
  collegeName?: string
  degreeCourse?: string
  yearOfPassing?: string
  educationLevel?: string
  specialization?: string
  fatherName: string
  motherName: string
  parentsPhoneNumber?: string
  dateOfBirth: string
  gender: string
  mobileNumber: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  course: string
  batch: string
  startTime: string
  endTime: string
  enrollmentMonth: string
  enrollmentYear: string
  admissionDate: string
  courseDuration: string
  totalCourseFee: number
  discount: number
  finalFee: number
  totalPaid?: number
  balance?: number
  remarks: string
  otherProgramDetails?: string
  createdAt: string
}

export interface PaymentRecord {
  receiptId: string
  studentId: string
  studentName: string
  course: string
  batch: string
  enrollmentMonth: string
  enrollmentYear: string
  paymentDate: string
  feeType: string
  amountPaid: number
  paymentMode: string
  previousPaid: number
  totalPaid: number
  balance: number
  createdBy: string
  createdAt: string
  remarks: string
}

export interface StudentDetailsResponse {
  student: StudentRecord
  payments: PaymentRecord[]
  totalPaid: number
  balance: number
  latestPayment: PaymentRecord | null
}

export interface DashboardData {
  totalStudents: number
  totalCollected: number
  outstandingFees: number
  todaysCollection: number
  admissionsOverview: { today: number; thisMonth: number; total: number }
  collectionOverview: { today: number; thisMonth: number; total: number }
  studentsByCourse: Array<{ label: string; value: number }>
  collectionByCourse: Array<{ label: string; value: number }>
  recentAdmissions: StudentRecord[]
  recentPayments: PaymentRecord[]
  paymentModes: Array<{ label: string; value: number }>
}

export interface VisitorRecord {
  visitorId: string
  fullName: string
  mobileNumber: string
  email: string
  college: string
  degreeCourse: string
  yearOfGraduation: string
  courseInterestedIn: string
  otherCourse: string
  referral: string
  otherReferral: string
  notes: string
  consultedWith: string
  visitDate: string
  entryTime: string
  exitTime: string
  visitStatus: string
  followUpRequired: string
  conversionStatus: string
  admissionId: string
  createdAt: string
  updatedAt: string
}

export interface EnquiryRecord {
  enquiryId: string
  fullName: string
  mobileNumber: string
  email: string
  college: string
  educationLevel: string
  specialization: string
  yearOfGraduation: string
  courseInterestedIn: string
  otherProgramDetails: string
  referral: string
  notes: string
  consultedBy: string
  enquiryDate: string
  status: 'New' | 'Follow-up' | 'Converted' | 'Not Interested'
  admissionId: string
  createdAt: string
  updatedAt: string
  degreeCourse?: string
}

export type EnquiryApiRecord = Omit<EnquiryRecord, 'educationLevel' | 'specialization' | 'yearOfGraduation' | 'otherProgramDetails'>
  & Partial<Pick<EnquiryRecord, 'educationLevel' | 'specialization' | 'yearOfGraduation' | 'otherProgramDetails'>>

export interface ConvertEnquiryPayload {
  enquiryId: string
  admission: AdmissionPayload
}

export interface ConvertEnquiryResponse {
  success: true
  recoveredAdmission?: boolean
  data?: { enquiryId: string; admissionId: string; studentId: string }
  partial?: boolean
  studentIndexSynchronized?: boolean
  indexWarning?: string
  studentIndexWarning?: string
  error?: string
}

export type EnquiryPayload = Pick<EnquiryRecord,
  'fullName' | 'mobileNumber' | 'email' | 'college' | 'educationLevel' | 'specialization' |
  'yearOfGraduation' | 'courseInterestedIn' | 'otherProgramDetails' | 'referral' | 'notes' | 'consultedBy' | 'enquiryDate'
>

export interface FollowUpRecord {
  followUpId: string
  visitorId: string
  fullName: string
  mobileNumber: string
  courseInterestedIn: string
  followUpNumber: number
  scheduledDate: string
  completedDate: string
  followUpStatus: string
  contactMethod: string
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface WalkInPayload {
  idempotencyKey?: string
  fullName: string
  mobileNumber: string
  email: string
  college: string
  degreeCourse: string
  yearOfGraduation: string
  courseInterestedIn: string
  otherCourse: string
  referral: string
  otherReferral: string
  notes: string
  consultedWith: string
  followUpRequired: string
}

export interface FollowUpPayload {
  idempotencyKey?: string
  visitorId: string
  scheduledDate: string
  followUpStatus: string
  contactMethod: string
  notes: string
}

type ApiSuccess = { success: true }

function getApiUrl() {
  if (!API_BASE_URL) {
    throw new Error('The LSA API is not configured.')
  }
  const url = new URL(API_BASE_URL)
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    throw new Error('The browser API must use the authenticated LSA gateway.')
  }
  return API_BASE_URL.replace(/\/$/, '')
}

function toUserMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unable to complete the request. Please try again.'
}

async function request<T>(
  path = '',
  init: RequestInit = {},
  credential = getIdToken(),
  notifyFailure = true,
  outcomeMayBeUnknown: 'conversion' | 'payment' | null = null,
): Promise<T> {
  if (!credential) throw new ApiHttpError('Authentication required.', 401)
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), outcomeMayBeUnknown === 'conversion' ? CONVERSION_TIMEOUT_MS : REQUEST_TIMEOUT_MS)

  try {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${credential}`)
    const response = await fetch(`${getApiUrl()}${path}`, { ...init, headers, signal: controller.signal })
    if (response.status === 401) {
      if (notifyFailure) notifyAuthFailure('sessionExpired', credential)
      throw new ApiHttpError('Your session has expired. Please sign in again.', 401)
    }
    if (response.status === 403) {
      if (notifyFailure) notifyAuthFailure('accessDenied', credential)
      throw new ApiHttpError('Your Google account is not authorized to access this application.', 403)
    }
    if (!response.ok) {
      if (outcomeMayBeUnknown && response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        const message = outcomeMayBeUnknown === 'payment'
          ? 'The payment request was rejected. Review the payment details and try again.'
          : 'The conversion request was rejected. Review the admission details and try again.'
        throw new ApiHttpError(message, response.status)
      }
      throw new Error('The LSA API could not complete the request.')
    }

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || (payload as ApiSuccess).success !== true) {
      const error = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null
      throw new Error(typeof error === 'string' && error.trim() ? error : 'The LSA API returned an invalid response.')
    }
    return payload as T
  } catch (error) {
    if (error instanceof ApiHttpError || error instanceof ApiOutcomeUnknownError) throw error
    if (outcomeMayBeUnknown) {
      if (outcomeMayBeUnknown === 'payment') {
        throw new ApiOutcomeUnknownError(`Payment outcome could not be confirmed${error instanceof Error ? `: ${error.message}` : '.'} Check the payment history before submitting again; contact an administrator if it is unclear.`)
      }
      const reason = error instanceof DOMException && error.name === 'AbortError'
        ? 'The conversion request timed out.'
        : toUserMessage(error)
      throw new ApiOutcomeUnknownError(`Conversion outcome could not be confirmed: ${reason} Retry the original conversion to recover safely; do not register a separate admission.`)
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The LSA API request timed out. Please try again.')
    }
    throw new Error(toUserMessage(error))
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function validateCredential(credential: string) {
  return request<{ success: true; data: CourseCode[] }>('?action=course-codes', {}, credential, false)
}

function post<T>(payload: Record<string, unknown>, outcomeMayBeUnknown: 'conversion' | 'payment' | null = null) {
  return request<T>('', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }, getIdToken(), true, outcomeMayBeUnknown)
}

const pendingMutationKeys = new Map<string, string>()

function postIdempotent<T>(action: string, payload: object) {
  const signature = `${action}:${JSON.stringify(payload)}`
  const idempotencyKey = pendingMutationKeys.get(signature) ?? crypto.randomUUID()
  pendingMutationKeys.set(signature, idempotencyKey)

  return post<T>({ action, ...(payload as Record<string, unknown>), idempotencyKey }).then((result) => {
    pendingMutationKeys.delete(signature)
    return result
  })
}

export async function fetchCourseCodes() {
  const result = await request<{ success: true; data: CourseCode[] }>('?action=course-codes')
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid course codes.')
  return result.data
}

export function addCourseCode(payload: { code: string; courseName: string; type: string; active: string }) {
  return post<{ success: true } & ApiSuccess>({ action: 'add-course', ...payload })
}

export function updateCourseCode(payload: { code: string; courseName: string; type: string; active: string }) {
  return post<{ success: true } & ApiSuccess>({ action: 'update-course', ...payload })
}

export function deleteCourseCode(code: string) {
  return post<{ success: true } & ApiSuccess>({ action: 'delete-course', code })
}

export function createAdmission(payload: AdmissionPayload) {
  return postIdempotent<{ success: true } & AdmissionResponse>('add-student', payload)
}

export async function createPayment(payload: PaymentPayload) {
  const signature = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', signature)
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const storageKey = `lsa-pending-payment:${hash}`
  const idempotencyKey = localStorage.getItem(storageKey) ?? crypto.randomUUID()
  localStorage.setItem(storageKey, idempotencyKey)
  const result = await post<{ success: true } & PaymentResponse>(
    { action: 'add-payment', ...payload, idempotencyKey }, 'payment',
  )
  try {
    localStorage.removeItem(storageKey)
  } catch {
    return {
      ...result,
      indexWarning: [result.indexWarning, 'The browser could not clear the payment retry key. Contact an administrator before recording an identical payment.'].filter(Boolean).join(' '),
    }
  }
  return result
}

function queryString(parameters: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(parameters).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  return query.toString()
}

export async function fetchStudents(filters: Record<string, string | undefined> = {}) {
  const query = queryString(filters)
  const result = await request<{ success: true; data: StudentRecord[] }>(`?action=students${query ? `&${query}` : ''}`)
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid student records.')
  return result.data
}

export async function fetchStudent(studentId: string) {
  const result = await request<{ success: true; data: StudentDetailsResponse }>(`?action=student&studentId=${encodeURIComponent(studentId)}`)
  if (!result.data?.student) throw new Error('The LSA API returned invalid student details.')
  return result.data
}

export async function fetchPayments(filters: Record<string, string | undefined> = {}) {
  const query = queryString(filters)
  const result = await request<{ success: true; data: PaymentRecord[] }>(`?action=payments${query ? `&${query}` : ''}`)
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid payment records.')
  return result.data
}

export async function fetchDashboard() {
  const result = await request<{ success: true; data: DashboardData }>('?action=dashboard')
  if (!result.data) throw new Error('The LSA API returned invalid dashboard data.')
  return result.data
}

export async function fetchEnquiries() {
  const result = await request<{ success: true; data: EnquiryApiRecord[] }>('?action=enquiries')
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid enquiries.')
  return result.data.map(normalizeEnquiryRecord)
}

export function convertEnquiry(payload: ConvertEnquiryPayload) {
  return post<ConvertEnquiryResponse>({ action: 'convert-enquiry', ...payload }, 'conversion')
}

export function createEnquiry(payload: EnquiryPayload) {
  return postIdempotent<{ success: true; data: EnquiryApiRecord; indexWarning?: string }>('add-enquiry', encodeEnquiryPayload(payload))
    .then((result) => normalizeSavedEnquiry(result, payload))
}

export function updateEnquiry(enquiryId: string, payload: EnquiryPayload & { status: EnquiryRecord['status'] }) {
  return post<{ success: true; data: EnquiryApiRecord; indexWarning?: string }>({ action: 'update-enquiry', enquiryId, ...encodeEnquiryPayload(payload) })
    .then((result) => normalizeSavedEnquiry(result, payload))
}

function normalizeSavedEnquiry(result: { success: true; data: EnquiryApiRecord; indexWarning?: string }, payload: EnquiryPayload) {
  const data = normalizeEnquiryRecord(result.data)
  const retained = data.educationLevel === payload.educationLevel.trim()
    && data.specialization === payload.specialization.trim()
    && data.yearOfGraduation === payload.yearOfGraduation.trim()
  const warning = retained ? '' : 'Enquiry saved, but the server did not return the submitted education details. Do not submit again; contact an administrator to check the saved record.'
  return { ...result, data, indexWarning: [result.indexWarning, warning].filter(Boolean).join(' ') || undefined }
}

export async function fetchWalkIns(filters: Record<string, string | undefined> = {}) {
  const query = queryString(filters)
  const result = await request<{ success: true; data: VisitorRecord[] }>(`?action=walkins${query ? `&${query}` : ''}`)
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid walk-in records.')
  return result.data
}

export async function fetchFollowUps(filters: Record<string, string | undefined> = {}) {
  const query = queryString(filters)
  const result = await request<{ success: true; data: FollowUpRecord[] }>(`?action=followups${query ? `&${query}` : ''}`)
  if (!Array.isArray(result.data)) throw new Error('The LSA API returned invalid follow-up records.')
  return result.data
}

export function createWalkIn(payload: WalkInPayload) {
  return postIdempotent<{ success: true; data: VisitorRecord }>('add-walkin', payload)
}

export function updateWalkIn(visitorId: string, payload: WalkInPayload) {
  return post<{ success: true; data: VisitorRecord }>({ action: 'update-walkin', visitorId, ...payload })
}

export function markWalkInExit(visitorId: string) {
  return post<{ success: true; data: VisitorRecord }>({ action: 'mark-walkin-exit', visitorId })
}

export function createFollowUp(payload: FollowUpPayload) {
  return postIdempotent<{ success: true; data: FollowUpRecord }>('add-followup', payload)
}

export function updateFollowUp(followUpId: string, payload: Omit<FollowUpPayload, 'visitorId'>) {
  return post<{ success: true; data: FollowUpRecord }>({ action: 'update-followup', followUpId, ...payload })
}