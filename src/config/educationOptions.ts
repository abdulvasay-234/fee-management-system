import { otherOption } from './enquiryOptions'

export const specializationOptionsByEducationLevel: Record<string, readonly string[]> = {
  'School / 10th': ['General'],
  'Intermediate / 12th': ['General'],
  Diploma: ['General', 'Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', otherOption],
  'B.Tech': ['CSE', 'CSE (AI & ML)', 'CSE (Data Science)', 'Information Technology', 'ECE', 'EEE', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', otherOption],
  'B.E.': ['CSE', 'Information Technology', 'ECE', 'EEE', 'Mechanical Engineering', 'Civil Engineering', otherOption],
  BCA: ['Computer Applications', 'General', otherOption],
  'B.Sc.': ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Statistics', 'Biotechnology', otherOption],
  'B.Com': ['General', 'Computers', 'Computer Applications', 'Honours', otherOption],
  BBA: ['General', 'Finance', 'Marketing', 'Human Resources', 'Business Analytics', otherOption],
  BBM: ['General', 'Finance', 'Marketing', 'Human Resources', 'Business Analytics', otherOption],
  BA: ['General', 'Economics', 'English', 'Psychology', 'Political Science', otherOption],
  'B.Pharm': ['General', 'Pharmaceutics', 'Pharmacology', 'Pharmaceutical Chemistry', otherOption],
  MBBS: ['General'],
  BDS: ['General'],
  MBA: ['Finance', 'Marketing', 'Human Resources', 'Business Analytics', 'Operations', 'IT / Systems', 'Entrepreneurship', otherOption],
  MCA: ['Computer Applications', 'General', otherOption],
  'M.Tech': ['Computer Science & Engineering', 'AI & ML', 'Data Science', 'VLSI', 'Embedded Systems', 'Power Systems', otherOption],
  'M.E.': ['General', 'Computer Science & Engineering', 'Information Technology', 'ECE', 'EEE', otherOption],
  'M.Sc.': ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Statistics', 'Biotechnology', otherOption],
  'M.Com': ['General', 'Finance', 'Accounting', otherOption],
  MA: ['General', 'Economics', 'English', 'Psychology', 'Political Science', otherOption],
  [otherOption]: ['General', otherOption],
}

export function getSpecializationOptions(educationLevel: string) {
  return specializationOptionsByEducationLevel[educationLevel] ?? ['General', otherOption]
}