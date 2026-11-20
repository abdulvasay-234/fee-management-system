import type { EnrollmentRecord, Student } from './studentTypes'

export const mockStudents: Student[] = [
  {
    studentId: 'TEST-STUDENT-001', fullName: 'Test Student 01', fatherName: 'Test Guardian 01A', motherName: 'Test Guardian 01B', dateOfBirth: '2000-01-01', gender: 'Male', mobileNumber: '9000000001', email: 'student01@example.test', address: 'Synthetic Test Address 01', city: 'Test City', state: 'Test State', pincode: '000001', course: 'Full Stack Java', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-02', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 10, finalFee: 40500, totalPaid: 20000, balance: 20500, remarks: 'Synthetic test note.', createdAt: '2026-09-02T10:15:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-002', fullName: 'Test Student 02', fatherName: 'Test Guardian 02A', motherName: 'Test Guardian 02B', dateOfBirth: '2000-01-01', gender: 'Female', mobileNumber: '9000000002', email: 'student02@example.test', address: 'Synthetic Test Address 02', city: 'Test City', state: 'Test State', pincode: '000002', course: 'Full Stack Java', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-04', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 0, finalFee: 45000, totalPaid: 45000, balance: 0, remarks: '', createdAt: '2026-09-04T09:30:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-003', fullName: 'Test Student 03', fatherName: 'Test Guardian 03A', motherName: 'Test Guardian 03B', dateOfBirth: '2000-01-01', gender: 'Male', mobileNumber: '9000000003', email: 'student03@example.test', address: 'Synthetic Test Address 03', city: 'Test City', state: 'Test State', pincode: '000003', course: 'Data Science', batch: '02', startTime: '10:00', endTime: '12:00', enrollmentMonth: 'October', enrollmentYear: '2026', admissionDate: '2026-10-03', courseDuration: '8 Months', totalCourseFee: 45000, discountPercentage: 5, finalFee: 42750, totalPaid: 15000, balance: 27750, remarks: 'Synthetic test note.', createdAt: '2026-10-03T11:00:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-004', fullName: 'Test Student 04', fatherName: 'Test Guardian 04A', motherName: 'Test Guardian 04B', dateOfBirth: '2000-01-01', gender: 'Female', mobileNumber: '9000000004', email: 'student04@example.test', address: 'Synthetic Test Address 04', city: 'Test City', state: 'Test State', pincode: '000004', course: 'Cyber Security', batch: '01', startTime: '16:00', endTime: '18:00', enrollmentMonth: 'August', enrollmentYear: '2026', admissionDate: '2026-08-11', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 12, finalFee: 39600, totalPaid: 10000, balance: 29600, remarks: '', createdAt: '2026-08-11T08:45:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-005', fullName: 'Test Student 05', fatherName: 'Test Guardian 05A', motherName: 'Test Guardian 05B', dateOfBirth: '2000-01-01', gender: 'Male', mobileNumber: '9000000005', email: 'student05@example.test', address: 'Synthetic Test Address 05', city: 'Test City', state: 'Test State', pincode: '000005', course: 'Python Programming', batch: '01', startTime: '08:00', endTime: '10:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-07', courseDuration: '4 Months', totalCourseFee: 45000, discountPercentage: 20, finalFee: 36000, totalPaid: 18000, balance: 18000, remarks: 'Synthetic test note.', createdAt: '2026-09-07T12:20:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-006', fullName: 'Test Student 06', fatherName: 'Test Guardian 06A', motherName: 'Test Guardian 06B', dateOfBirth: '2000-01-01', gender: 'Female', mobileNumber: '9000000006', email: 'student06@example.test', address: 'Synthetic Test Address 06', city: 'Test City', state: 'Test State', pincode: '000006', course: 'Full Stack Python', batch: '02', startTime: '14:00', endTime: '16:00', enrollmentMonth: 'October', enrollmentYear: '2026', admissionDate: '2026-10-05', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 10, finalFee: 40500, totalPaid: 0, balance: 40500, remarks: '', createdAt: '2026-10-05T10:00:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-007', fullName: 'Test Student 07', fatherName: 'Test Guardian 07A', motherName: 'Test Guardian 07B', dateOfBirth: '2000-01-01', gender: 'Male', mobileNumber: '9000000007', email: 'student07@example.test', address: 'Synthetic Test Address 07', city: 'Test City', state: 'Test State', pincode: '000007', course: 'DevOps', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-12', courseDuration: '5 Months', totalCourseFee: 45000, discountPercentage: 0, finalFee: 45000, totalPaid: 25000, balance: 20000, remarks: 'Synthetic test note.', createdAt: '2026-09-12T14:10:00.000Z',
  },
  {
    studentId: 'TEST-STUDENT-008', fullName: 'Test Student 08', fatherName: 'Test Guardian 08A', motherName: 'Test Guardian 08B', dateOfBirth: '2000-01-01', gender: 'Female', mobileNumber: '9000000008', email: 'student08@example.test', address: 'Synthetic Test Address 08', city: 'Test City', state: 'Test State', pincode: '000008', course: 'DevOps', batch: '02', startTime: '17:00', endTime: '19:00', enrollmentMonth: 'November', enrollmentYear: '2025', admissionDate: '2025-11-08', courseDuration: '5 Months', totalCourseFee: 45000, discountPercentage: 15, finalFee: 38250, totalPaid: 38250, balance: 0, remarks: 'Synthetic test note.', createdAt: '2025-11-08T09:00:00.000Z',
  },
]

export const mockEnrollmentRecords: EnrollmentRecord[] = mockStudents.map((student) => ({
  studentId: student.studentId,
  active: student.studentId !== '25060201',
}))