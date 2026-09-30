export interface AdmissionFormData {
  address: string
  admissionDate: string
  batchNumber: string
  city: string
  collegeName: string
  course: string
  courseDuration: string
  dateOfBirth: string
  degreeCourse: string
  discount: string
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
  yearOfPassing: string
}

export type AdmissionFormErrors = Partial<
  Record<keyof AdmissionFormData, string>
>