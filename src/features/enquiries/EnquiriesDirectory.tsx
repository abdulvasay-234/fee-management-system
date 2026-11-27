import { Calendar, ChevronDown, ClipboardList, MoreVertical, Plus, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, Select, Table } from '../../components/ui'
import { fetchEnquiries, type ConvertEnquiryResponse, type EnquiryRecord } from '../../services/api'
import { EnquiryConversionModal } from './EnquiryConversionModal'
import { EnquiryFormModal } from './EnquiryFormModal'
import { CourseLabel, CourseSelect } from '../courseCodes/CourseLabel'
import {
  isToday,
  getTodayString,
  getYesterdayString,
  getWeekStartString,
  getMonthStartString,
  getMonthEndString,
  groupEnquiriesByDate,
  type EnquiryGroup,
} from './enquiryUtils'

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

export function EnquiriesDirectory() {
  const navigate = useNavigate()
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [course, setCourse] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<{ message: string; warning: boolean } | null>(null)
  const [formEnquiry, setFormEnquiry] = useState<EnquiryRecord | null | undefined>(undefined)
  const [conversionEnquiry, setConversionEnquiry] = useState<EnquiryRecord | null>(null)
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const actionMenuRef = useRef<HTMLDivElement>(null)

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

  function handleActionClick(enquiryId: string) {
    setOpenActionMenu(openActionMenu === enquiryId ? null : enquiryId)
  }

  // Close action menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenu(null)
      }
    }

    if (openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openActionMenu])

  const courseOptions = [
    { label: 'All courses', value: '' },
    ...Array.from(new Set(enquiries.map((item) => item.courseInterestedIn).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right)).map((value) => ({ label: value, value })),
  ]

  function applyDateFilter(filterType: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom') {
    setDateFilter(filterType)
    if (filterType === 'today') {
      setDateFrom(getTodayString())
      setDateTo(getTodayString())
    } else if (filterType === 'yesterday') {
      const yesterday = getYesterdayString()
      setDateFrom(yesterday)
      setDateTo(yesterday)
    } else if (filterType === 'week') {
      setDateFrom(getWeekStartString())
      setDateTo('')
    } else if (filterType === 'month') {
      setDateFrom(getMonthStartString())
      setDateTo(getMonthEndString())
    } else {
      setDateFrom('')
      setDateTo('')
      setDateFilter('all')
    }
  }

  const search = query.trim().toLowerCase()
  const filtered = enquiries.filter((item) => (
    (!search || [item.fullName, item.mobileNumber, item.email, item.college, item.educationLevel, item.specialization, item.courseInterestedIn, item.otherProgramDetails]
      .some((value) => value.toLowerCase().includes(search)))
    && (!status || item.status === status)
    && (!course || item.courseInterestedIn === course)
    && (!dateFrom || item.enquiryDate >= dateFrom)
    && (!dateTo || item.enquiryDate <= dateTo)
  ))
  const filtersActive = Boolean(search || status || course || dateFrom || dateTo || dateFilter !== 'all')

  const groups = groupEnquiriesByDate(filtered)
  groups.forEach((group) => {
    if (group.isExpanded) {
      expandedGroups.add(group.date)
    }
  })

  return (
    <>
      <header className="enquiries-header">
        <div>
          <h1 className="page__title">Enquiries</h1>
        </div>
        <Button onClick={() => setFormEnquiry(null)}><Plus aria-hidden="true" size={17} />New Enquiry</Button>
      </header>

      {!isLoading && !loadError && enquiries.length > 0 && (
        <section className="enquiries-summary" aria-label="Enquiry summary">
          <button 
            className={`enquiries-summary-card enquiries-summary-card--all${dateFilter === 'all' && status === '' ? ' enquiries-summary-card--active' : ''}`}
            onClick={() => { setDateFilter('all'); setStatus(''); setQuery(''); setCourse(''); setDateFrom(''); setDateTo('') }}
            type="button"
          >
            <div className="enquiries-summary-card__label">Total Enquiries</div>
            <div className="enquiries-summary-card__value">{enquiries.length}</div>
          </button>
          <button 
            className={`enquiries-summary-card enquiries-summary-card--new${dateFilter === 'today' && status === '' ? ' enquiries-summary-card--active' : ''}`}
            onClick={() => { applyDateFilter('today'); setStatus(''); setQuery(''); setCourse('') }}
            type="button"
          >
            <div className="enquiries-summary-card__label">Today's Enquiries</div>
            <div className="enquiries-summary-card__value">{enquiries.filter((item) => isToday(item.enquiryDate)).length}</div>
          </button>
          <button 
            className={`enquiries-summary-card enquiries-summary-card--followup${status === 'Follow-up' ? ' enquiries-summary-card--active' : ''}`}
            onClick={() => { setStatus('Follow-up'); setDateFilter('all'); setQuery(''); setCourse(''); setDateFrom(''); setDateTo('') }}
            type="button"
          >
            <div className="enquiries-summary-card__label">Follow-up</div>
            <div className="enquiries-summary-card__value">{enquiries.filter((item) => item.status === 'Follow-up').length}</div>
          </button>
          <button 
            className={`enquiries-summary-card enquiries-summary-card--converted${status === 'Converted' ? ' enquiries-summary-card--active' : ''}`}
            onClick={() => { setStatus('Converted'); setDateFilter('all'); setQuery(''); setCourse(''); setDateFrom(''); setDateTo('') }}
            type="button"
          >
            <div className="enquiries-summary-card__label">Converted</div>
            <div className="enquiries-summary-card__value">{enquiries.filter((item) => item.status === 'Converted').length}</div>
          </button>
        </section>
      )}

      {notice && <div className={`enquiries-notice${notice.warning ? ' enquiries-notice--warning' : ''}`} role="status"><span>{notice.message}</span><Button variant="secondary" iconOnly aria-label="Dismiss message" onClick={() => setNotice(null)}><X aria-hidden="true" size={15} /></Button></div>}

      {!isLoading && !loadError && (enquiries.length > 0 || filtersActive) && (
        <>
          <div className="enquiries-date-filter" aria-label="Date filter">
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'all' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => applyDateFilter('all')}
              type="button"
            >
              All
            </button>
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'today' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => applyDateFilter('today')}
              type="button"
            >
              Today
            </button>
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'yesterday' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => applyDateFilter('yesterday')}
              type="button"
            >
              Yesterday
            </button>
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'week' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => applyDateFilter('week')}
              type="button"
            >
              This Week
            </button>
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'month' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => applyDateFilter('month')}
              type="button"
            >
              This Month
            </button>
            <button 
              className={`enquiries-date-filter__button${dateFilter === 'custom' ? ' enquiries-date-filter__button--active' : ''}`}
              onClick={() => setDateFilter('custom')}
              type="button"
            >
              <Calendar aria-hidden="true" size={16} />
              Custom
            </button>
          </div>
        </>
      )}

      <Card className="enquiries-filters">
        <div className="enquiries-filters__grid">
          <Input id="enquiries-search" label="Search" placeholder="Name, mobile, email, college, course" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select id="enquiries-status" label="Status" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          <CourseSelect id="enquiries-course" label="Course" options={courseOptions} value={course} onChange={(event) => setCourse(event.target.value)} />
          <Input id="enquiries-from" label="From" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input id="enquiries-to" label="To" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
          <div className="enquiries-filters__actions">
            {filtersActive && <Button variant="secondary" onClick={() => { setQuery(''); setStatus(''); setCourse(''); setDateFrom(''); setDateTo(''); setDateFilter('all') }}>Clear filters</Button>}
            <Button variant="secondary" onClick={() => void refresh()} disabled={isRefreshing}><RefreshCw aria-hidden="true" size={15} />{isRefreshing ? 'Refreshing...' : 'Refresh'}</Button>
          </div>
        </div>
      </Card>

      {loadError ? (
        <EmptyState icon={<RefreshCw size={22} />} title="Enquiries unavailable" description={loadError} action={<Button onClick={() => void refresh()}>Try Again</Button>} />
      ) : isLoading ? (
        <Card className="enquiries-loading"><RefreshCw aria-hidden="true" size={20} /><span>Loading enquiries...</span></Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={22} />} title={filtersActive ? 'No enquiries found' : 'No enquiries yet'} description={filtersActive ? 'Try adjusting your search or filters.' : 'New enquiries will appear here.'} action={!filtersActive ? <Button onClick={() => setFormEnquiry(null)}><Plus aria-hidden="true" size={16} />New Enquiry</Button> : undefined} />
      ) : (
        <>
          <div className="enquiries-results">
            <div>
              <h2>Enquiry Directory</h2>
              <p>{filtered.length} of {enquiries.length} enquiries</p>
            </div>
          </div>
          
          {groups.map((group: EnquiryGroup) => (
            <div key={group.date} className="enquiries-group">
              <button 
                className="enquiries-group__header"
                onClick={() => {
                  const newExpanded = new Set(expandedGroups)
                  if (newExpanded.has(group.date)) {
                    newExpanded.delete(group.date)
                  } else {
                    newExpanded.add(group.date)
                  }
                  setExpandedGroups(newExpanded)
                }}
                type="button"
              >
                <ChevronDown 
                  aria-hidden="true" 
                  size={18} 
                  className={`enquiries-group__chevron${expandedGroups.has(group.date) ? ' enquiries-group__chevron--expanded' : ''}`}
                />
                <div className="enquiries-group__title">
                  <h3>{group.label}</h3>
                  <span className="enquiries-group__count">{group.count} enquiry{group.count !== 1 ? 'ies' : ''}</span>
                </div>
              </button>
              
              {expandedGroups.has(group.date) && (
                <div className="enquiries-table-wrapper">
                  <Table className="enquiries-table">
                    <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Education Level</th><th>Course Interested</th><th>College Name</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {group.enquiries.map((item) => (
                        <tr key={item.enquiryId}>
                          <td className="enquiries-table__name"><strong>{item.fullName}</strong></td>
                          <td>{item.mobileNumber}</td>
                          <td className="enquiries-table__email">{item.email || '-'}</td>
                          <td>{item.educationLevel || item.degreeCourse || '-'}</td>
                          <td><CourseLabel name={item.courseInterestedIn} /></td>
                          <td>{item.college || '-'}</td>
                          <td><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td>
                          <td>
                            <div className="enquiries-table__actions" ref={openActionMenu === item.enquiryId ? actionMenuRef : null}>
                              <div className="enquiries-action-menu">
                                <Button 
                                  variant="secondary" 
                                  iconOnly 
                                  aria-label={`Actions for ${item.fullName}`} 
                                  title="Actions"
                                  onClick={() => handleActionClick(item.enquiryId)}
                                >
                                  <MoreVertical aria-hidden="true" size={16} />
                                </Button>
                                {openActionMenu === item.enquiryId && (
                                  <div className="enquiries-action-menu__popup">
                                    <button 
                                      className="enquiries-action-menu__item"
                                      onClick={() => { setFormEnquiry(item); setOpenActionMenu(null) }}
                                      type="button"
                                    >
                                      Edit Enquiry
                                    </button>
                                    {item.admissionId && (
                                      <button 
                                        className="enquiries-action-menu__item"
                                        onClick={() => { viewAdmission(item.admissionId); setOpenActionMenu(null) }}
                                        type="button"
                                      >
                                        View Admission
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          ))}

          <div className="enquiries-mobile-list">
            {groups.map((group: EnquiryGroup) => (
              <div key={group.date}>
                <div className="enquiries-group__header--mobile">
                  <h3>{group.label}</h3>
                  <span>{group.count} enquiry{group.count !== 1 ? 'ies' : ''}</span>
                </div>
                {expandedGroups.has(group.date) && group.enquiries.map((item) => (
                  <Card className="enquiries-mobile-item" key={item.enquiryId}>
                    <div className="enquiries-mobile-item__heading"><div><strong>{item.fullName}</strong><CourseLabel name={item.courseInterestedIn} /></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div>
                    <dl>
                      <div><dt>Mobile</dt><dd>{item.mobileNumber}</dd></div><div><dt>Email</dt><dd>{item.email || '-'}</dd></div><div><dt>Education Level</dt><dd>{item.educationLevel || item.degreeCourse || '-'}</dd></div><div><dt>College Name</dt><dd>{item.college || '-'}</dd></div>{item.admissionId && <div><dt>Admission ID</dt><dd>{item.admissionId}</dd></div>}
                    </dl>
                    <div className="enquiries-mobile-item__actions">
                      <Button variant="secondary" onClick={() => setFormEnquiry(item)}>Edit</Button>
                      {item.admissionId && <Button onClick={() => viewAdmission(item.admissionId)}>View Admission</Button>}
                    </div>
                  </Card>
                ))}
              </div>
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