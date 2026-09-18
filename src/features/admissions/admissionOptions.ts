import { getRegularCourseOptions } from '../courseCodes/courseCodeService'

export function getAdmissionCourseOptions() {
  return [
    { label: 'Select Course', value: '' },
    ...getRegularCourseOptions(),
  ]
}

export const courseDurationOptions = [
  { label: 'Select duration', value: '' },
  { label: '1 Month', value: '1 Month' },
  { label: '2 Months', value: '2 Months' },
  { label: '3 Months', value: '3 Months' },
  { label: '4 Months', value: '4 Months' },
  { label: '5 Months', value: '5 Months' },
  { label: '6 Months', value: '6 Months' },
  { label: '7 Months', value: '7 Months' },
  { label: '8 Months', value: '8 Months' },
]

export const genderOptions = [
  { label: 'Select gender', value: '' },
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
]