import type { Student } from '../students/studentTypes'
import type { PaymentRecord } from '../workflow/workflowTypes'

export function getLocalDateParts(date = new Date()) {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

export function isToday(value: string, today = new Date()) {
  const date = parseDateOnly(value)
  const current = getLocalDateParts(today)
  return date.year === current.year
    && date.month === current.month
    && date.day === current.day
}

export function isCurrentMonth(value: string, today = new Date()) {
  const date = parseDateOnly(value)
  const current = getLocalDateParts(today)
  return date.year === current.year && date.month === current.month
}

export function sumPaymentAmounts(payments: PaymentRecord[]) {
  return payments.reduce((total, payment) => total + payment.amountPaid, 0)
}

export function sumOutstandingBalances(students: Student[]) {
  return students.reduce((total, student) => total + student.balance, 0)
}

export function sortStudentsByAdmissionDate(students: Student[]) {
  return [...students].sort((left, right) =>
    right.admissionDate.localeCompare(left.admissionDate),
  )
}

export function sortPaymentsByDate(payments: PaymentRecord[]) {
  return [...payments].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}