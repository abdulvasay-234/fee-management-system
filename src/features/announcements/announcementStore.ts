import type { StudentRecord } from '../../services/api'
import { normalizeWhatsAppNumber } from '../payments/receiptActions'

export type RecipientStatus = 'ready' | 'opened' | 'sent' | 'skipped' | 'invalid' | 'failed'
export type QueueStatus = 'active' | 'paused' | 'stopped' | 'completed'

export interface Announcement {
  id: string
  title: string
  template: string
  createdAt: string
  creator: string
  course: string
  batch: string
  query: string
  status: QueueStatus
  currentRecipientId: string | null
}

export interface AnnouncementRecipient {
  id: string
  announcementId: string
  studentId: string
  name: string
  mobileNumber: string
  phone: string | null
  course: string
  batch: string
  status: RecipientStatus
}

export interface AnnouncementStore {
  version: 1
  revision: number
  announcements: Announcement[]
  recipients: AnnouncementRecipient[]
}

const recipientStatuses: readonly string[] = ['ready', 'opened', 'sent', 'skipped', 'invalid', 'failed']
const queueStatuses: readonly string[] = ['active', 'paused', 'stopped', 'completed']
const placeholders = ['name', 'course', 'batch', 'student_id']

export function emptyAnnouncementStore(): AnnouncementStore {
  return { version: 1, revision: 0, announcements: [], recipients: [] }
}

export function announcementStorageKey(adminId: string) {
  if (!adminId.trim()) throw new Error('A signed-in administrator is required for announcement history.')
  return `lsa:announcements:v1:${adminId}`
}

export function normalizeAnnouncementPhone(value: string) {
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) return null
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  const phone = normalizeWhatsAppNumber(digits)
  if (!phone || !/^[1-9]\d{10,14}$/.test(phone)) return null
  if (phone.startsWith('91') && phone.length === 12 && !/^[6-9]\d{9}$/.test(phone.slice(2))) return null
  return phone
}

export function validateAnnouncementMessage(template: string) {
  if (!template.trim()) throw new Error('Enter an announcement message.')
  const unknown = Array.from(template.matchAll(/\{([^{}]*)\}/g), (match) => match[1])
    .filter((name) => !placeholders.includes(name))
  if (unknown.length) throw new Error(`Unknown placeholders: ${Array.from(new Set(unknown)).map((name) => `{${name}}`).join(', ')}.`)
  if (/[{}]/.test(template.replace(/\{(name|course|batch|student_id)\}/g, ''))) throw new Error('Check the message placeholders for missing or extra braces.')
}

export function personalizeAnnouncement(template: string, recipient: Pick<AnnouncementRecipient, 'name' | 'course' | 'batch' | 'studentId'>) {
  validateAnnouncementMessage(template)
  const values: Record<string, string> = {
    name: recipient.name, course: recipient.course, batch: recipient.batch, student_id: recipient.studentId,
  }
  return template.replace(/\{(name|course|batch|student_id)\}/g, (_, key: string) => values[key])
}

export function announcementWhatsAppUrl(template: string, recipient: AnnouncementRecipient) {
  if (!recipient.phone || normalizeAnnouncementPhone(recipient.mobileNumber) !== recipient.phone) throw new Error('This recipient has an invalid mobile number.')
  return `https://wa.me/${recipient.phone}?text=${encodeURIComponent(personalizeAnnouncement(template, recipient))}`
}

export function announcementRecipients(store: AnnouncementStore, announcementId: string) {
  return store.recipients.filter((recipient) => recipient.announcementId === announcementId)
}

export function isPendingRecipient(recipient: AnnouncementRecipient) {
  return recipient.status === 'ready' || recipient.status === 'opened' || recipient.status === 'failed'
}

