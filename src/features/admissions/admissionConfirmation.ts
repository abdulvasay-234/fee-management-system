import type { StudentRecord } from '../../services/api'

export interface AdmissionConfirmationData {
  admissionId: string
  admissionDate: string
  batch: string
  collegeName: string
  course: string
  courseDuration: string
  createdAt: string
  discount: number
  educationLevel: string
  email: string
  endTime: string
  enquiryId: string
  finalFee: number
  fullName: string
  mobileNumber: string
  otherProgramDetails: string
  specialization: string
  startTime: string
  status: 'Converted'
  studentId: string
  totalCourseFee: number
  yearOfGraduation: string
}

function splitEducationDetails(value: string) {
  const details = value.trim()
  const separator = details.indexOf(' - ')
  if (separator < 0) return { educationLevel: details, specialization: '' }
  return {
    educationLevel: details.slice(0, separator).trim(),
    specialization: details.slice(separator + 3).trim(),
  }
}

export function createAdmissionConfirmationData(student: StudentRecord, enquiryId: string): AdmissionConfirmationData {
  const education = splitEducationDetails(student.degreeCourse ?? '')
  return {
    admissionId: student.studentId,
    admissionDate: student.admissionDate,
    batch: student.batch,
    collegeName: student.collegeName ?? '',
    course: student.course,
    courseDuration: student.courseDuration,
    createdAt: student.createdAt,
    discount: student.discount,
    educationLevel: education.educationLevel,
    email: student.email,
    endTime: student.endTime,
    enquiryId,
    finalFee: student.finalFee,
    fullName: student.fullName,
    mobileNumber: student.mobileNumber,
    otherProgramDetails: student.otherProgramDetails ?? '',
    specialization: education.specialization,
    startTime: student.startTime,
    status: 'Converted',
    studentId: student.studentId,
    totalCourseFee: student.totalCourseFee,
    yearOfGraduation: student.yearOfPassing ?? '',
  }
}