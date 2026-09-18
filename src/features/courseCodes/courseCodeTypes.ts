export type CourseCodeType = 'Regular' | 'Other'

export interface CourseCode {
  id: string
  code: string
  name: string
  type: CourseCodeType
  active: boolean
}

export interface CourseCodeInput {
  code: string
  name: string
}