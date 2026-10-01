import { ClipboardList, Eye, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchEnquiries, type ConvertEnquiryResponse, type EnquiryRecord } from '../../services/api'
import { EnquiryConversionModal } from './EnquiryConversionModal'
import { EnquiryFormModal } from './EnquiryFormModal'

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'New', value: 'New' },
  { label: 'Follow-up', value: 'Follow-up' },
  { label: 'Converted', value: 'Converted' },
  { label: 'Not Interested', value: 'Not Interested' },
]

function statusVariant(status: EnquiryRecord['status']) {
  if (status === 'Follow-up') return 'yellow' as const
  if (status === 'Not Interested') return 'red' as const
  if (status === 'Converted') return 'navy' as const
  return 'neutral' as const
}

function displayDate(value: string) {
  if (!value) return 'Not provided'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function EnquiriesDirectory() {
  const navigate = useNavigate()
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [course, setCourse] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<{ message: string; warning: boolean } | null>(null)
  const [formEnquiry, setFormEnquiry] = useState<EnquiryRecord | null | undefined>(undefined)
  const [conversionEnquiry, setConversionEnquiry] = useState<EnquiryRecord | null>(null)

  useEffect(() => {
    let active = true
    void fetchEnquiries().then((records) => {
      if (active) setEnquiries(records)
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load enquiries.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [])

  async function refresh() {
    setIsRefreshing(true)
    setLoadError('')
    try {
      setEnquiries(await fetchEnquiries())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load enquiries.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function handleSaved(record: EnquiryRecord, warning: string | undefined, wasEditing: boolean) {
    setEnquiries((current) => [record, ...current.filter((item) => item.enquiryId !== record.enquiryId)])
    if (!wasEditing) {
      setQuery('')
      setStatus('')
      setCourse('')
      setDateFrom('')
      setDateTo('')
    }
    setFormEnquiry(undefined)
    setLoadError('')
    setNotice({ message: warning || (wasEditing ? 'Enquiry updated.' : 'Enquiry added.'), warning: Boolean(warning) })
    if (warning) return
    try {
      const records = await fetchEnquiries()
      setEnquiries(records.some((item) => item.enquiryId === record.enquiryId) ? records : [record, ...records])
    } catch {
      setNotice({ message: 'Enquiry saved, but the directory could not refresh. Try refreshing later.', warning: true })
    }
  }

  function handleConversionSuccess(result: ConvertEnquiryResponse) {
    const studentId = result.data?.studentId || result.data?.admissionId || ''
    const warning = result.indexWarning || result.studentIndexWarning || result.error
    setNotice({
      message: warning ? `Admission ${studentId} created; backend reconciliation needs attention.` : `Admission ${studentId} created successfully.`,
      warning: Boolean(warning || result.partial || result.studentIndexSynchronized === false),
    })
    void refresh()
  }

  function handleConversionOutcomeUnknown() {
    setNotice({ message: 'Conversion response is unconfirmed. The enquiry list is being refreshed; verify the Admission record before any further attempt.', warning: true })
    void refresh()
  }

  function viewAdmission(studentId: string) {
    navigate('/students', { state: { selectedStudentId: studentId } })
  }

  const courseOptions = [
    { label: 'All courses', value: '' },
    ...Array.from(new Set(enquiries.map((item) => item.courseInterestedIn).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right)).map((value) => ({ label: value, value })),
  ]
  const search = query.trim().toLowerCase()
  const filtered = enquiries.filter((item) => (
    (!search || [item.fullName, item.mobileNumber, item.email, item.college, item.educationLevel, item.specialization, item.courseInterestedIn, item.otherProgramDetails]
      .some((value) => value.toLowerCase().includes(search)))
    && (!status || item.status === status)
    && (!course || item.courseInterestedIn === course)
    && (!dateFrom || item.enquiryDate >= dateFrom)
    && (!dateTo || item.enquiryDate <= dateTo)
  ))
  const filtersActive = Boolean(search || status || course || dateFrom || dateTo)

  return (
    <>
      <header className="enquiries-header">
        <div>
          <span className="page__eyebrow">LSA WORKSPACE</span>
          <h1 className="page__title">Enquiries</h1>
          <p className="page__description">Keep prospective students and their next steps in one place.</p>
        </div>
        <Button onClick={() => setFormEnquiry(null)}><Plus aria-hidden="true" size={17} />New Enquiry</Button>
      </header>

      {!isLoading && !loadError && enquiries.length > 0 && (
        <section className="enquiries-summary" aria-label="Enquiry summary">
          <Card><span>Total Enquiries</span><strong>{enquiries.length}</strong></Card>
          <Card><span>New</span><strong>{enquiries.filter((item) => item.status === 'New').length}</strong></Card>
          <Card><span>Follow-up</span><strong>{enquiries.filter((item) => item.status === 'Follow-up').length}</strong></Card>
          <Card><span>Converted</span><strong>{enquiries.filter((item) => item.status === 'Converted').length}</strong></Card>
        </section>
      )}

      {notice && <div className={`enquiries-notice${notice.warning ? ' enquiries-notice--warning' : ''}`} role="status"><span>{notice.message}</span><Button variant="secondary" iconOnly aria-label="Dismiss message" onClick={() => setNotice(null)}><X aria-hidden="true" size={15} /></Button></div>}

      {!isLoading && !loadError && (enquiries.length > 0 || filtersActive) && (
        <Card className="enquiries-filters">
          <div className="enquiries-filters__grid">
            <Input id="enquiries-search" label="Search" placeholder="Name, mobile, email, college, course" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select id="enquiries-status" label="Status" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
            <Select id="enquiries-course" label="Course" options={courseOptions} value={course} onChange={(event) => setCourse(event.target.value)} />
            <Input id="enquiries-from" label="From" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input id="enquiries-to" label="To" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
            <div className="enquiries-filters__actions">
              {filtersActive && <Button variant="secondary" onClick={() => { setQuery(''); setStatus(''); setCourse(''); setDateFrom(''); setDateTo('') }}>Clear</Button>}
              <Button variant="secondary" onClick={() => void refresh()} disabled={isRefreshing}><RefreshCw aria-hidden="true" size={15} />{isRefreshing ? 'Refreshing...' : 'Refresh'}</Button>
            </div>
          </div>
        </Card>
      )}

      {loadError ? (
        <EmptyState icon={<RefreshCw size={22} />} title="Enquiries unavailable" description={loadError} action={<Button onClick={() => void refresh()}>Try Again</Button>} />
      ) : isLoading ? (
        <Card className="enquiries-loading"><RefreshCw aria-hidden="true" size={20} /><span>Loading enquiries...</span></Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={22} />} title={filtersActive ? 'No enquiries found' : 'No enquiries yet'} description={filtersActive ? 'Try adjusting your search or filters.' : 'New enquiries will appear here.'} action={!filtersActive ? <Button onClick={() => setFormEnquiry(null)}><Plus aria-hidden="true" size={16} />New Enquiry</Button> : undefined} />
      ) : (
        <>
          <div className="enquiries-results"><div><h2>Enquiry directory</h2><p>Showing {filtered.length} of {enquiries.length}</p></div></div>
          <Table className="enquiries-table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Education Level</th><th>Specialization</th><th>Course Interested In</th><th>Other Program Details</th><th>College</th><th>Enquiry Date</th><th>Status</th><th>Admission ID</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.enquiryId}>
                  <td><strong>{item.fullName}</strong></td><td>{item.mobileNumber}</td><td>{item.email || '-'}</td><td>{item.educationLevel || item.degreeCourse || '-'}</td><td>{item.specialization || '-'}</td><td>{item.courseInterestedIn}</td><td>{item.otherProgramDetails || '-'}</td><td>{item.college || '-'}</td><td>{displayDate(item.enquiryDate)}</td>
                  <td><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td><td>{item.admissionId || '-'}</td>
                  <td><div className="enquiries-table__actions">
                    <Button variant="secondary" iconOnly aria-label={`Edit ${item.fullName}`} title={`Edit ${item.fullName}`} onClick={() => setFormEnquiry(item)}><Pencil aria-hidden="true" size={15} /></Button>
                    {item.admissionId && <Button variant="secondary" onClick={() => viewAdmission(item.admissionId)}><Eye aria-hidden="true" size={15} />View Admission</Button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="enquiries-mobile-list">
            {filtered.map((item) => (
              <Card className="enquiries-mobile-item" key={item.enquiryId}>
                <div className="enquiries-mobile-item__heading"><div><strong>{item.fullName}</strong><span>{item.courseInterestedIn}</span></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div>
                <dl>
                  <div><dt>Mobile</dt><dd>{item.mobileNumber}</dd></div><div><dt>Email</dt><dd>{item.email || '-'}</dd></div><div><dt>Education Level</dt><dd>{item.educationLevel || item.degreeCourse || '-'}</dd></div><div><dt>Specialization</dt><dd>{item.specialization || '-'}</dd></div><div><dt>Other Program Details</dt><dd>{item.otherProgramDetails || '-'}</dd></div><div><dt>College</dt><dd>{item.college || '-'}</dd></div><div><dt>Enquiry Date</dt><dd>{displayDate(item.enquiryDate)}</dd></div><div><dt>Admission ID</dt><dd>{item.admissionId || '-'}</dd></div>
                </dl>
                <div className="enquiries-mobile-item__actions">
                  <Button variant="secondary" onClick={() => setFormEnquiry(item)}><Pencil aria-hidden="true" size={15} />Edit Enquiry</Button>
                  {item.admissionId && <Button onClick={() => viewAdmission(item.admissionId)}><Eye aria-hidden="true" size={15} />View Admission</Button>}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {formEnquiry !== undefined && <EnquiryFormModal
        key={formEnquiry?.enquiryId ?? 'new'}
        enquiry={formEnquiry}
        onClose={() => setFormEnquiry(undefined)}
        onConvert={(record) => { setFormEnquiry(undefined); setConversionEnquiry(record) }}
        onViewAdmission={viewAdmission}
        onSaved={(record, warning) => void handleSaved(record, warning, Boolean(formEnquiry))}
      />}
      {conversionEnquiry && <EnquiryConversionModal
        enquiry={conversionEnquiry}
        onCheckStatus={handleConversionOutcomeUnknown}
        onClose={() => setConversionEnquiry(null)}
        onSuccess={handleConversionSuccess}
        onViewStudent={viewAdmission}
      />}
    </>
  )
}