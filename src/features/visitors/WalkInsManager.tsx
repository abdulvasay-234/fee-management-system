import { Eye, Edit3, LogOut, Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchFollowUps, fetchWalkIns, markWalkInExit, type FollowUpRecord, type VisitorRecord } from '../../services/api'
import { getCourseCodes } from '../courseCodes/courseCodeService'
import { WalkInFormModal } from './WalkInFormModal'
import { VisitorDetailsModal } from './VisitorDetailsModal'
import { formatVisitorDate, formatVisitorTime } from './visitorTypes'

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Currently Inside', value: 'Currently Inside' },
  { label: 'Completed', value: 'Completed' },
]

const conversionOptions = [
  { label: 'All conversions', value: '' },
  { label: 'Not Converted', value: 'Not Converted' },
  { label: 'Converted', value: 'Converted' },
]

function matches(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase())
}

function statusVariant(status: string) {
  if (status === 'Currently Inside') return 'yellow' as const
  if (status === 'Completed') return 'navy' as const
  return 'neutral' as const
}

function followUpVariant(required: string) {
  return required === 'Yes' ? 'yellow' as const : 'neutral' as const
}

let initialWalkInsLoad: Promise<[VisitorRecord[], Awaited<ReturnType<typeof getCourseCodes>>]> | null = null

function loadInitialWalkIns() {
  if (!initialWalkInsLoad) {
    initialWalkInsLoad = Promise.all([fetchWalkIns(), getCourseCodes()]).finally(() => {
      initialWalkInsLoad = null
    })
  }
  return initialWalkInsLoad
}

