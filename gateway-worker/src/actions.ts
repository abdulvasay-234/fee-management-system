export const GET_ACTIONS = new Set([
  'course-codes',
  'students',
  'student',
  'payments',
  'dashboard',
  'enquiries',
  'walkins',
  'followups',
])

export const POST_ACTIONS = new Set([
  'add-course',
  'update-course',
  'delete-course',
  'add-student',
  'add-payment',
  'add-enquiry',
  'update-enquiry',
  'convert-enquiry',
  'add-walkin',
  'update-walkin',
  'mark-walkin-exit',
  'add-followup',
  'update-followup',
  'rebuild-indexes',
])

export function isAllowedAction(method: 'GET' | 'POST', action: string) {
  return (method === 'GET' ? GET_ACTIONS : POST_ACTIONS).has(action)
}