export function createAnnouncement(
  store: AnnouncementStore,
  input: { id: string; title: string; template: string; creator: string; course: string; batch: string; query: string },
  students: Pick<StudentRecord, 'studentId' | 'fullName' | 'mobileNumber' | 'course' | 'batch'>[],
  now = new Date(),
): AnnouncementStore {
  if (!input.title.trim()) throw new Error('Enter an announcement title.')
  validateAnnouncementMessage(input.template)
  if (!students.length) throw new Error('Select at least one student.')
  if (!input.id || store.announcements.some((announcement) => announcement.id === input.id)) throw new Error('The announcement ID is missing or already exists.')
  const ids = new Set<string>()
  const recipients: AnnouncementRecipient[] = students.map((student) => {
    if (!student.studentId.trim() || ids.has(student.studentId)) throw new Error('Selected students contain missing or duplicate IDs. Refresh the student list.')
    if (!student.fullName.trim() || !student.course.trim()) throw new Error('A selected student is missing their name or course.')
    ids.add(student.studentId)
    const phone = normalizeAnnouncementPhone(student.mobileNumber)
    return {
      id: `${input.id}:${student.studentId}`, announcementId: input.id, studentId: student.studentId,
      name: student.fullName, mobileNumber: student.mobileNumber, phone,
      course: student.course, batch: student.batch, status: phone ? 'ready' : 'invalid',
    }
  })
  const first = recipients.find(isPendingRecipient)
  if (!first) throw new Error('No selected students have valid mobile numbers. Correct the records before starting a queue.')
  return {
    ...store,
    announcements: [{ ...input, title: input.title.trim(), createdAt: now.toISOString(), status: 'paused', currentRecipientId: first.id }, ...store.announcements],
    recipients: [...store.recipients, ...recipients],
  }
}

function findAnnouncement(store: AnnouncementStore, id: string) {
  const announcement = store.announcements.find((item) => item.id === id)
  if (!announcement) throw new Error('The announcement could not be found. Reload history.')
  return announcement
}

export function changeQueue(store: AnnouncementStore, id: string, action: 'pause' | 'resume' | 'stop' | 'next', recipientId?: string): AnnouncementStore {
  const announcement = findAnnouncement(store, id)
  const recipients = announcementRecipients(store, id)
  const pending = recipients.filter(isPendingRecipient)
  if (!pending.length) throw new Error('This announcement queue is complete.')
  let currentRecipientId = announcement.currentRecipientId
  let status = announcement.status
  if (recipientId) {
    if (!pending.some((recipient) => recipient.id === recipientId)) throw new Error('This recipient cannot be reopened in this queue. Duplicate the announcement to send again.')
    currentRecipientId = recipientId
  } else if (action === 'next') {
    const index = pending.findIndex((recipient) => recipient.id === currentRecipientId)
    currentRecipientId = pending[(index + 1) % pending.length].id
  } else {
    status = action === 'resume' ? 'active' : action === 'stop' ? 'stopped' : 'paused'
  }
  return { ...store, announcements: store.announcements.map((item) => item.id === id ? { ...item, status, currentRecipientId } : item) }
}

