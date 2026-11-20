import { mockStudents } from '../students/mockStudentData'
import type { PaymentRecord } from '../workflow/workflowTypes'

interface PaymentSeed {
  studentId: string
  receiptId: string
  paymentDate: string
  feeType: string
  amountPaid: number
  paymentMode: string
  previousPaid: number
  remarks?: string
}

const seeds: PaymentSeed[] = [
  { studentId: 'TEST-STUDENT-001', receiptId: 'TEST-RECEIPT-0001', paymentDate: '2026-08-18', feeType: 'Admission Fee', amountPaid: 5000, paymentMode: 'UPI', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-001', receiptId: 'TEST-RECEIPT-0002', paymentDate: '2026-09-02', feeType: 'Installment', amountPaid: 5000, paymentMode: 'Cash', previousPaid: 5000 },
  { studentId: 'TEST-STUDENT-001', receiptId: 'TEST-RECEIPT-0003', paymentDate: '2026-09-18', feeType: 'Installment', amountPaid: 10000, paymentMode: 'Bank Transfer', previousPaid: 10000 },
  { studentId: 'TEST-STUDENT-002', receiptId: 'TEST-RECEIPT-0004', paymentDate: '2026-08-24', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Card', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-002', receiptId: 'TEST-RECEIPT-0005', paymentDate: '2026-09-04', feeType: 'Installment', amountPaid: 15000, paymentMode: 'UPI', previousPaid: 15000 },
  { studentId: 'TEST-STUDENT-002', receiptId: 'TEST-RECEIPT-0006', paymentDate: '2026-09-17', feeType: 'Full Payment', amountPaid: 15000, paymentMode: 'Cash', previousPaid: 30000 },
  { studentId: 'TEST-STUDENT-003', receiptId: 'TEST-RECEIPT-0007', paymentDate: '2026-09-10', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Bank Transfer', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-004', receiptId: 'TEST-RECEIPT-0008', paymentDate: '2026-08-11', feeType: 'Admission Fee', amountPaid: 10000, paymentMode: 'UPI', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-005', receiptId: 'TEST-RECEIPT-0009', paymentDate: '2026-09-07', feeType: 'Admission Fee', amountPaid: 18000, paymentMode: 'Card', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-007', receiptId: 'TEST-RECEIPT-0010', paymentDate: '2026-09-12', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Other', previousPaid: 0, remarks: 'Synthetic test payment.' },
  { studentId: 'TEST-STUDENT-007', receiptId: 'TEST-RECEIPT-0011', paymentDate: '2026-09-18', feeType: 'Installment', amountPaid: 10000, paymentMode: 'UPI', previousPaid: 15000 },
  { studentId: 'TEST-STUDENT-008', receiptId: 'TEST-RECEIPT-0012', paymentDate: '2026-07-15', feeType: 'Admission Fee', amountPaid: 20000, paymentMode: 'Bank Transfer', previousPaid: 0 },
  { studentId: 'TEST-STUDENT-008', receiptId: 'TEST-RECEIPT-0013', paymentDate: '2026-08-15', feeType: 'Full Payment', amountPaid: 18250, paymentMode: 'Cash', previousPaid: 20000 },
]

export const mockPayments: PaymentRecord[] = seeds.map((seed, index) => {
  const student = mockStudents.find((record) => record.studentId === seed.studentId)

  if (!student) throw new Error(`Missing mock student ${seed.studentId}`)

  const totalPaid = seed.previousPaid + seed.amountPaid

  return {
    paymentId: `PAY-${String(index + 1).padStart(4, '0')}`,
    receiptId: seed.receiptId,
    studentId: student.studentId,
    studentName: student.fullName,
    course: student.course,
    batch: student.batch,
    enrollmentMonth: student.enrollmentMonth,
    enrollmentYear: student.enrollmentYear,
    paymentDate: seed.paymentDate,
    feeType: seed.feeType,
    amountPaid: seed.amountPaid,
    paymentMode: seed.paymentMode,
    previousPaid: seed.previousPaid,
    totalPaid,
    balance: Math.max(student.finalFee - totalPaid, 0),
    createdBy: 'LSA Staff',
    createdAt: `${seed.paymentDate}T10:00:00.000Z`,
    remarks: seed.remarks ?? '',
  }
})