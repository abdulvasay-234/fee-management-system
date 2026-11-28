import { useEffect, useRef, useState } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { Button, Card, Table } from '../../components/ui'
import { createFeeReminder, fetchFeeReminders, updateFeeReminder } from '../../services/api'
import { useSaveProtection } from '../../hooks/useSaveProtection'
import { AnnouncementQueue } from '../announcements/AnnouncementQueue'
import { prepareAnnouncementWhatsApp } from '../announcements/announcementStore'
import type { Student } from '../students/studentTypes'
import {
  feeReminderMessage, feeReminderWhatsAppUrl, studentFeeSchedule,
  type FeeReminderChange, type FeeReminderQueue,
} from './feeReminders'
import { normalizeAnnouncementPhone } from '../announcements/announcementStore'
import { formatReceiptCurrency, formatReceiptDate } from './receiptActions'

type ReminderUpdate = Parameters<typeof updateFeeReminder>[0]
function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The fee reminder operation failed. Please try again.'
}

export function SharedFeeReminders({ selectedStudents, onSelectionReset, onLockedChange }: {
  selectedStudents: Student[]
  onSelectionReset: () => void
  onLockedChange: (locked: boolean) => void
}) {
  const [history, setHistory] = useState<FeeReminderQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [selectedQueueId, setSelectedQueueId] = useState('')
  const [pendingCreate, setPendingCreate] = useState<{ id: string; studentIds: string[] } | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<ReminderUpdate | null>(null)
  const queueRef = useRef<FeeReminderQueue | null>(null)
  const mounted = useRef(true)
  const { isSaving, startSaving, finishSaving } = useSaveProtection()

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { onLockedChange(Boolean(pendingCreate || pendingUpdate)) }, [pendingCreate, pendingUpdate, onLockedChange])
  useEffect(() => {
    let active = true
    void fetchFeeReminders().then((queues) => {
      if (!active) return
      setHistory(queues)
      setHistoryError('')
    }).catch((cause: unknown) => { if (active) setHistoryError(errorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function refreshHistory() {
    if (isSaving || loading) return
    setLoading(true)
    setError('')
    try {
      const queues = await fetchFeeReminders()
      if (!mounted.current) return
      setHistory(queues)
      setHistoryError('')
      setPendingUpdate(null)
      const saved = queues.find((queue) => queue.announcement.id === (pendingCreate?.id ?? queueRef.current?.announcement.id))
      queueRef.current = saved ?? null
      if (saved) {
        setSelectedQueueId(saved.announcement.id)
        if (pendingCreate) { setPendingCreate(null); onSelectionReset() }
      }
    } catch (cause) { if (mounted.current) setHistoryError(errorMessage(cause)) }
    finally { if (mounted.current) setLoading(false) }
  }

  function remember(queue: FeeReminderQueue) {
    queueRef.current = queue
    if (!mounted.current) return
    setSelectedQueueId(queue.announcement.id)
    setHistory((current) => [queue, ...current.filter((item) => item.announcement.id !== queue.announcement.id)])
  }

  async function saveQueue() {
    if (pendingUpdate || historyError || loading || !startSaving()) return
    const request = pendingCreate ?? { id: crypto.randomUUID(), studentIds: selectedStudents.map((student) => student.studentId) }
    setPendingCreate(request)
    setError('')
    try {
      const queue = await createFeeReminder(request.id, request.studentIds)
      remember(queue)
      if (mounted.current) { setPendingCreate(null); onSelectionReset() }
    } catch (cause) { if (mounted.current) setError(errorMessage(cause)) }
    finally { finishSaving() }
  }

  async function sendUpdate(change: FeeReminderChange, recipientId?: string) {
    const queue = queueRef.current
    if (!queue) throw new Error('Choose a saved fee reminder queue first.')
    const request: ReminderUpdate = { id: queue.announcement.id, revision: queue.revision, operationId: crypto.randomUUID(), change, recipientId }
    setPendingUpdate(request)
    const saved = await updateFeeReminder(request)
    remember(saved)
    if (mounted.current) setPendingUpdate(null)
    return saved
  }

  async function changeQueue(change: FeeReminderChange, recipientId?: string) {
    if (pendingCreate || pendingUpdate || loading || historyError || !startSaving()) return
    setError('')
    try { await sendUpdate(change, recipientId) }
    catch (cause) { if (mounted.current) setError(errorMessage(cause)) }
    finally { finishSaving() }
  }

  async function recoverUpdate() {
    if (!pendingUpdate || !startSaving()) return
    setError('')
    try {
      remember(await updateFeeReminder(pendingUpdate))
      if (mounted.current) setPendingUpdate(null)
    } catch (cause) { if (mounted.current) setError(errorMessage(cause)) }
    finally { finishSaving() }
  }

  async function openCurrent(start = false) {
    const queue = queueRef.current
    const recipient = queue?.recipients.find((item) => item.id === queue.announcement.currentRecipientId)
    if (!queue || !recipient || pendingCreate || pendingUpdate || loading || historyError || !startSaving()) return
    setError('')
    let chat: Window | null = null
    let popupError = ''
    try { chat = prepareAnnouncementWhatsApp() } catch (cause) { popupError = errorMessage(cause) }
    try {
      if (start) await sendUpdate('resume')
      if (!chat) {
        await sendUpdate('failed', recipient.id)
        throw new Error(popupError)
      }
      const saved = await sendUpdate('opened', recipient.id)
      const checked = saved.recipients.find((item) => item.id === recipient.id)
      if (!checked) throw new Error('The saved reminder recipient is unavailable. Refresh history.')
      chat.location.href = feeReminderWhatsAppUrl(checked)
      chat.focus()
    } catch (cause) { if (mounted.current) setError(errorMessage(cause)) }
    finally { finishSaving() }
  }

  const selectedQueue = history.find((queue) => queue.announcement.id === selectedQueueId)
  const blocked = isSaving || Boolean(pendingCreate || pendingUpdate) || loading || Boolean(historyError)
  const validCount = selectedStudents.filter((student) => normalizeAnnouncementPhone(student.mobileNumber)).length
  const preview = selectedStudents[0]
  const previewDue = preview && studentFeeSchedule(preview).dueDate
  const recipientsById = new Map(selectedQueue?.recipients.map((recipient) => [recipient.id, recipient]))
  function recipientDetails(id: string) {
    const recipient = recipientsById.get(id)
    if (!recipient) throw new Error('Fee reminder recipient details are unavailable. Refresh history.')
    return recipient
  }

  return (
    <section className="fee-reminders" aria-label="Shared fee reminders">
      <Card className="announcement-panel">
        <header className="announcement-panel__header"><h2><MessageCircle size={19} aria-hidden="true" />WhatsApp Fee Reminders</h2>
          <Button variant="secondary" disabled={isSaving || loading} onClick={() => void refreshHistory()}><RefreshCw size={16} aria-hidden="true" />Refresh Reminder History</Button>
        </header>
        <p>Reminder history is saved in Google Sheets and shared across administrators and devices. WhatsApp sending is manual; marking sent is not delivery confirmation.</p>
        {loading && <p role="status">Loading shared reminder history...</p>}
        {historyError && <p className="receipt-actions__error" role="alert">{historyError}</p>}
        {error && <p className="receipt-actions__error" role="alert">{error}</p>}
        {pendingCreate && <p role="alert">The creation result needs confirmation. Retry the unchanged request or refresh history before creating another queue.</p>}
        {pendingUpdate && <p role="alert">The tracking update needs confirmation. Retry the original update or refresh history before continuing. Recovery does not open WhatsApp.</p>}
        <div className="announcement-actions">
          {pendingCreate && <Button disabled={isSaving || loading} onClick={() => void saveQueue()}>Retry Saving Reminder Queue</Button>}
          {pendingUpdate && <Button disabled={isSaving || loading} onClick={() => void recoverUpdate()}>Retry Tracking Update</Button>}
        </div>
        {!pendingCreate && <fieldset className="announcement-workspace" disabled={blocked}>
          <p>{selectedStudents.length} selected pending-fee students · {validCount} valid mobiles · {selectedStudents.length - validCount} invalid mobiles</p>
          {!!selectedStudents.length && <Table><thead><tr><th>Selected student</th><th>Pending balance</th><th>Payment due</th></tr></thead><tbody>{selectedStudents.map((student) => <tr key={student.studentId}><td>{student.fullName} · {student.studentId}</td><td>{formatReceiptCurrency(student.balance)}</td><td>{formatReceiptDate(studentFeeSchedule(student).dueDate)}</td></tr>)}</tbody></Table>}
          {preview && previewDue && <details><summary>Preview fee reminder</summary><pre className="announcement-message">{feeReminderMessage({ name: preview.fullName, studentId: preview.studentId, course: preview.course, batch: preview.batch, balance: preview.balance, dueDate: previewDue })}</pre></details>}
          <Button disabled={!validCount} onClick={() => void saveQueue()}>Save Reminder Queue &amp; Review</Button>
        </fieldset>}
      </Card>
      <fieldset className="announcement-workspace" disabled={blocked}>
        {selectedQueue && <AnnouncementQueue announcement={selectedQueue.announcement} recipients={selectedQueue.recipients}
          onQueueAction={(action, recipientId) => void changeQueue(action, recipientId)}
          onRecipientAction={(recipientId, status) => void changeQueue(status, recipientId)}
          onOpen={() => void openCurrent()} onStart={() => void openCurrent(true)}
          messageForRecipient={(recipient) => recipientDetails(recipient.id).message}
          progressDetails={(recipient) => {
            const details = recipientDetails(recipient.id)
            return `${formatReceiptCurrency(details.balance)} · Due ${formatReceiptDate(details.dueDate)} · ${new Date(details.updatedAt).toLocaleString('en-IN')} · ${details.updatedBy}`
          }} />}
        <Card className="announcement-panel"><h2>Fee Reminder History</h2>
          {!history.length ? <p>No shared fee reminders yet.</p> : <Table><thead><tr><th>Reminder</th><th>Created / Administrator</th><th>Recipients</th><th>Marked sent</th><th>Queue</th><th>Action</th></tr></thead><tbody>{history.map((queue) => <tr key={queue.announcement.id}>
            <td>{queue.announcement.title}</td><td>{new Date(queue.announcement.createdAt).toLocaleString('en-IN')}<br />{queue.announcement.creator}</td><td>{queue.recipients.length}</td><td>{queue.recipients.filter((recipient) => recipient.status === 'sent').length}</td><td>{queue.announcement.status}</td>
            <td><Button variant="secondary" onClick={() => { queueRef.current = queue; setSelectedQueueId(queue.announcement.id); setError('') }}>View Reminder Queue</Button></td>
          </tr>)}</tbody></Table>}
        </Card>
      </fieldset>
    </section>
  )
}
