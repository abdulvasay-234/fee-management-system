export const GET_ACTIONS = new Set([
  'course-codes',
  'students',
  'student',
  'payments',
  'dashboard',
  'enquiries',
  'walkins',
  'followups',
  'fee-reminders',
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
  'create-fee-reminder',
  'update-fee-reminder',
])

export function isAllowedAction(method: 'GET' | 'POST', action: string) {
  return (method === 'GET' ? GET_ACTIONS : POST_ACTIONS).has(action)
}
