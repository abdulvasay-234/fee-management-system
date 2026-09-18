const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const REQUEST_TIMEOUT_MS = 15_000

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
  fullName: string
  fathersName: string
  mothersName: string
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
  admissionDate: string
  courseDuration: string
  totalCourseFee: number
  discount: number
  remarks: string
}

export interface AdmissionResponse {
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
  studentId: string
  course: string
  amountPaid: number
  paymentMode: string
  paymentDate: string
  feeType: string
  remarks: string
}

export interface PaymentResponse {
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
  fatherName: string
  motherName: string
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

type ApiSuccess = { success: true }

function getApiUrl() {
  if (!API_BASE_URL) {
    throw new Error('The LSA API is not configured.')
  }
  return API_BASE_URL
}

function toUserMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unable to complete the request. Please try again.'
}

async function request<T>(path = '', init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiUrl()}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error('The LSA API could not complete the request.')

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || (payload as ApiSuccess).success !== true) {
      const error = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null
      throw new Error(typeof error === 'string' && error.trim() ? error : 'The LSA API returned an invalid response.')
    }
    return payload as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The LSA API request timed out. Please try again.')
    }
    throw new Error(toUserMessage(error))
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function post<T>(payload: Record<string, unknown>) {
  return request<T>('', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
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
  return post<{ success: true } & AdmissionResponse>({ action: 'add-student', ...payload })
}

export function createPayment(payload: PaymentPayload) {
  return post<{ success: true } & PaymentResponse>({ action: 'add-payment', ...payload })
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