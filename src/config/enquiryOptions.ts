export const otherOption = 'Other'

export const enquiryStatuses = [
  'New',
  'Follow-up',
  'Converted',
  'Not Interested',
] as const

export const educationLevelOptions = [
  'B.Tech',
  'B.E.',
  'BCA',
  'B.Sc.',
  'B.Com',
  'M.Tech',
  'M.E.',
  'MCA',
  'M.Sc.',
  'MBA',
  otherOption,
] as const

export const referralOptions = [
  'Website',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'Google Search',
  'WhatsApp',
  'Friend / Referral',
  'College',
  'Walk-in',
  'Event',
  'Existing Student',
  otherOption,
] as const

export const consultantOptions = [
  'Admissions Team',
  'Counselling Team',
  'LSA Staff',
  'Faculty',
  'Management',
  otherOption,
] as const

export function getGraduationYearOptions(currentYear = new Date().getFullYear()) {
  return Array.from({ length: 9 }, (_, index) => String(currentYear - 4 + index))
}