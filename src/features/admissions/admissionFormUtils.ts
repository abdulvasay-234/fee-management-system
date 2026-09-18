import type {
  AdmissionFormData,
  AdmissionFormErrors,
} from './admissionTypes'
import { parseAmount } from '../../utils/amount'
import { getCourseCodeByName } from '../courseCodes/courseCodeService'

export const initialAdmissionForm: AdmissionFormData = {
  address: '',
  admissionDate: '',
  batchNumber: '01',
  city: '',
  course: '',
  courseDuration: '',
  dateOfBirth: '',
  discountPercentage: '',
  email: '',
  endTime: '20:00',
  fatherName: '',
  fullName: '',
  gender: '',
  mobileNumber: '',
  motherName: '',
  pincode: '',
  remarks: '',
  startTime: '18:00',
  state: '',
  totalCourseFee: '45,000',
}

export function calculateFinalFee(total: string, discountPercentage: string) {
  if (total === '') return ''
  const totalAmount = parseAmount(total)
  const percentage = Number(discountPercentage || 0)
  const finalAmount = totalAmount - (totalAmount * percentage) / 100

  return Math.round(Math.max(finalAmount, 0)).toLocaleString('en-IN')
}

export function getAdmissionMetadata(admissionDate: string) {
  if (!admissionDate) {
    return {
      admissionYear: 'Derived from admission date',
      enrollmentMonth: 'Derived from admission date',
      enrollmentYear: 'Derived from admission date',
    }
  }

  const date = new Date(`${admissionDate}T00:00:00`)
  return {
    admissionYear: String(date.getFullYear()),
    enrollmentMonth: date.toLocaleDateString('en-IN', { month: 'long' }),
    enrollmentYear: String(date.getFullYear()),
  }
}

export function getAdmissionNumberPreview(
  admissionDate: string,
  course: string,
  batchNumber: string,
) {
  const year = admissionDate ? admissionDate.slice(2, 4) : 'YY'
  const courseCode = getCourseCodeByName(course)?.code ?? 'CC'
  const batch = /^\d{2}$/.test(batchNumber) ? batchNumber : 'BB'
  return `${year}${courseCode}${batch}01`
}

export function validateAdmissionForm(data: AdmissionFormData) {
  const errors: AdmissionFormErrors = {}
  const mobileDigits = data.mobileNumber.replace(/\D/g, '')

  if (!data.fullName.trim()) errors.fullName = 'Enter the student’s full name.'
  if (!data.mobileNumber.trim()) {
    errors.mobileNumber = 'Enter a mobile number.'
  } else if (mobileDigits.length < 10 || mobileDigits.length > 15) {
    errors.mobileNumber = 'Enter a valid 10 to 15 digit mobile number.'
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (data.dateOfBirth && data.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.'
  }
  if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
    errors.pincode = 'Enter a valid 6 digit pincode.'
  }
  if (!data.course) errors.course = 'Select a course.'
  if (!/^\d{2}$/.test(data.batchNumber)) {
    errors.batchNumber = 'Enter a two-digit batch number, such as 01.'
  }
  if (!data.admissionDate) errors.admissionDate = 'Select an admission date.'
  if (!data.startTime) errors.startTime = 'Select the batch start time.'
  if (!data.endTime) {
    errors.endTime = 'Select the batch end time.'
  } else if (data.startTime && data.endTime <= data.startTime) {
    errors.endTime = 'End time must be later than start time.'
  }

  const totalFee = parseAmount(data.totalCourseFee)
  const discountPercentage = Number(data.discountPercentage || 0)
  if (!data.totalCourseFee) {
    errors.totalCourseFee = 'Enter the total course fee.'
  } else if (totalFee < 0) {
    errors.totalCourseFee = 'Total course fee cannot be negative.'
  }
  if (discountPercentage < 0) {
    errors.discountPercentage = 'Discount percentage cannot be negative.'
  }
  if (data.discountPercentage && !data.totalCourseFee) {
    errors.totalCourseFee = 'Enter the total course fee before adding a discount.'
  } else if (discountPercentage > 100) {
    errors.discountPercentage = 'Discount percentage cannot exceed 100%.'
  }

  return errors
}