import { Edit3, LogOut, Plus, UserRound, X } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Input, Select, Textarea } from '../../components/ui'
import { createFollowUp, updateFollowUp } from '../../services/api'
import {
  contactMethodOptions,
  followUpStatusOptions,
  formatVisitorDate,
  formatVisitorTime,
  type FollowUpFormData,
  type FollowUpRecord,
  type VisitorRecord,
} from './visitorTypes'

interface VisitorDetailsModalProps {
  followUps: FollowUpRecord[]
  isLoadingFollowUps: boolean
  onClose: () => void
  onEdit: () => void
  onFollowUpSaved: () => void
  onMarkExit: () => void
  visitor: VisitorRecord
}

function DetailGroup({ title, values }: { title: string; values: Array<{ label: string; value: string }> }) {
  return (
    <section className="visitor-detail-group">
      <h3>{title}</h3>
      <dl className="visitor-detail-grid">
        {values.map(({ label, value }) => (
          <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>
        ))}
      </dl>
    </section>
  )
}

function emptyFollowUp(): FollowUpFormData {
  return { scheduledDate: '', followUpStatus: 'Pending', contactMethod: '', notes: '' }
}

export function VisitorDetailsModal({
  followUps,
  isLoadingFollowUps,
  onClose,
  onEdit,
  onFollowUpSaved,
  onMarkExit,
  visitor,
}: VisitorDetailsModalProps) {
  const navigate = useNavigate()
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormData>(emptyFollowUp)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpRecord | null>(null)
  const [followUpError, setFollowUpError] = useState('')
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false)

  function changeFollowUp(field: keyof FollowUpFormData, value: string) {
    setFollowUpForm((current) => ({ ...current, [field]: value }))
  }

  function startEditingFollowUp(followUp: FollowUpRecord) {
    setEditingFollowUp(followUp)
    setFollowUpForm({
      scheduledDate: followUp.scheduledDate,
      followUpStatus: followUp.followUpStatus,
      contactMethod: followUp.contactMethod,
      notes: followUp.notes,
    })
    setFollowUpError('')
  }

  function handleFollowUpInput(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    changeFollowUp(event.target.name as keyof FollowUpFormData, event.target.value)
  }

  async function saveFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSavingFollowUp) return
    if (!followUpForm.scheduledDate) {
      setFollowUpError('Scheduled date is required.')
      return
    }
    setIsSavingFollowUp(true)
    setFollowUpError('')
    try {
      const payload = { ...followUpForm, notes: followUpForm.notes.trim(), contactMethod: followUpForm.contactMethod.trim() }
      if (editingFollowUp) await updateFollowUp(editingFollowUp.followUpId, payload)
      else await createFollowUp({ visitorId: visitor.visitorId, ...payload })
      setFollowUpForm(emptyFollowUp())
      setEditingFollowUp(null)
      onFollowUpSaved()
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : 'Unable to save the follow-up.')
    } finally {
      setIsSavingFollowUp(false)
    }
  }

  return (
    <div className="visitor-detail-modal" role="presentation" onMouseDown={onClose}>
      <section className="visitor-detail-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="visitor-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="visitor-detail-modal__header">
          <div>
            <span>Visitor record</span>
            <h2 id="visitor-detail-title">{visitor.fullName}</h2>
            <p>{visitor.visitorId} · {visitor.courseInterestedIn}</p>
          </div>
          <Button variant="secondary" iconOnly aria-label="Close visitor details" onClick={onClose}><X aria-hidden="true" size={18} /></Button>
        </header>
        <div className="visitor-detail-modal__body">
          <div className="visitor-detail-modal__actions">
            <Button variant="secondary" onClick={onEdit}><Edit3 aria-hidden="true" size={15} /> Edit</Button>
            {visitor.visitStatus !== 'Completed' && <Button variant="secondary" onClick={onMarkExit}><LogOut aria-hidden="true" size={15} /> Mark Exit</Button>}
            <Button
              variant="secondary"
              onClick={() => navigate('/new-admission', {
                state: {
                  visitorPrefill: {
                    fullName: visitor.fullName,
                    mobileNumber: visitor.mobileNumber,
                    email: visitor.email,
                    collegeName: visitor.college,
                    degreeCourse: visitor.degreeCourse,
                    yearOfPassing: visitor.yearOfGraduation,
                    course: visitor.courseInterestedIn === 'Other' ? '' : visitor.courseInterestedIn,
                    remarks: visitor.notes,
                  },
                },
              })}
            >
              <UserRound aria-hidden="true" size={15} /> Convert to Admission
            </Button>
          </div>

          <DetailGroup
            title="Visitor Information"
            values={[
              { label: 'Visitor ID', value: visitor.visitorId },
              { label: 'Name', value: visitor.fullName },
              { label: 'Phone', value: visitor.mobileNumber },
              { label: 'Email', value: visitor.email },
              { label: 'College', value: visitor.college },
              { label: 'Degree / Course', value: visitor.degreeCourse },
              { label: 'Graduation Year', value: visitor.yearOfGraduation },
              { label: 'Interested Course', value: visitor.otherCourse || visitor.courseInterestedIn },
              { label: 'Referral', value: visitor.otherReferral || visitor.referral },
              { label: 'Consulted With', value: visitor.consultedWith },
            ]}
          />
          <DetailGroup
            title="Visit Details"
            values={[
              { label: 'Visit Date', value: formatVisitorDate(visitor.visitDate) },
              { label: 'Entry Time', value: formatVisitorTime(visitor.entryTime) },
              { label: 'Exit Time', value: formatVisitorTime(visitor.exitTime) },
              { label: 'Visit Status', value: visitor.visitStatus },
              { label: 'Follow-up Required', value: visitor.followUpRequired },
              { label: 'Conversion Status', value: visitor.conversionStatus },
              { label: 'Admission ID', value: visitor.admissionId },
            ]}
          />
          <section className="visitor-detail-group">
            <h3>Notes / Remarks</h3>
            <p className="visitor-detail-remarks">{visitor.notes || 'No notes added.'}</p>
          </section>

          <section className="visitor-detail-group visitor-followups">
            <div className="visitor-detail-group__heading">
              <div><h3>Follow-up History</h3><p>Track the next contact and its outcome.</p></div>
              <Badge variant={visitor.followUpRequired === 'Yes' ? 'yellow' : 'neutral'}>{visitor.followUpRequired === 'Yes' ? 'Required' : 'Optional'}</Badge>
            </div>
            {isLoadingFollowUps ? <p className="visitor-detail-remarks">Loading follow-ups...</p> : followUps.length > 0 ? (
              <div className="visitor-followups__list">
                {followUps.map((followUp) => (
                  <article className="visitor-followup" key={followUp.followUpId}>
                    <div><strong>{followUp.scheduledDate}</strong><span>{followUp.contactMethod || 'No method'} · Follow-up {followUp.followUpNumber}</span></div>
                    <Badge variant={followUp.followUpStatus === 'Completed' ? 'navy' : followUp.followUpStatus === 'Pending' ? 'yellow' : 'neutral'}>{followUp.followUpStatus}</Badge>
                    <Button variant="secondary" iconOnly aria-label={`Edit follow-up ${followUp.followUpId}`} onClick={() => startEditingFollowUp(followUp)}><Edit3 aria-hidden="true" size={14} /></Button>
                    {followUp.notes && <p>{followUp.notes}</p>}
                  </article>
                ))}
              </div>
            ) : <p className="visitor-detail-remarks">No follow-ups recorded.</p>}

            <form className="visitor-followup-form" onSubmit={saveFollowUp}>
              <div className="visitor-detail-group__heading">
                <div><h3>{editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'}</h3></div>
                {editingFollowUp && <Button variant="secondary" onClick={() => { setEditingFollowUp(null); setFollowUpForm(emptyFollowUp()) }}>Cancel edit</Button>}
              </div>
              {followUpError && <p className="visitor-form__error" role="alert">{followUpError}</p>}
              <div className="visitor-followup-form__grid">
                <Input id="follow-up-date" name="scheduledDate" label="Scheduled Date" type="date" value={followUpForm.scheduledDate} onChange={handleFollowUpInput} required />
                <Select id="follow-up-status" name="followUpStatus" label="Status" options={followUpStatusOptions} value={followUpForm.followUpStatus} onChange={handleFollowUpInput} />
                <Select id="follow-up-contact" name="contactMethod" label="Contact Method" options={contactMethodOptions} value={followUpForm.contactMethod} onChange={handleFollowUpInput} />
                <Textarea containerClassName="visitor-form__full" id="follow-up-notes" name="notes" label="Notes" rows={2} value={followUpForm.notes} onChange={handleFollowUpInput} />
              </div>
              <Button type="submit" disabled={isSavingFollowUp}><Plus aria-hidden="true" size={15} />{isSavingFollowUp ? 'Saving...' : editingFollowUp ? 'Save Follow-up' : 'Add Follow-up'}</Button>
            </form>
          </section>
        </div>
      </section>
    </div>
  )
}
