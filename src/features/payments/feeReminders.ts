import type { Announcement, AnnouncementRecipient } from '../announcements/announcementStore'
import { normalizeAnnouncementPhone, validateAnnouncementStore } from '../announcements/announcementStore'
import { formatReceiptCurrency, formatReceiptDate, nextPaymentDueDate } from './receiptActions'

export type FeeDueFilter = '' | 'due' | 'overdue' | 'upcoming' | 'never-paid' | 'partial'
export interface FeeScheduleStudent {
  studentId: string
  admissionDate: string
  totalPaid: number
  balance: number
  latestPaymentDate?: string
  paymentCount?: number
}

export interface FeeReminderRecipient extends AnnouncementRecipient {
  balance: number
  dueDate: string
  lastPaymentDate: string
  message: string
  updatedAt: string
  updatedBy: string
}

export interface FeeReminderQueue {
  announcement: Announcement
  recipients: FeeReminderRecipient[]
  revision: number
}

export type FeeReminderChange = 'pause' | 'resume' | 'stop' | 'next' | 'opened' | 'sent' | 'skipped' | 'failed'

export function feeToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function studentFeeSchedule(student: FeeScheduleStudent, today = feeToday()) {
  if (!Number.isFinite(student.balance) || !Number.isFinite(student.totalPaid)) {
    throw new Error('Financial totals are unavailable. Refresh the student records.')
  }
  if (student.balance <= 0) return { status: 'paid' as const, dueDate: null, error: '' }
  const invalidLatest = student.latestPaymentDate !== undefined && typeof student.latestPaymentDate !== 'string'
  const latest = typeof student.latestPaymentDate === 'string' ? student.latestPaymentDate.trim() : ''
  const dueDate = invalidLatest ? null : latest ? nextPaymentDueDate(latest) :
    student.totalPaid > 0 || (student.paymentCount ?? 0) > 0 ? null :
      admissionDueDate(student.admissionDate)
  if (!dueDate) return { status: 'unavailable' as const, dueDate: null, error: `Payment due date unavailable for ${student.studentId}. Check the admission/payment dates.` }
  return { status: dueDate < today ? 'overdue' as const : dueDate === today ? 'due' as const : 'upcoming' as const, dueDate, error: '' }
}

function admissionDueDate(value: string) {
  if (typeof value !== 'string') return null
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (usDate) {
    return nextPaymentDueDate(`${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`, 0)
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && nextPaymentDueDate(value.slice(0, 10), 0)) {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? nextPaymentDueDate(feeToday(date), 0) : null
  }
  return nextPaymentDueDate(value.trim(), 0)
}

export function filterFeeSchedule<T extends FeeScheduleStudent>(students: T[], filter: FeeDueFilter, today = feeToday()) {
  return students.filter((student) => {
    if (!filter) return true
    if (student.balance <= 0) return false
    if (filter === 'never-paid') return student.totalPaid === 0 && !student.latestPaymentDate && !(student.paymentCount ?? 0)
    if (filter === 'partial') return student.totalPaid > 0
    const schedule = studentFeeSchedule(student, today)
    return filter === 'due' ? schedule.status === 'due' || schedule.status === 'overdue' : schedule.status === filter
  })
}

export function feeReminderMessage(recipient: Pick<FeeReminderRecipient, 'name' | 'studentId' | 'course' | 'batch' | 'balance' | 'dueDate'>) {
  return `LSA FEE PAYMENT REMINDER

Dear ${recipient.name},

Admission Number: ${recipient.studentId}
Course: ${recipient.course}
Batch: ${recipient.batch}
Pending Balance: ${formatReceiptCurrency(recipient.balance)}
Payment Due Date: ${formatReceiptDate(recipient.dueDate)}

Please pay your pending course fees by the due date. If the date has passed, please contact the LSA office and arrange payment promptly.
After each payment, the next payment is due 20 days later while a balance remains.
If you have already paid, please share your receipt with the LSA office for verification.

Lords Skill Academy`
}

export function feeReminderWhatsAppUrl(recipient: FeeReminderRecipient) {
  if (!recipient.phone || recipient.phone !== normalizeAnnouncementPhone(recipient.mobileNumber)) throw new Error('This recipient has an invalid mobile number.')
  return `https://wa.me/${recipient.phone}?text=${encodeURIComponent(recipient.message)}`
}

function isFeeReminderRecipient(recipient: AnnouncementRecipient): recipient is FeeReminderRecipient {
  return 'balance' in recipient && typeof recipient.balance === 'number' && Number.isFinite(recipient.balance) && recipient.balance > 0
    && 'dueDate' in recipient && typeof recipient.dueDate === 'string' && Boolean(nextPaymentDueDate(recipient.dueDate, 0))
    && 'message' in recipient && typeof recipient.message === 'string' && Boolean(recipient.message.trim())
    && 'updatedAt' in recipient && typeof recipient.updatedAt === 'string' && Number.isFinite(Date.parse(recipient.updatedAt))
    && 'updatedBy' in recipient && typeof recipient.updatedBy === 'string' && Boolean(recipient.updatedBy.trim())
    && 'lastPaymentDate' in recipient && typeof recipient.lastPaymentDate === 'string'
    && (!recipient.lastPaymentDate || Boolean(nextPaymentDueDate(recipient.lastPaymentDate, 0)))
}

export function validateFeeReminderQueue(value: unknown): FeeReminderQueue {
  if (!value || typeof value !== 'object' || !('announcement' in value) || !('recipients' in value) || !('revision' in value)) {
    throw new Error('The API returned invalid fee reminder details.')
  }
  const store = validateAnnouncementStore(JSON.stringify({ version: 1, revision: value.revision, announcements: [value.announcement], recipients: value.recipients }))
  const recipients = store.recipients
  if (!recipients.every(isFeeReminderRecipient)) throw new Error('The API returned invalid fee reminder details.')
  return { announcement: store.announcements[0], recipients, revision: store.revision }
}
