import type { AdmissionSnapshot } from '../workflow/workflowTypes'
import type { Student } from './studentTypes'
import type { StudentRecord } from '../../services/api'

export function toStudent(record: StudentRecord): Student {
  const { finalFee, totalPaid, balance } = record
  if (typeof finalFee !== 'number' || typeof totalPaid !== 'number' || typeof balance !== 'number'
    || !Number.isFinite(finalFee) || !Number.isFinite(totalPaid) || !Number.isFinite(balance)) {
    throw new Error('An admission is missing financial totals. Please reconcile the records.')
  }
  return {
    ...record,
    discountPercentage: record.totalCourseFee ? (record.discount / record.totalCourseFee) * 100 : 0,
    totalPaid,
    balance,
  }
}

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
    latestPaymentDate: student.latestPaymentDate,
    startTime: student.startTime,
    endTime: student.endTime,
    studentName: student.fullName,
    totalCourseFee: student.totalCourseFee,
  }
}