export function changeRecipientStatus(store: AnnouncementStore, id: string, recipientId: string, status: 'opened' | 'sent' | 'skipped' | 'failed'): AnnouncementStore {
  const announcement = findAnnouncement(store, id)
  if (announcement.status !== 'active') throw new Error('Start or resume the queue before changing recipient progress.')
  const recipient = announcementRecipients(store, id).find((item) => item.id === recipientId)
  if (!recipient || !isPendingRecipient(recipient)) throw new Error('This recipient cannot be changed or sent again in this queue.')
  if (recipient.id !== announcement.currentRecipientId) throw new Error('Choose this recipient before updating their progress.')
  if (status === 'sent' && recipient.status !== 'opened') throw new Error('Open WhatsApp first, then manually confirm that you sent the message.')
  const recipients = store.recipients.map((item) => item.id === recipientId ? { ...item, status } : item)
  const pending = announcementRecipients({ ...store, recipients }, id).filter(isPendingRecipient)
  const currentIndex = store.recipients.findIndex((item) => item.id === recipient.id)
  const next = pending.find((item) => store.recipients.findIndex((original) => original.id === item.id) > currentIndex) ?? pending[0]
  const terminal = status === 'sent' || status === 'skipped'
  return {
    ...store, recipients,
    announcements: store.announcements.map((item) => item.id === id ? {
      ...item,
      status: pending.length ? item.status : 'completed',
      currentRecipientId: terminal ? next?.id ?? null : item.currentRecipientId,
    } : item),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isAnnouncement(value: unknown): value is Announcement {
  return isObject(value) && ['id', 'title', 'template', 'createdAt', 'creator', 'course', 'batch', 'query'].every((key) => typeof value[key] === 'string')
    && typeof value.status === 'string' && queueStatuses.includes(value.status)
    && (value.currentRecipientId === null || typeof value.currentRecipientId === 'string')
}

function isRecipient(value: unknown): value is AnnouncementRecipient {
  return isObject(value) && ['id', 'announcementId', 'studentId', 'name', 'mobileNumber', 'course', 'batch'].every((key) => typeof value[key] === 'string')
    && (value.phone === null || typeof value.phone === 'string')
    && typeof value.status === 'string' && recipientStatuses.includes(value.status)
}

export function validateAnnouncementStore(raw: string | null): AnnouncementStore {
  if (raw === null) return emptyAnnouncementStore()
  let value: unknown
  try { value = JSON.parse(raw) } catch (cause) { throw new Error('Announcement history contains unreadable data. Do not overwrite it.', { cause }) }
  if (!isObject(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || typeof value.revision !== 'number' || value.revision < 0
    || !Array.isArray(value.announcements) || !value.announcements.every(isAnnouncement)
    || !Array.isArray(value.recipients) || !value.recipients.every(isRecipient)) throw new Error('Announcement history has an invalid format. Do not overwrite it.')
  const store: AnnouncementStore = { version: 1, revision: value.revision, announcements: value.announcements, recipients: value.recipients }
  const announcementIds = new Set(store.announcements.map((item) => item.id))
  const recipientIds = new Set(store.recipients.map((item) => item.id))
  if (announcementIds.size !== store.announcements.length || recipientIds.size !== store.recipients.length
    || store.recipients.some((item) => !announcementIds.has(item.announcementId) || !item.studentId.trim() || !item.name.trim() || !item.course.trim() || item.phone !== normalizeAnnouncementPhone(item.mobileNumber)
      || (item.status === 'invalid') !== (item.phone === null))) throw new Error('Announcement history contains inconsistent recipients.')
  for (const announcement of store.announcements) {
    validateAnnouncementMessage(announcement.template)
    const recipients = announcementRecipients(store, announcement.id)
    const pending = recipients.filter(isPendingRecipient)
    if (!announcement.id || !announcement.title.trim() || !Number.isFinite(Date.parse(announcement.createdAt)) || !recipients.length
      || new Set(recipients.map((item) => item.studentId)).size !== recipients.length
      || (announcement.status === 'completed') !== (pending.length === 0)
      || (pending.length > 0 && !pending.some((item) => item.id === announcement.currentRecipientId))
      || (!pending.length && announcement.currentRecipientId !== null)) throw new Error('Announcement history contains inconsistent queue progress.')
  }
  return store
}

export function readAnnouncementStore(storage: Pick<Storage, 'getItem'>, key: string): AnnouncementStore {
  const store = validateAnnouncementStore(storage.getItem(key))
  return { ...store, announcements: store.announcements.map((item) => item.status === 'active' ? { ...item, status: 'paused' } : item) }
}

export function saveAnnouncementStore(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, store: AnnouncementStore): AnnouncementStore {
  const current = validateAnnouncementStore(storage.getItem(key))
  if (current.revision !== store.revision) throw new Error('Announcement history changed in another tab. Reload history before continuing.')
  const next = { ...store, revision: store.revision + 1 }
  validateAnnouncementStore(JSON.stringify(next))
  storage.setItem(key, JSON.stringify(next))
  return next
}

let whatsappWindow: Window | null = null

export function prepareAnnouncementWhatsApp() {
  if (!whatsappWindow || whatsappWindow.closed) {
    whatsappWindow = window.open('about:blank', '_blank')
    if (!whatsappWindow) throw new Error('WhatsApp could not open. Allow pop-ups for LSA Connect, then retry.')
    whatsappWindow.opener = null
  }
  return whatsappWindow
}

export function openAnnouncementWhatsApp(url: string) {
  if (!url.startsWith('https://wa.me/')) throw new Error('Invalid WhatsApp chat URL.')
  const chat = prepareAnnouncementWhatsApp()
  chat.location.href = url
  chat.focus()
}
