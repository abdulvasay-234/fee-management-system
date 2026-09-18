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
  { studentId: '26010101', receiptId: 'LSA-R-260001', paymentDate: '2026-08-18', feeType: 'Admission Fee', amountPaid: 5000, paymentMode: 'UPI', previousPaid: 0 },
  { studentId: '26010101', receiptId: 'LSA-R-260009', paymentDate: '2026-09-02', feeType: 'Installment', amountPaid: 5000, paymentMode: 'Cash', previousPaid: 5000 },
  { studentId: '26010101', receiptId: 'LSA-R-260021', paymentDate: '2026-09-18', feeType: 'Installment', amountPaid: 10000, paymentMode: 'Bank Transfer', previousPaid: 10000 },
  { studentId: '26010102', receiptId: 'LSA-R-260003', paymentDate: '2026-08-24', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Card', previousPaid: 0 },
  { studentId: '26010102', receiptId: 'LSA-R-260012', paymentDate: '2026-09-04', feeType: 'Installment', amountPaid: 15000, paymentMode: 'UPI', previousPaid: 15000 },
  { studentId: '26010102', receiptId: 'LSA-R-260020', paymentDate: '2026-09-17', feeType: 'Full Payment', amountPaid: 15000, paymentMode: 'Cash', previousPaid: 30000 },
  { studentId: '26020201', receiptId: 'LSA-R-260016', paymentDate: '2026-09-10', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Bank Transfer', previousPaid: 0 },
  { studentId: '26030101', receiptId: 'LSA-R-260002', paymentDate: '2026-08-11', feeType: 'Admission Fee', amountPaid: 10000, paymentMode: 'UPI', previousPaid: 0 },
  { studentId: '26040101', receiptId: 'LSA-R-260014', paymentDate: '2026-09-07', feeType: 'Admission Fee', amountPaid: 18000, paymentMode: 'Card', previousPaid: 0 },
  { studentId: '26060101', receiptId: 'LSA-R-260018', paymentDate: '2026-09-12', feeType: 'Admission Fee', amountPaid: 15000, paymentMode: 'Other', previousPaid: 0, remarks: 'Collected at academy desk.' },
  { studentId: '26060101', receiptId: 'LSA-R-260022', paymentDate: '2026-09-18', feeType: 'Installment', amountPaid: 10000, paymentMode: 'UPI', previousPaid: 15000 },
  { studentId: '25060201', receiptId: 'LSA-R-250031', paymentDate: '2026-07-15', feeType: 'Admission Fee', amountPaid: 20000, paymentMode: 'Bank Transfer', previousPaid: 0 },
  { studentId: '25060201', receiptId: 'LSA-R-250044', paymentDate: '2026-08-15', feeType: 'Full Payment', amountPaid: 18250, paymentMode: 'Cash', previousPaid: 20000 },
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