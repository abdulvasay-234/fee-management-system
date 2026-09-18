export interface AdmissionFormData {
  address: string
  admissionDate: string
  batchNumber: string
  city: string
  course: string
  courseDuration: string
  dateOfBirth: string
  discountPercentage: string
  email: string
  endTime: string
  fatherName: string
  fullName: string
  gender: string
  mobileNumber: string
  motherName: string
  pincode: string
  remarks: string
  startTime: string
  state: string
  totalCourseFee: string
}

export type AdmissionFormErrors = Partial<
  Record<keyof AdmissionFormData, string>
>