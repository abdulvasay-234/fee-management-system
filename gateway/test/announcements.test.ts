import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  announcementRecipients, announcementStorageKey, announcementWhatsAppUrl, changeQueue, changeRecipientStatus,
  createAnnouncement, emptyAnnouncementStore, normalizeAnnouncementPhone, openAnnouncementWhatsApp,
  personalizeAnnouncement, readAnnouncementStore, saveAnnouncementStore,
} = await import(fileURLToPath(new URL('../../src/features/announcements/announcementStore.ts', import.meta.url)))

const students = [
  { studentId: 'TEST-001', fullName: 'Test A & B', mobileNumber: '90000 00001', course: 'Data Science', batch: '01' },
  { studentId: 'TEST-002', fullName: 'Test Two', mobileNumber: '+91 90000 00002', course: 'Cyber Security', batch: '02' },
  { studentId: 'TEST-003', fullName: 'Invalid Test', mobileNumber: 'abc9000000003', course: 'Data Science', batch: '01' },
]
const input = {
  id: 'announcement-1', title: 'Class update', template: 'Hello {name},\n{course} / {batch} / {student_id}\n*Notice* & updates?',
  creator: 'staff@example.test', course: '', batch: '', query: '',
}

function fixture() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) },
  }
}

let popup: { closed: boolean; opener: unknown; location: { href: string }; focus: () => void } | null = null
afterEach(() => {
  if (popup) popup.closed = true
  vi.unstubAllGlobals()
})

describe('announcement recipient validation and personalization', () => {
  it.each([
    ['90000 00001', '919000000001'], ['09000000001', '919000000001'],
    ['+91 (90000) 00001', '919000000001'], ['0091 9000000001', '919000000001'],
    ['+1 212 555 0100', '12125550100'], ['', null], ['9000000001abc', null],
    ['1234567890', null], ['000000000000', null], ['123', null],
  ])('normalizes "%s" safely', (value, expected) => {
    expect(normalizeAnnouncementPhone(value)).toBe(expected)
  })

  it('resolves every placeholder independently and encodes the exact personalized message', () => {
    const store = createAnnouncement(emptyAnnouncementStore(), input, students)
    const [first, second, invalid] = announcementRecipients(store, input.id)
    const url = new URL(announcementWhatsAppUrl(input.template, first))
    expect(url.origin + url.pathname).toBe('https://wa.me/919000000001')
    expect(url.searchParams.get('text')).toBe('Hello Test A & B,\nData Science / 01 / TEST-001\n*Notice* & updates?')
    expect(personalizeAnnouncement(input.template, second)).toContain('Cyber Security / 02 / TEST-002')
    expect(personalizeAnnouncement('Hi {name} in {course}', { ...first, name: 'Test $& {course}' })).toBe('Hi Test $& {course} in Data Science')
    expect(() => announcementWhatsAppUrl(input.template, invalid)).toThrow('invalid mobile')
    expect(() => personalizeAnnouncement('Hello {naem}', first)).toThrow('Unknown placeholders')
    expect(() => personalizeAnnouncement('Hello {name', first)).toThrow('braces')
  })

  it('rejects empty recipients, duplicate IDs and all-invalid queues without creating records', () => {
    expect(() => createAnnouncement(emptyAnnouncementStore(), input, [])).toThrow('Select at least')
    expect(() => createAnnouncement(emptyAnnouncementStore(), input, [students[0], students[0]])).toThrow('duplicate IDs')
    expect(() => createAnnouncement(emptyAnnouncementStore(), input, [students[2]])).toThrow('No selected students')
  })
})