export function WalkInsManager() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([])
  const [courseOptions, setCourseOptions] = useState<Array<{ label: string; value: string }>>([])
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('')
  const [conversion, setConversion] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [formVisitor, setFormVisitor] = useState<VisitorRecord | null | undefined>(undefined)
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRecord | null>(null)
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([])
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(false)
  const [actionError, setActionError] = useState('')

  async function loadVisitors(showLoader = true) {
    if (showLoader) setIsLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const records = await fetchWalkIns()
      setVisitors(records)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load walk-ins.')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadInitialWalkIns().then(([records, courses]) => {
      if (!active) return
      setVisitors(records)
      setCourseOptions(courses.filter((item) => item.active).map((item) => ({ label: item.name, value: item.name })))
      setError('')
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load walk-ins.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [])

  const filteredVisitors = useMemo(() => {
    const normalizedQuery = query.trim()
    return visitors.filter((visitor) => (
      (!normalizedQuery || matches(visitor.fullName, normalizedQuery) || matches(visitor.mobileNumber, normalizedQuery) || matches(visitor.visitorId, normalizedQuery))
      && (!date || visitor.visitDate === date)
      && (!course || visitor.courseInterestedIn === course)
      && (!status || visitor.visitStatus === status)
      && (!conversion || visitor.conversionStatus === conversion)
    ))
  }, [course, conversion, date, query, status, visitors])

  const summary = useMemo(() => ({
    total: visitors.length,
    inside: visitors.filter((visitor) => visitor.visitStatus === 'Currently Inside').length,
    followUps: visitors.filter((visitor) => visitor.followUpRequired === 'Yes').length,
    converted: visitors.filter((visitor) => visitor.conversionStatus === 'Converted').length,
  }), [visitors])

  async function openDetails(visitor: VisitorRecord) {
    setSelectedVisitor(visitor)
    setActionError('')
    setIsLoadingFollowUps(true)
    try {
      setFollowUps(await fetchFollowUps({ visitorId: visitor.visitorId }))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to load follow-ups.')
      setFollowUps([])
    } finally {
      setIsLoadingFollowUps(false)
    }
  }

  async function refreshFollowUps() {
    if (!selectedVisitor) return
    setIsLoadingFollowUps(true)
    try {
      setFollowUps(await fetchFollowUps({ visitorId: selectedVisitor.visitorId }))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to load follow-ups.')
    } finally {
      setIsLoadingFollowUps(false)
    }
  }

  async function handleMarkExit(visitor: VisitorRecord) {
    if (visitor.visitStatus === 'Completed' || !window.confirm(`Mark ${visitor.fullName}'s visit as exited?`)) return
    setActionError('')
    try {
      await markWalkInExit(visitor.visitorId)
      setSelectedVisitor(null)
      await loadVisitors(false)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to mark the visitor exit.')
    }
  }

  function handleSaved() {
    setFormVisitor(undefined)
    void loadVisitors(false)
  }

  const courseFilterOptions = [{ label: 'All courses', value: '' }, ...courseOptions]

  return (
    <>
      <header className="visitors-page-header">
        <div>
          <span className="page__eyebrow">LSA WORKSPACE</span>
          <h1 className="page__title">Walk-ins &amp; Visitors</h1>
          <p className="page__description">Track visitor enquiries, follow-ups, and the journey from first visit to conversion.</p>
        </div>
        <Button onClick={() => setFormVisitor(null)}><Plus aria-hidden="true" size={17} />Add Walk-in</Button>
      </header>
      <section className="visitor-summary-cards" aria-label="Walk-in summary">
        <Card className="visitor-summary-card"><span>Total Visits</span><strong>{summary.total}</strong></Card>
        <Card className="visitor-summary-card visitor-summary-card--attention"><span>Currently Inside</span><strong>{summary.inside}</strong></Card>
        <Card className="visitor-summary-card"><span>Follow-ups Required</span><strong>{summary.followUps}</strong></Card>
        <Card className="visitor-summary-card visitor-summary-card--converted"><span>Converted</span><strong>{summary.converted}</strong></Card>
      </section>

      <Card className="visitor-filters">
        <div className="visitor-filters__grid">
          <Input id="visitor-search" label="Search" placeholder="Name, phone, or visitor ID" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Input id="visitor-date-filter" label="Visit Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Select id="visitor-course-filter" label="Course" options={courseFilterOptions} value={course} onChange={(event) => setCourse(event.target.value)} />
          <Select id="visitor-status-filter" label="Visit Status" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          <Select id="visitor-conversion-filter" label="Conversion" options={conversionOptions} value={conversion} onChange={(event) => setConversion(event.target.value)} />
          <div className="visitor-filters__actions">
            <Button variant="secondary" onClick={() => { setQuery(''); setDate(''); setCourse(''); setStatus(''); setConversion('') }}>Clear</Button>
            <Button variant="secondary" onClick={() => void loadVisitors(false)} disabled={refreshing}><RefreshCw aria-hidden="true" size={15} />{refreshing ? 'Refreshing...' : 'Refresh'}</Button>
          </div>
        </div>
      </Card>

      {actionError && <p className="visitor-page__error" role="alert">{actionError}</p>}
      {error ? (
        <EmptyState icon={<RefreshCw size={22} />} title="Walk-ins unavailable" description={error} action={<Button onClick={() => void loadVisitors()}>Try Again</Button>} />
      ) : isLoading ? (
        <Card className="visitor-loading"><RefreshCw aria-hidden="true" size={20} /><span>Loading walk-ins...</span></Card>
      ) : filteredVisitors.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title={visitors.length ? 'No walk-ins found' : 'No walk-ins yet'} description={visitors.length ? 'Try changing your filters.' : 'Add a visitor enquiry to start building this directory.'} action={!visitors.length ? <Button onClick={() => setFormVisitor(null)}><Plus aria-hidden="true" size={16} />Add Walk-in</Button> : undefined} />
      ) : (
        <>
          <div className="visitor-results-heading"><div><h2>Visitor directory</h2><p>Showing {filteredVisitors.length} of {visitors.length} visits.</p></div></div>
          <Table className="visitor-table">
            <thead><tr><th>Visitor ID</th><th>Name</th><th>Phone</th><th>Course Interested</th><th>Visit Date</th><th>Entry Time</th><th>Exit Time</th><th>Status</th><th>Follow-up</th><th>Conversion</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.visitorId}>
                  <td><strong>{visitor.visitorId}</strong></td>
                  <td><strong>{visitor.fullName}</strong></td>
                  <td>{visitor.mobileNumber}</td>
                  <td>{visitor.otherCourse || visitor.courseInterestedIn}</td>
                  <td>{formatVisitorDate(visitor.visitDate)}</td>
                  <td>{formatVisitorTime(visitor.entryTime)}</td>
                  <td>{formatVisitorTime(visitor.exitTime)}</td>
                  <td><Badge variant={statusVariant(visitor.visitStatus)}>{visitor.visitStatus || 'Unknown'}</Badge></td>
                  <td><Badge variant={followUpVariant(visitor.followUpRequired)}>{visitor.followUpRequired === 'Yes' ? 'Required' : 'No'}</Badge></td>
                  <td><Badge variant={visitor.conversionStatus === 'Converted' ? 'navy' : 'neutral'}>{visitor.conversionStatus || 'Not Converted'}</Badge></td>
                  <td><div className="visitor-table__actions"><Button variant="secondary" iconOnly aria-label={`View ${visitor.fullName}`} onClick={() => void openDetails(visitor)}><Eye aria-hidden="true" size={14} /></Button><Button variant="secondary" iconOnly aria-label={`Edit ${visitor.fullName}`} onClick={() => setFormVisitor(visitor)}><Edit3 aria-hidden="true" size={14} /></Button>{visitor.visitStatus !== 'Completed' && <Button variant="secondary" iconOnly aria-label={`Mark exit for ${visitor.fullName}`} onClick={() => void handleMarkExit(visitor)}><LogOut aria-hidden="true" size={14} /></Button>}</div></td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="visitor-mobile-list">
            {filteredVisitors.map((visitor) => (
              <Card className="visitor-mobile-card" key={visitor.visitorId}>
                <div className="visitor-mobile-card__heading"><div><strong>{visitor.fullName}</strong><span>{visitor.visitorId}</span></div><Badge variant={statusVariant(visitor.visitStatus)}>{visitor.visitStatus}</Badge></div>
                <dl><div><dt>Phone</dt><dd>{visitor.mobileNumber}</dd></div><div><dt>Course</dt><dd>{visitor.otherCourse || visitor.courseInterestedIn}</dd></div><div><dt>Visit Date</dt><dd>{formatVisitorDate(visitor.visitDate)}</dd></div><div><dt>Follow-up</dt><dd>{visitor.followUpRequired === 'Yes' ? 'Required' : 'No'}</dd></div></dl>
                <div className="visitor-mobile-card__actions"><Button variant="secondary" onClick={() => void openDetails(visitor)}><Eye aria-hidden="true" size={14} />View</Button><Button variant="secondary" onClick={() => setFormVisitor(visitor)}><Edit3 aria-hidden="true" size={14} />Edit</Button></div>
              </Card>
            ))}
          </div>
        </>
      )}

      {formVisitor !== undefined && <WalkInFormModal key={formVisitor?.visitorId ?? 'new'} courseOptions={courseOptions} visitor={formVisitor} onClose={() => setFormVisitor(undefined)} onSaved={handleSaved} />}
      {selectedVisitor && <VisitorDetailsModal visitor={selectedVisitor} followUps={followUps} isLoadingFollowUps={isLoadingFollowUps} onClose={() => setSelectedVisitor(null)} onEdit={() => { setFormVisitor(selectedVisitor); setSelectedVisitor(null) }} onMarkExit={() => void handleMarkExit(selectedVisitor)} onFollowUpSaved={() => void refreshFollowUps()} />}
    </>
  )
}
