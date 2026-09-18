import type { AdmissionSnapshot } from '../workflow/workflowTypes'
import type { Student } from './studentTypes'

export function toPaymentSnapshot(student: Student): AdmissionSnapshot {
  return {
    admissionDate: student.admissionDate,
    admissionNumber: student.studentId,
    batchNumber: student.batch,
    course: student.course,
    courseDuration: student.courseDuration,
    discountPercentage: student.discountPercentage,
    email: student.email,
    enrollmentMonth: student.enrollmentMonth,
    enrollmentYear: student.enrollmentYear,
    finalFee: student.finalFee,
    mobileNumber: student.mobileNumber,
    previousPaid: student.totalPaid,
    startTime: student.startTime,
    endTime: student.endTime,
    studentName: student.fullName,
    totalCourseFee: student.totalCourseFee,
  }
}