describe('manual announcement queues and local persistence', () => {
  it('requires an opened chat before manual sent confirmation and excludes invalid recipients from progress', () => {
    let store = createAnnouncement(emptyAnnouncementStore(), input, students)
    const [first, second, invalid] = store.recipients
    expect(() => changeRecipientStatus(store, input.id, first.id, 'opened')).toThrow('resume')
    store = changeQueue(store, input.id, 'resume')
    expect(() => changeRecipientStatus(store, input.id, first.id, 'sent')).toThrow('Open WhatsApp first')
    expect(() => changeQueue(store, input.id, 'next', invalid.id)).toThrow('cannot be reopened')
    store = changeRecipientStatus(store, input.id, first.id, 'opened')
    store = changeRecipientStatus(store, input.id, first.id, 'sent')
    expect(store.announcements[0].currentRecipientId).toBe(second.id)
    store = changeRecipientStatus(store, input.id, second.id, 'skipped')
    expect(store.announcements[0]).toMatchObject({ status: 'completed', currentRecipientId: null })
    expect(store.recipients.map((recipient: { status: string }) => recipient.status)).toEqual(['sent', 'skipped', 'invalid'])
    expect(() => changeRecipientStatus(store, input.id, first.id, 'opened')).toThrow()
  })

  it('next, pause, stop and resume preserve opened/failed states without opening or marking messages sent', () => {
    let store = changeQueue(createAnnouncement(emptyAnnouncementStore(), input, students), input.id, 'resume')
    const [first, second] = store.recipients
    store = changeRecipientStatus(store, input.id, first.id, 'opened')
    store = changeQueue(store, input.id, 'next')
    expect(store.announcements[0].currentRecipientId).toBe(second.id)
    store = changeRecipientStatus(store, input.id, second.id, 'failed')
    store = changeQueue(store, input.id, 'pause')
    expect(() => changeRecipientStatus(store, input.id, second.id, 'opened')).toThrow('resume')
    store = changeQueue(store, input.id, 'resume')
    store = changeQueue(store, input.id, 'stop')
    store = changeQueue(store, input.id, 'resume')
    expect(store.recipients.map((recipient: { status: string }) => recipient.status)).toEqual(['opened', 'failed', 'invalid'])
  })

  it('restores local history, personalized snapshots and progress as paused after refresh, separately for each admin', () => {
    const storage = fixture()
    const key = announcementStorageKey('admin-one')
    let store = changeQueue(createAnnouncement(emptyAnnouncementStore(), input, students), input.id, 'resume')
    store = changeRecipientStatus(store, input.id, store.recipients[0].id, 'opened')
    const saved = saveAnnouncementStore(storage, key, store)
    const restored = readAnnouncementStore(storage, key)
    expect(restored.announcements[0]).toMatchObject({ template: input.template, status: 'paused' })
    expect(restored.recipients).toEqual(saved.recipients)
    expect(readAnnouncementStore(storage, announcementStorageKey('admin-two')).announcements).toEqual([])
    const copy = createAnnouncement(restored, { ...input, id: 'announcement-copy' }, students)
    expect(announcementRecipients(copy, input.id)[0].status).toBe('opened')
    expect(announcementRecipients(copy, 'announcement-copy')[0].status).toBe('ready')
    expect(copy.announcements).toHaveLength(2)
  })

  it('surfaces corrupt history, storage failures and conflicting updates instead of replacing saved history', () => {
    const storage = fixture()
    const key = announcementStorageKey('admin-one')
    storage.setItem(key, '{broken')
    expect(() => readAnnouncementStore(storage, key)).toThrow('unreadable')
    expect(() => saveAnnouncementStore(storage, key, emptyAnnouncementStore())).toThrow('unreadable')
    storage.setItem(key, JSON.stringify(emptyAnnouncementStore()))
    const draft = createAnnouncement(emptyAnnouncementStore(), input, students)
    const saved = saveAnnouncementStore(storage, key, draft)
    expect(() => saveAnnouncementStore(storage, key, draft)).toThrow('another tab')
    expect(readAnnouncementStore(storage, key).revision).toBe(saved.revision)
    expect(() => saveAnnouncementStore({ ...storage, setItem: () => { throw new Error('Storage quota exceeded') } }, key, saved)).toThrow('quota')
    const corrupt = { ...saved, recipients: saved.recipients.map((recipient: { status: string }) => ({ ...recipient, status: 'sent' })) }
    storage.setItem(key, JSON.stringify(corrupt))
    expect(() => readAnnouncementStore(storage, key)).toThrow('inconsistent')
  })

  it('reports blocked popups and reuses one safe chat window only when explicitly opened', () => {
    const open = vi.fn(() => null)
    vi.stubGlobal('window', { open })
    expect(() => openAnnouncementWhatsApp('https://wa.me/919000000001?text=Hello')).toThrow('Allow pop-ups')
    popup = { closed: false, opener: {}, location: { href: '' }, focus: vi.fn() }
    vi.stubGlobal('window', { open: vi.fn(() => popup) })
    openAnnouncementWhatsApp('https://wa.me/919000000001?text=Hello')
    expect(popup.opener).toBeNull()
    openAnnouncementWhatsApp('https://wa.me/919000000002?text=Next')
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(popup.location.href).toBe('https://wa.me/919000000002?text=Next')
  })
})
