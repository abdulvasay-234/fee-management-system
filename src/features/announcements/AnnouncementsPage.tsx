import { Copy, Megaphone, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { AuthUser } from '../../auth/AuthContext'
import { Badge, Button, Card, Input, Select, Table, Textarea } from '../../components/ui'
import { fetchStudents, type StudentRecord } from '../../services/api'
import { hasPendingSave, useIsSaving } from '../../hooks/useSaveProtection'
import { getCourseCodes, getCourseCodeServiceStatus } from '../courseCodes/courseCodeService'
import type { CourseCode } from '../courseCodes/courseCodeTypes'
import { courseNavigation, filterAdmissions, summarizeAdmissions } from '../students/studentDirectoryUtils'
import {
  announcementRecipients, announcementStorageKey, announcementWhatsAppUrl, changeQueue, changeRecipientStatus,
  createAnnouncement, isPendingRecipient, normalizeAnnouncementPhone, openAnnouncementWhatsApp,
  personalizeAnnouncement, readAnnouncementStore, saveAnnouncementStore, validateAnnouncementMessage,
  type Announcement, type AnnouncementStore, type RecipientStatus,
} from './announcementStore'

const statusLabels: Record<RecipientStatus, string> = {
  ready: 'Ready', opened: 'WhatsApp opened', sent: 'Manually marked sent',
  skipped: 'Skipped', invalid: 'Invalid number', failed: 'Failed to open',
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The announcement operation failed. Please try again.'
}

interface DuplicateDraft {
  title: string
  template: string
  studentIds: string[]
}

function Composer({ students, courses, duplicate, onCreate, onCancel }: {
  students: StudentRecord[]
  courses: CourseCode[]
  duplicate: DuplicateDraft | null
  onCreate: (input: { title: string; template: string; course: string; batch: string; query: string }, recipients: StudentRecord[]) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(1)
  const [course, setCourse] = useState('')
  const [batch, setBatch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set(duplicate?.studentIds.filter((id) => students.some((student) => student.studentId === id)) ?? []))
  const [title, setTitle] = useState(duplicate?.title ?? '')
  const [template, setTemplate] = useState(duplicate?.template ?? '')
  const [previewId, setPreviewId] = useState('')
  const [error, setError] = useState('')
  const filtered = filterAdmissions(students, { query, year: '' }, course, batch)
  const selectedStudents = filtered.filter((student) => selected.has(student.studentId))
  const courseOptions = courseNavigation(courses, students)
  const batches = Array.from(new Set(filterAdmissions(students, { query: '', year: '' }, course, '')
    .map((student) => student.batch.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10)
  const allVisibleSelected = visible.length > 0 && visible.every((student) => selected.has(student.studentId))
  const previewStudent = selectedStudents.find((student) => student.studentId === previewId) ?? selectedStudents[0]
  const validCount = selectedStudents.filter((student) => normalizeAnnouncementPhone(student.mobileNumber)).length
  const missingDuplicateRecipients = duplicate?.studentIds.filter((id) => !students.some((student) => student.studentId === id)).length ?? 0
  let preview = ''
  let previewError = ''
  if (template.trim() && previewStudent) {
    try {
      preview = personalizeAnnouncement(template, {
        name: previewStudent.fullName, course: previewStudent.course, batch: previewStudent.batch, studentId: previewStudent.studentId,
      })
    } catch (cause) { previewError = errorMessage(cause) }
  }

  function filterChanged(field: 'course' | 'batch' | 'query', value: string) {
    if (field === 'course') { setCourse(value); setBatch('') }
    if (field === 'batch') setBatch(value)
    if (field === 'query') setQuery(value)
    setSelected(new Set())
    setPage(1)
    setError('')
  }

  function toggleStudent(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current)
      visible.forEach((student) => {
        if (allVisibleSelected) next.delete(student.studentId)
        else next.add(student.studentId)
      })
      return next
    })
  }

  function nextStep() {
    setError('')
    try {
      if (!selectedStudents.length) throw new Error('Select at least one student.')
      if (step === 2) {
        if (!title.trim()) throw new Error('Enter an announcement title.')
        validateAnnouncementMessage(template)
      }
      setStep((current) => current + 1)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  return (
    <Card className="announcement-panel">
      <header className="announcement-panel__header"><h2>Create Announcement</h2><Badge variant="navy">Step {step} of 3</Badge></header>
      <p className="announcement-local-note">Drafts are saved only after review. Sending progress is saved locally for your account in this browser.</p>
      {missingDuplicateRecipients > 0 && <p role="alert">The duplicate excludes {missingDuplicateRecipients} students no longer available in current records. Review the new recipient selection.</p>}
      {step === 1 && (
        <>
          <h3>Select recipients</h3>
          <div className="announcement-filters">
            <Input id="announcementSearch" label="Search students" placeholder="Name, mobile number or student ID" value={query} onChange={(event) => filterChanged('query', event.target.value)} />
            <Select id="announcementCourse" label="Course" value={course} options={[{ label: 'All Courses', value: '' }, ...courseOptions.map((item) => ({ label: item.name, value: item.name }))]} onChange={(event) => filterChanged('course', event.target.value)} />
            <Select id="announcementBatch" label="Batch" value={batch} options={[{ label: 'All Batches', value: '' }, ...batches.map((item) => ({ label: `Batch ${item}`, value: item }))]} onChange={(event) => filterChanged('batch', event.target.value)} />
          </div>
          <p className="announcement-local-note">Changing filters clears selection. For multiple courses or batches, use All Courses / All Batches and select the students you want.</p>
          <div className="announcement-actions">
            <Button variant="secondary" disabled={!filtered.length} onClick={() => setSelected(new Set(filtered.map((student) => student.studentId)))}>Select all matching ({filtered.length})</Button>
            <Button variant="secondary" onClick={() => setSelected(new Set())}>Deselect all</Button>
            <span role="status">{selectedStudents.length} recipients selected</span>
          </div>
          <Table>
            <thead><tr><th><input type="checkbox" aria-label="Select all visible students" checked={allVisibleSelected} disabled={!visible.length} onChange={toggleVisible} /></th><th>Student</th><th>Student ID</th><th>Mobile number</th><th>Course</th><th>Batch</th><th>Enrollment status</th></tr></thead>
            <tbody>{visible.map((student) => <tr key={student.studentId}>
              <td><input type="checkbox" aria-label={`Select ${student.fullName} (${student.studentId})`} checked={selected.has(student.studentId)} onChange={() => toggleStudent(student.studentId)} /></td>
              <td>{student.fullName}</td><td>{student.studentId}</td><td>{student.mobileNumber || 'Missing'}{!normalizeAnnouncementPhone(student.mobileNumber) && <span className="announcement-invalid">Invalid number</span>}</td><td>{student.course}</td><td>{student.batch}</td><td>Not tracked</td>
            </tr>)}</tbody>
          </Table>
          {!filtered.length && <p>No students match these filters.</p>}
          <div className="announcement-actions">
            <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span>Page {currentPage} of {pageCount}</span>
            <Button variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next page</Button>
          </div>
        </>
      )}
      {step >= 2 && (
        <>
          <h3>{step === 2 ? 'Compose message' : 'Review announcement'}</h3>
          {step === 2 ? <>
            <Input id="announcementTitle" label="Announcement title / internal name" required value={title} onChange={(event) => setTitle(event.target.value)} />
            <Textarea id="announcementMessage" label="Message" required rows={8} value={template} onChange={(event) => setTemplate(event.target.value)} />
            <p className="announcement-local-note">Placeholders: {'{name}'}, {'{course}'}, {'{batch}'}, {'{student_id}'}. WhatsApp formatting such as *bold* is preserved.</p>
          </> : <><h4>{title}</h4><details><summary>Original message template</summary><pre className="announcement-message">{template}</pre></details></>}
          <p role="status">{template.length} characters · {selectedStudents.length} selected recipients</p>
          <Select id="announcementPreviewRecipient" label="Preview recipient" value={previewStudent?.studentId ?? ''} options={selectedStudents.map((student) => ({ label: `${student.fullName} (${student.studentId})`, value: student.studentId }))} onChange={(event) => setPreviewId(event.target.value)} />
          <h4>WhatsApp message preview</h4>
          <pre className="announcement-message" aria-label="Personalized message preview">{preview || 'Write a message to see the preview.'}</pre>
          {previewError && <p className="receipt-actions__error" role="alert">{previewError}</p>}
          {step === 3 && <>
            <p>{validCount} valid recipients · {selectedStudents.length - validCount} invalid numbers excluded from sending</p>
            <Table><thead><tr><th>Recipient</th><th>Mobile</th><th>Course / Batch</th><th>Validation</th></tr></thead><tbody>{selectedStudents.map((student) => <tr key={student.studentId}><td>{student.fullName}<br />{student.studentId}</td><td>{student.mobileNumber || 'Missing'}</td><td>{student.course} / {student.batch}</td><td>{normalizeAnnouncementPhone(student.mobileNumber) ? 'Ready' : 'Invalid number - not queued for sending'}</td></tr>)}</tbody></Table>
            <p className="announcement-manual-warning">WhatsApp only opens a prefilled chat. You must press Send yourself. LSA cannot verify delivery. Only contact students who expect these updates; respect WhatsApp restrictions.</p>
          </>}
        </>
      )}
      {error && <p className="receipt-actions__error" role="alert">{error}</p>}
      <footer className="announcement-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        {step > 1 && <Button variant="secondary" onClick={() => { setError(''); setStep(step - 1) }}>Back</Button>}
        {step < 3 ? <Button onClick={nextStep}>{step === 1 ? 'Compose Message' : 'Review Announcement'}</Button>
          : <Button disabled={!validCount || Boolean(previewError)} onClick={() => onCreate({ title, template, course, batch, query }, selectedStudents)}>Save Announcement &amp; Review Queue</Button>}
      </footer>
    </Card>
  )
}

function Queue({ store, announcement, onChange, onOpen, onStart }: {
  store: AnnouncementStore
  announcement: Announcement
  onChange: (transform: (current: AnnouncementStore) => AnnouncementStore) => void
  onOpen: () => void
  onStart: () => void
}) {
  const recipients = announcementRecipients(store, announcement.id)
  const current = recipients.find((recipient) => recipient.id === announcement.currentRecipientId)
  const active = announcement.status === 'active'
  const counts = (status: RecipientStatus) => recipients.filter((recipient) => recipient.status === status).length
  const pending = recipients.filter(isPendingRecipient).length
  return (
    <Card className="announcement-panel">
      <header className="announcement-panel__header"><h2>{announcement.title}</h2><Badge variant="navy">{announcement.status}</Badge></header>
      <p>{recipients.length} recipients · {recipients.filter((recipient) => recipient.phone).length} valid · {counts('invalid')} invalid · {pending} pending</p>
      <p>{counts('ready')} ready · {counts('opened')} WhatsApp opened · {counts('sent')} manually marked sent · {counts('skipped')} skipped · {counts('failed')} failed to open</p>
      <p className="announcement-manual-warning">Opening WhatsApp does not send a message. Send it manually, then mark it sent here. Next, resume and choosing a recipient never open chats automatically.</p>
      <div className="announcement-actions">
        {announcement.status !== 'completed' && <>
          {active ?
          <Button variant="secondary" onClick={() => onChange((state) => changeQueue(state, announcement.id, 'pause'))}>Pause Queue</Button>
          : announcement.status === 'paused' && recipients.every((recipient) => recipient.status === 'ready' || recipient.status === 'invalid')
          ? <Button onClick={onStart}>Start Queue &amp; Open WhatsApp</Button>
          : <Button onClick={() => onChange((state) => changeQueue(state, announcement.id, 'resume'))}>Resume Queue</Button>}
          {announcement.status !== 'stopped' && <Button variant="secondary" onClick={() => onChange((state) => changeQueue(state, announcement.id, 'stop'))}>Stop Queue</Button>}
        </>}
      </div>
      {current ? <>
        <h3>Current recipient: {current.name}</h3>
        <p>{current.studentId} · {current.mobileNumber} · {current.course} / Batch {current.batch} · {statusLabels[current.status]}</p>
        <pre className="announcement-message" aria-label="Current recipient message">{personalizeAnnouncement(announcement.template, current)}</pre>
        <div className="announcement-actions">
          <Button disabled={!active} onClick={onOpen}>{current.status === 'failed' ? 'Retry WhatsApp' : current.status === 'opened' ? 'Reopen WhatsApp' : 'Open WhatsApp'}</Button>
          <Button disabled={!active || current.status !== 'opened'} onClick={() => onChange((state) => changeRecipientStatus(state, announcement.id, current.id, 'sent'))}>Mark as Sent &amp; Next</Button>
          <Button variant="secondary" disabled={!active} onClick={() => onChange((state) => changeRecipientStatus(state, announcement.id, current.id, 'skipped'))}>Skip &amp; Next</Button>
          <Button variant="secondary" disabled={pending < 2} onClick={() => onChange((state) => changeQueue(state, announcement.id, 'next'))}>Next Recipient</Button>
        </div>
      </> : <p role="status">Queue complete. Marked sent is your manual confirmation, not a delivery receipt.</p>}
      <details><summary>Original message template</summary><pre className="announcement-message">{announcement.template}</pre></details>
      <Table><thead><tr><th>Student</th><th>Student ID</th><th>Mobile</th><th>Course</th><th>Batch</th><th>Status</th><th>Action</th></tr></thead><tbody>{recipients.map((recipient) => <tr key={recipient.id}>
        <td>{recipient.name}</td><td>{recipient.studentId}</td><td>{recipient.mobileNumber || 'Missing'}</td><td>{recipient.course}</td><td>{recipient.batch}</td><td>{statusLabels[recipient.status]}</td><td>{isPendingRecipient(recipient) && <Button variant="secondary" disabled={recipient.id === current?.id} onClick={() => onChange((state) => changeQueue(state, announcement.id, 'next', recipient.id))}>Choose</Button>}</td>
      </tr>)}</tbody></Table>
    </Card>
  )
}

function AnnouncementsModule({ user }: { user: AuthUser }) {
  const key = announcementStorageKey(user.googleSub || user.email)
  const saving = useIsSaving()
  const [loaded, setLoaded] = useState(() => {
    try { return { store: readAnnouncementStore(localStorage, key), error: '' } }
    catch (cause) { return { store: null, error: errorMessage(cause) } }
  })
  const storeRef = useRef<AnnouncementStore | null>(loaded.store)
  const [conflict, setConflict] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [courses, setCourses] = useState<CourseCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [studentError, setStudentError] = useState('')
  const [revision, setRevision] = useState(0)
  const [composer, setComposer] = useState<{ id: string; duplicate: DuplicateDraft | null } | null>(null)
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState('')

  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.storageArea === localStorage && (event.key === key || event.key === null)) setConflict(true)
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [key])

  useEffect(() => {
    let active = true
    void Promise.all([fetchStudents(), getCourseCodes(revision > 0)]).then(([records, catalog]) => {
      if (!active) return
      const status = getCourseCodeServiceStatus()
      if (status.error) throw status.error
      summarizeAdmissions(records)
      setStudents(records)
      setCourses(catalog)
    }).catch((cause: unknown) => { if (active) setStudentError(errorMessage(cause)) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [revision])

  function reloadHistory() {
    try {
      const store = readAnnouncementStore(localStorage, key)
      storeRef.current = store
      setLoaded({ store, error: '' })
      setConflict(false)
      setOperationError('')
    } catch (cause) { setLoaded((current) => ({ ...current, error: errorMessage(cause) })) }
  }

  function persist(next: AnnouncementStore) {
    if (hasPendingSave() || conflict || loaded.error) return false
    try {
      const store = saveAnnouncementStore(localStorage, key, next)
      storeRef.current = store
      setLoaded({ store, error: '' })
      setOperationError('')
      return true
    } catch (cause) { setOperationError(errorMessage(cause)); return false }
  }

  function update(transform: (current: AnnouncementStore) => AnnouncementStore) {
    if (!storeRef.current) return
    try { persist(transform(storeRef.current)) } catch (cause) { setOperationError(errorMessage(cause)) }
  }

  function openCurrent() {
    const store = storeRef.current
    const announcement = store?.announcements.find((item) => item.id === selectedAnnouncementId)
    const recipient = store && announcement ? announcementRecipients(store, announcement.id).find((item) => item.id === announcement.currentRecipientId) : null
    if (!store || !announcement || !recipient) {
      setOperationError('No current recipient is available. Select an unfinished queue from history.')
      return
    }
    try {
      const url = announcementWhatsAppUrl(announcement.template, recipient)
      if (!persist(changeRecipientStatus(store, announcement.id, recipient.id, 'opened'))) return
      try { openAnnouncementWhatsApp(url) } catch (cause) {
        const current = storeRef.current
        const saved = current && persist(changeRecipientStatus(current, announcement.id, recipient.id, 'failed'))
        setOperationError(`${errorMessage(cause)}${saved ? '' : ' The failed-open status could not be saved; reload history.'}`)
      }
    } catch (cause) { setOperationError(errorMessage(cause)) }
  }

  const store = loaded.store
  const selectedAnnouncement = store?.announcements.find((item) => item.id === selectedAnnouncementId)
  const disabled = saving || conflict || Boolean(loaded.error)

  return (
    <section className="page announcements-page">
      <header className="page__header"><div><h1 className="page__title">Announcements</h1><p className="page__description">Academic updates and manual-assisted WhatsApp messaging.</p></div><Button disabled={disabled || isLoading || Boolean(studentError) || !store} onClick={() => { setOperationError(''); setComposer({ id: crypto.randomUUID(), duplicate: null }); setSelectedAnnouncementId('') }}><Plus size={17} aria-hidden="true" />Create Announcement</Button></header>
      <p className="announcement-local-note">History is private to your signed-in account in this browser. It is not synced to Google Sheets or other devices. Clearing browser storage removes it. Enrollment status is not tracked.</p>
      {(loaded.error || conflict) && <Card className="announcement-panel"><p className="receipt-actions__error" role="alert">{loaded.error || 'History changed in another tab. Reload before continuing.'}</p><Button variant="secondary" onClick={reloadHistory}>Reload History</Button></Card>}
      {operationError && <p className="receipt-actions__error" role="alert">{operationError}</p>}
      {isLoading ? <p role="status">Loading students and courses...</p> : studentError && <p className="receipt-actions__error" role="alert">{studentError}</p>}
      <Button variant="secondary" disabled={saving || isLoading || Boolean(composer)} onClick={() => { setIsLoading(true); setStudentError(''); setRevision((value) => value + 1) }}><RefreshCw size={16} aria-hidden="true" />Refresh Students</Button>
      {store && <>
        <div className="announcement-overview">
          <Card><span>Total Announcements</span><strong>{store.announcements.length}</strong></Card>
          <Card><span>Total Recipients</span><strong>{store.recipients.length}</strong></Card>
          <Card><span>Messages Marked Sent</span><strong>{store.recipients.filter((recipient) => recipient.status === 'sent').length}</strong></Card>
          <Card><span>Pending Queues</span><strong>{store.announcements.filter((item) => item.status !== 'completed').length}</strong></Card>
        </div>
        <fieldset className="announcement-workspace" disabled={disabled}>
          {composer && <Composer key={composer.id} students={students} courses={courses} duplicate={composer.duplicate} onCancel={() => setComposer(null)} onCreate={(input, recipients) => {
            const current = storeRef.current
            if (!current) return
            try {
              const id = crypto.randomUUID()
              const next = createAnnouncement(current, { ...input, id, creator: user.email }, recipients)
              if (persist(next)) { setComposer(null); setSelectedAnnouncementId(id) }
            } catch (cause) { setOperationError(errorMessage(cause)) }
          }} />}
          {!composer && selectedAnnouncement && <Queue store={store} announcement={selectedAnnouncement} onChange={update} onOpen={openCurrent} onStart={() => {
            const current = storeRef.current
            if (!current) return
            try {
              if (persist(changeQueue(current, selectedAnnouncement.id, 'resume'))) openCurrent()
            } catch (cause) { setOperationError(errorMessage(cause)) }
          }} />}
          <Card className="announcement-panel">
            <header className="announcement-panel__header"><h2><Megaphone size={19} aria-hidden="true" /> Announcement History</h2></header>
            {!store.announcements.length ? <p>No saved announcements yet.</p> : <Table><thead><tr><th>Announcement</th><th>Created / Creator</th><th>Recipients</th><th>Original scope</th><th>Queue</th><th>Actions</th></tr></thead><tbody>{store.announcements.map((item) => <tr key={item.id}>
              <td>{item.title}</td><td>{new Date(item.createdAt).toLocaleString('en-IN')}<br />{item.creator}</td><td>{announcementRecipients(store, item.id).length}</td><td>{item.course || 'All Courses'} / {item.batch || 'All Batches'}{item.query && <><br />Search: {item.query}</>}</td><td>{item.status}</td><td><div className="announcement-actions">
                <Button variant="secondary" onClick={() => { setComposer(null); setSelectedAnnouncementId(item.id); setOperationError('') }}>View Queue</Button>
                <Button variant="secondary" disabled={isLoading || Boolean(studentError)} onClick={() => { setSelectedAnnouncementId(''); setComposer({ id: crypto.randomUUID(), duplicate: { title: `${item.title} (copy)`, template: item.template, studentIds: announcementRecipients(store, item.id).map((recipient) => recipient.studentId) } }); setOperationError('') }}><Copy size={15} aria-hidden="true" />Duplicate</Button>
              </div></td>
            </tr>)}</tbody></Table>}
          </Card>
        </fieldset>
      </>}
    </section>
  )
}

export function AnnouncementsPage() {
  const { user } = useAuth()
  if (!user) return <p role="alert">Sign in to view announcements.</p>
  return <AnnouncementsModule key={user.googleSub || user.email} user={user} />
}
