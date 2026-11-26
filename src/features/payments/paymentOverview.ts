import { sumMoney } from '../../utils/amount'
import { courseKey } from '../students/studentDirectoryUtils'
import type { Student } from '../students/studentTypes'
import type { PaymentRecord } from '../workflow/workflowTypes'

export function summarizePaymentOverview(payments: PaymentRecord[], students: Student[]) {
  const admissionIds = new Set<string>()
  const receiptIds = new Set<string>()
  const courses = new Map<string, { name: string; fees: number[]; balances: number[] }>()
  let pendingAdmissions = 0

  students.forEach((student) => {
    const id = student.studentId.trim()
    if (!id || admissionIds.has(id)) throw new Error('Admissions contain a missing or duplicate admission ID. Please reconcile the records.')
    admissionIds.add(id)
    const key = courseKey(student.course)
    if (!key) throw new Error(`Admission ${id} has no course. Please reconcile the record.`)
    const course = courses.get(key) ?? { name: student.course.trim(), fees: [], balances: [] }
    course.fees.push(student.finalFee)
    course.balances.push(Math.max(student.balance, 0))
    courses.set(key, course)
    if (student.balance > 0) pendingAdmissions++
  })

  payments.forEach((payment) => {
    const id = payment.receiptId.trim()
    if (!id || receiptIds.has(id)) throw new Error('Payments contain a missing or duplicate receipt ID. Please reconcile the records.')
    receiptIds.add(id)
  })

  const courseTotals = Array.from(courses.values()).map((course) => ({
    name: course.name,
    totalFees: sumMoney(course.fees),
    outstanding: sumMoney(course.balances),
  })).sort((left, right) => left.name.localeCompare(right.name))

  return {
    totalCollected: sumMoney(payments.map((payment) => payment.amountPaid)),
    totalFees: sumMoney(courseTotals.map((course) => course.totalFees)),
    outstanding: sumMoney(courseTotals.map((course) => course.outstanding)),
    pendingAdmissions,
    courses: courseTotals,
  }
}
