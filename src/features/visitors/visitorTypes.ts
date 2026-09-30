import type { FollowUpRecord, VisitorRecord, WalkInPayload } from '../../services/api'

export type { FollowUpRecord, VisitorRecord, WalkInPayload }

export interface VisitorFormData extends WalkInPayload {
  visitDate: string
  entryTime: string
}

export type VisitorFormErrors = Partial<Record<keyof VisitorFormData, string>>

export interface FollowUpFormData {
  scheduledDate: string
  followUpStatus: string
  contactMethod: string
  notes: string
}

export type FollowUpFormErrors = Partial<Record<keyof FollowUpFormData, string>>

export const emptyVisitorForm: VisitorFormData = {
  fullName: '',
  mobileNumber: '',
  email: '',
  college: '',
  degreeCourse: '',
  yearOfGraduation: '',
  courseInterestedIn: '',
  otherCourse: '',
  referral: '',
  otherReferral: '',
  notes: '',
  consultedWith: '',
  visitDate: new Date().toISOString().slice(0, 10),
  entryTime: new Date().toTimeString().slice(0, 5),
  followUpRequired: 'No',
}

export function visitorToForm(visitor: VisitorRecord): VisitorFormData {
  return {
    fullName: visitor.fullName,
    mobileNumber: visitor.mobileNumber,
    email: visitor.email,
    college: visitor.college,
    degreeCourse: visitor.degreeCourse,
    yearOfGraduation: visitor.yearOfGraduation,
    courseInterestedIn: visitor.courseInterestedIn,
    otherCourse: visitor.otherCourse,
    referral: visitor.referral,
    otherReferral: visitor.otherReferral,
    notes: visitor.notes,
    consultedWith: visitor.consultedWith,
    visitDate: visitor.visitDate,
    entryTime: visitor.entryTime,
    followUpRequired: visitor.followUpRequired || 'No',
  }
}

export function validateVisitorForm(form: VisitorFormData): VisitorFormErrors {
  const errors: VisitorFormErrors = {}
  const email = form.email.trim()
  const graduationYear = form.yearOfGraduation.trim()
  if (!form.fullName.trim()) errors.fullName = 'Name is required.'
  if (!form.mobileNumber.trim()) errors.mobileNumber = 'Phone is required.'
  if (!form.courseInterestedIn.trim()) errors.courseInterestedIn = 'Course is required.'
  if (!form.visitDate) errors.visitDate = 'Visit date is required.'
  if (!form.entryTime) errors.entryTime = 'Entry time is required.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  if (graduationYear && !/^\d{4}$/.test(graduationYear)) errors.yearOfGraduation = 'Use a four-digit year.'
  if (form.courseInterestedIn === 'Other' && !form.otherCourse.trim()) errors.otherCourse = 'Enter the course name.'
  if (form.referral === 'Other' && !form.otherReferral.trim()) errors.otherReferral = 'Enter the referral source.'
  if (!form.referral.trim()) errors.referral = 'Referral is required.'
  if (!form.consultedWith.trim()) errors.consultedWith = 'Consulted with is required.'
  return errors
}

export const referralOptions = [
  { label: 'Select referral', value: '' },
  { label: 'Google Search', value: 'Google Search' },
  { label: 'Social Media', value: 'Social Media' },
  { label: 'Friend / Family', value: 'Friend / Family' },
  { label: 'Walk-in', value: 'Walk-in' },
  { label: 'Other', value: 'Other' },
]

export const followUpRequiredOptions = [
  { label: 'No', value: 'No' },
  { label: 'Yes', value: 'Yes' },
]

export const followUpStatusOptions = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Not Required', value: 'Not Required' },
]

export const contactMethodOptions = [
  { label: 'Select method', value: '' },
  { label: 'Phone', value: 'Phone' },
  { label: 'WhatsApp', value: 'WhatsApp' },
  { label: 'Email', value: 'Email' },
  { label: 'In person', value: 'In person' },
]

export function formatVisitorDate(value: string) {
  if (!value) return 'Not provided'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatVisitorTime(value: string) {
  if (!value) return 'Not recorded'
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return value
  const hour = Number(match[1])
  return `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}
