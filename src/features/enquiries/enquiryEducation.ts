import { getSpecializationOptions } from '../../config/educationOptions'
import { educationLevelOptions, getGraduationYearOptions, otherOption } from '../../config/enquiryOptions'
import type { EnquiryApiRecord, EnquiryPayload, EnquiryRecord } from '../../services/api'

const educationPrefix = '[LSA Enquiry Education v1]: '
type EducationDetails = Pick<EnquiryPayload, 'educationLevel' | 'specialization' | 'yearOfGraduation'>

function readEducationNotes(notes: string) {
  const lines = notes.split(/\r?\n/)
  const savedLines = lines.filter((line) => line.startsWith(educationPrefix))
  if (savedLines.length > 1) throw new Error('Saved enquiry education details contain duplicate entries.')
  if (!savedLines.length) return { notes, education: null }

  let value: unknown
  try {
    value = JSON.parse(savedLines[0].slice(educationPrefix.length))
  } catch (error) {
    throw new Error('Saved enquiry education details could not be read.', { cause: error })
  }
  if (!value || typeof value !== 'object'
    || !('educationLevel' in value) || typeof value.educationLevel !== 'string'
    || !('specialization' in value) || typeof value.specialization !== 'string'
    || !('yearOfGraduation' in value) || typeof value.yearOfGraduation !== 'string') {
    throw new Error('Saved enquiry education details have an invalid format.')
  }
  const education: EducationDetails = {
    educationLevel: value.educationLevel,
    specialization: value.specialization,
    yearOfGraduation: value.yearOfGraduation,
  }
  return { notes: lines.filter((line) => !line.startsWith(educationPrefix)).join('\n'), education }
}

export function normalizeEnquiryRecord(record: EnquiryApiRecord): EnquiryRecord {
  const saved = readEducationNotes(record.notes ?? '')
  return {
    ...record,
    educationLevel: record.educationLevel?.trim() || record.degreeCourse?.trim() || saved.education?.educationLevel || '',
    specialization: record.specialization?.trim() || saved.education?.specialization || '',
    yearOfGraduation: record.yearOfGraduation?.trim() || saved.education?.yearOfGraduation || '',
    otherProgramDetails: record.otherProgramDetails ?? '',
    notes: saved.notes,
  }
}

export function encodeEnquiryPayload<Payload extends EnquiryPayload>(payload: Payload) {
  const saved = readEducationNotes(payload.notes)
  const education: EducationDetails = {
    educationLevel: payload.educationLevel.trim(),
    specialization: payload.specialization.trim(),
    yearOfGraduation: payload.yearOfGraduation.trim(),
  }
  return {
    ...payload,
    ...education,
    degreeCourse: education.educationLevel,
    // Older backends only persist Degree / Course and Notes / Remarks.
    notes: [saved.notes, `${educationPrefix}${JSON.stringify(education)}`].filter(Boolean).join('\n'),
  }
}

function choice(value: string, options: readonly string[]) {
  return value && options.includes(value) ? value : value ? otherOption : ''
}

function customValue(value: string, options: readonly string[]) {
  return value && !options.includes(value) ? value : ''
}

export function getEnquiryEducationState(enquiry: EnquiryRecord | null, currentYear = new Date().getFullYear()) {
  const record = enquiry ? normalizeEnquiryRecord(enquiry) : null
  const educationLevel = record?.educationLevel ?? ''
  const educationLevelChoice = choice(educationLevel, educationLevelOptions)
  const specializationOptions = getSpecializationOptions(educationLevelChoice || otherOption)
  const graduationOptions = [...getGraduationYearOptions(currentYear), 'Currently Pursuing', otherOption]
  return {
    educationLevelChoice,
    otherEducationLevel: customValue(educationLevel, educationLevelOptions),
    specializationChoice: choice(record?.specialization ?? '', specializationOptions),
    otherSpecialization: customValue(record?.specialization ?? '', specializationOptions),
    graduationChoice: choice(record?.yearOfGraduation ?? '', graduationOptions),
    otherGraduationYear: customValue(record?.yearOfGraduation ?? '', graduationOptions),
  }
}
