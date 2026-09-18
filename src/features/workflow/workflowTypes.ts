export interface AdmissionSnapshot {
  admissionDate: string
  admissionNumber: string
  batchNumber: string
  course: string
  courseDuration: string
  discountPercentage: number
  email: string
  enrollmentMonth: string
  enrollmentYear: string
  finalFee: number
  mobileNumber: string
  previousPaid: number
  startTime: string
  endTime: string
  studentName: string
  totalCourseFee: number
}

export interface PaymentRecord {
  paymentId: string
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

export interface WorkflowState {
  admission: AdmissionSnapshot | null
  payment: PaymentRecord | null
}