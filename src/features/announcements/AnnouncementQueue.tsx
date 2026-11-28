import { Badge, Button, Card, Table } from '../../components/ui'
import { isPendingRecipient, personalizeAnnouncement, type Announcement, type AnnouncementRecipient, type RecipientStatus } from './announcementStore'

const statusLabels: Record<RecipientStatus, string> = {
  ready: 'Ready', opened: 'WhatsApp opened', sent: 'Manually marked sent',
  skipped: 'Skipped', invalid: 'Invalid number', failed: 'Failed to open',
}

export function AnnouncementQueue({ announcement, recipients, onQueueAction, onRecipientAction, onOpen, onStart, messageForRecipient, progressDetails }: {
  announcement: Announcement
  recipients: AnnouncementRecipient[]
  onQueueAction: (action: 'pause' | 'resume' | 'stop' | 'next', recipientId?: string) => void
  onRecipientAction: (recipientId: string, status: 'opened' | 'sent' | 'skipped' | 'failed') => void
  onOpen: () => void
  onStart: () => void
  messageForRecipient?: (recipient: AnnouncementRecipient) => string
  progressDetails?: (recipient: AnnouncementRecipient) => string
}) {
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
          {active ? <Button variant="secondary" onClick={() => onQueueAction('pause')}>Pause Queue</Button>
            : announcement.status === 'paused' && recipients.every((recipient) => recipient.status === 'ready' || recipient.status === 'invalid')
            ? <Button onClick={onStart}>Start Queue &amp; Open WhatsApp</Button>
            : <Button onClick={() => onQueueAction('resume')}>Resume Queue</Button>}
          {announcement.status !== 'stopped' && <Button variant="secondary" onClick={() => onQueueAction('stop')}>Stop Queue</Button>}
        </>}
      </div>
      {current ? <>
        <h3>Current recipient: {current.name}</h3>
        <p>{current.studentId} · {current.mobileNumber} · {current.course} / Batch {current.batch} · {statusLabels[current.status]}</p>
        <pre className="announcement-message" aria-label="Current recipient message">{messageForRecipient ? messageForRecipient(current) : personalizeAnnouncement(announcement.template, current)}</pre>
        <div className="announcement-actions">
          <Button disabled={!active} onClick={onOpen}>{current.status === 'failed' ? 'Retry WhatsApp' : current.status === 'opened' ? 'Reopen WhatsApp' : 'Open WhatsApp'}</Button>
          <Button disabled={!active || current.status !== 'opened'} onClick={() => onRecipientAction(current.id, 'sent')}>Mark as Sent &amp; Next</Button>
          <Button variant="secondary" disabled={!active} onClick={() => onRecipientAction(current.id, 'skipped')}>Skip &amp; Next</Button>
          <Button variant="secondary" disabled={pending < 2} onClick={() => onQueueAction('next')}>Next Recipient</Button>
        </div>
      </> : <p role="status">Queue complete. Marked sent is your manual confirmation, not a delivery receipt.</p>}
      {!messageForRecipient && <details><summary>Original message template</summary><pre className="announcement-message">{announcement.template}</pre></details>}
      <Table><thead><tr><th>Student</th><th>Student ID</th><th>Mobile</th><th>Course</th><th>Batch</th><th>Status</th><th>Action</th></tr></thead><tbody>{recipients.map((recipient) => <tr key={recipient.id}>
        <td>{recipient.name}</td><td>{recipient.studentId}</td><td>{recipient.mobileNumber || 'Missing'}</td><td>{recipient.course}</td><td>{recipient.batch}</td>
        <td>{statusLabels[recipient.status]}{progressDetails && <><br />{progressDetails(recipient)}</>}</td>
        <td>{isPendingRecipient(recipient) && <Button variant="secondary" disabled={recipient.id === current?.id} onClick={() => onQueueAction('next', recipient.id)}>Choose</Button>}</td>
      </tr>)}</tbody></Table>
    </Card>
  )
}
