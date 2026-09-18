import type { EnrollmentRecord, Student } from './studentTypes'

export const mockStudents: Student[] = [
  {
    studentId: '26010101', fullName: 'Aarav Mehta', fatherName: 'Rakesh Mehta', motherName: 'Sunita Mehta', dateOfBirth: '2004-03-14', gender: 'Male', mobileNumber: '9876543210', email: 'aarav.mehta@example.com', address: '18 Lake View Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', course: 'Full Stack Java', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-02', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 10, finalFee: 40500, totalPaid: 20000, balance: 20500, remarks: 'Prefers evening communication.', createdAt: '2026-09-02T10:15:00.000Z',
  },
  {
    studentId: '26010102', fullName: 'Diya Nair', fatherName: 'Suresh Nair', motherName: 'Latha Nair', dateOfBirth: '2003-11-08', gender: 'Female', mobileNumber: '9823456710', email: 'diya.nair@example.com', address: '42 Green Park Extension', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', course: 'Full Stack Java', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-04', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 0, finalFee: 45000, totalPaid: 45000, balance: 0, remarks: '', createdAt: '2026-09-04T09:30:00.000Z',
  },
  {
    studentId: '26020201', fullName: 'Kabir Singh', fatherName: 'Harpreet Singh', motherName: 'Manpreet Kaur', dateOfBirth: '2002-07-21', gender: 'Male', mobileNumber: '9765432108', email: 'kabir.singh@example.com', address: '11 Sector 22', city: 'Chandigarh', state: 'Chandigarh', pincode: '160022', course: 'Data Science', batch: '02', startTime: '10:00', endTime: '12:00', enrollmentMonth: 'October', enrollmentYear: '2026', admissionDate: '2026-10-03', courseDuration: '8 Months', totalCourseFee: 45000, discountPercentage: 5, finalFee: 42750, totalPaid: 15000, balance: 27750, remarks: 'Weekend support requested.', createdAt: '2026-10-03T11:00:00.000Z',
  },
  {
    studentId: '26030101', fullName: 'Ananya Rao', fatherName: 'Prakash Rao', motherName: 'Deepa Rao', dateOfBirth: '2004-01-19', gender: 'Female', mobileNumber: '9654321087', email: 'ananya.rao@example.com', address: '7 Residency Cross', city: 'Mysuru', state: 'Karnataka', pincode: '570001', course: 'Cyber Security', batch: '01', startTime: '16:00', endTime: '18:00', enrollmentMonth: 'August', enrollmentYear: '2026', admissionDate: '2026-08-11', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 12, finalFee: 39600, totalPaid: 10000, balance: 29600, remarks: '', createdAt: '2026-08-11T08:45:00.000Z',
  },
  {
    studentId: '26040101', fullName: 'Vivaan Joshi', fatherName: 'Nitin Joshi', motherName: 'Kavita Joshi', dateOfBirth: '2005-05-02', gender: 'Male', mobileNumber: '9543210876', email: 'vivaan.joshi@example.com', address: '23 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', course: 'Python Programming', batch: '01', startTime: '08:00', endTime: '10:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-07', courseDuration: '4 Months', totalCourseFee: 45000, discountPercentage: 20, finalFee: 36000, totalPaid: 18000, balance: 18000, remarks: 'Student is new to programming.', createdAt: '2026-09-07T12:20:00.000Z',
  },
  {
    studentId: '26050201', fullName: 'Ishita Verma', fatherName: 'Manoj Verma', motherName: 'Neelam Verma', dateOfBirth: '2003-09-12', gender: 'Female', mobileNumber: '9432108765', email: 'ishita.verma@example.com', address: '54 Civil Lines', city: 'Jaipur', state: 'Rajasthan', pincode: '302006', course: 'Full Stack Python', batch: '02', startTime: '14:00', endTime: '16:00', enrollmentMonth: 'October', enrollmentYear: '2026', admissionDate: '2026-10-05', courseDuration: '6 Months', totalCourseFee: 45000, discountPercentage: 10, finalFee: 40500, totalPaid: 0, balance: 40500, remarks: '', createdAt: '2026-10-05T10:00:00.000Z',
  },
  {
    studentId: '26060101', fullName: 'Arjun Das', fatherName: 'Subhash Das', motherName: 'Mira Das', dateOfBirth: '2001-12-28', gender: 'Male', mobileNumber: '9321087654', email: 'arjun.das@example.com', address: '9 Salt Lake Block B', city: 'Kolkata', state: 'West Bengal', pincode: '700091', course: 'DevOps', batch: '01', startTime: '18:00', endTime: '20:00', enrollmentMonth: 'September', enrollmentYear: '2026', admissionDate: '2026-09-12', courseDuration: '5 Months', totalCourseFee: 45000, discountPercentage: 0, finalFee: 45000, totalPaid: 25000, balance: 20000, remarks: 'Has prior Linux experience.', createdAt: '2026-09-12T14:10:00.000Z',
  },
  {
    studentId: '25060201', fullName: 'Meera Iyer', fatherName: 'Sanjay Iyer', motherName: 'Lakshmi Iyer', dateOfBirth: '2002-04-16', gender: 'Female', mobileNumber: '9210876543', email: 'meera.iyer@example.com', address: '31 T Nagar Main Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', course: 'DevOps', batch: '02', startTime: '17:00', endTime: '19:00', enrollmentMonth: 'November', enrollmentYear: '2025', admissionDate: '2025-11-08', courseDuration: '5 Months', totalCourseFee: 45000, discountPercentage: 15, finalFee: 38250, totalPaid: 38250, balance: 0, remarks: 'Course completed.', createdAt: '2025-11-08T09:00:00.000Z',
  },
]

export const mockEnrollmentRecords: EnrollmentRecord[] = mockStudents.map((student) => ({
  studentId: student.studentId,
  active: student.studentId !== '25060201',
}))