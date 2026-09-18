export interface Student {
  studentId: string
  fullName: string
  fatherName: string
  motherName: string
  dateOfBirth: string
  gender: string
  mobileNumber: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  course: string
  batch: string
  startTime: string
  endTime: string
  enrollmentMonth: string
  enrollmentYear: string
  admissionDate: string
  courseDuration: string
  totalCourseFee: number
  discountPercentage: number
  finalFee: number
  totalPaid: number
  balance: number
  remarks: string
  createdAt: string
}

export interface EnrollmentRecord {
  studentId: string
  active: boolean
}