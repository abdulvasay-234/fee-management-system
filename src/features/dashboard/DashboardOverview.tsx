import {
  ArrowRight,
  Banknote,
  ClipboardPlus,
  IndianRupee,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState } from '../../components/ui'
import { fetchDashboard, type DashboardData, fetchEnquiries } from '../../services/api'
import { formatReceiptCurrency, formatReceiptDate } from '../payments/receiptActions'
import { isToday } from './dashboardUtils'

function KPICard({
  icon,
  label,
  value,
  attention = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  attention?: boolean
}) {
  return (
    <Card className={`dashboard-kpi-card${attention ? ' dashboard-kpi-card--attention' : ''}`}>
      <div className="dashboard-kpi-card__icon" aria-hidden="true">{icon}</div>
      <div className="dashboard-kpi-card__content">
        <span className="dashboard-kpi-card__label">{label}</span>
        <strong className="dashboard-kpi-card__value">{value}</strong>
      </div>
    </Card>
  )
}

function ActivityItem({
  type,
  id,
  primaryText,
  secondaryText,
  tertiaryText,
  date,
}: {
  type: 'admission' | 'payment'
  id: string
  primaryText: string
  secondaryText: string
  tertiaryText: string
  date: string
}) {
  return (
    <div className="dashboard-activity-item">
      <div className="dashboard-activity-item__marker" data-type={type} aria-hidden="true" />
      <div className="dashboard-activity-item__content">
        <div className="dashboard-activity-item__header">
          <strong className="dashboard-activity-item__id">{id}</strong>
          <span className="dashboard-activity-item__date">{date}</span>
        </div>
        <div className="dashboard-activity-item__details">
          <span>{primaryText}</span>
          <span>{secondaryText}</span>
          <span>{tertiaryText}</span>
        </div>
      </div>
    </div>
  )
}

function DashboardSection({
  action,
  children,
  title,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  title: string
}) {
  return (
    <Card className="dashboard-panel">
      <header className="dashboard-panel__header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </Card>
  )
}

export function DashboardOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [todaysEnquiries, setTodaysEnquiries] = useState(0)

  useEffect(() => {
    let active = true
    
    Promise.all([
      fetchDashboard(),
      fetchEnquiries(),
    ])
      .then(([dashboardData, enquiriesData]) => {
        if (!active) return
        setData(dashboardData)
        
        // Calculate today's enquiries
        const todayCount = enquiriesData.filter(e => isToday(e.createdAt)).length
        setTodaysEnquiries(todayCount)
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load the dashboard.')
        }
      })
    
    return () => { active = false }
  }, [])

  if (!data) return <EmptyState title={loadError ? 'Unable to load dashboard' : 'Loading dashboard'} description={loadError || 'Fetching live admissions and payment metrics.'} />

  // Combine and sort recent activity
  const allActivity = [
    ...data.recentAdmissions.map((student) => ({
      type: 'admission' as const,
      id: student.studentId,
      primaryText: student.fullName,
      secondaryText: student.course,
      tertiaryText: `Batch: ${student.batch}`,
      date: formatReceiptDate(student.admissionDate),
      timestamp: student.admissionDate,
    })),
    ...data.recentPayments.map((payment) => ({
      type: 'payment' as const,
      id: payment.receiptId,
      primaryText: payment.studentName,
      secondaryText: payment.course,
      tertiaryText: formatReceiptCurrency(payment.amountPaid),
      date: formatReceiptDate(payment.paymentDate),
      timestamp: payment.createdAt,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)

  return (
    <>
      {/* KPI Cards */}
      <section className="dashboard-kpi-section" aria-label="Key performance indicators">
        <KPICard
          icon={<UsersRound size={22} />}
          label="Total Students"
          value={String(data.totalStudents)}
        />
        <KPICard
          icon={<IndianRupee size={22} />}
          label="Total Collected"
          value={formatReceiptCurrency(data.totalCollected)}
        />
        <KPICard
          icon={<WalletCards size={22} />}
          label="Outstanding Fees"
          value={formatReceiptCurrency(data.outstandingFees)}
          attention
        />
        <KPICard
          icon={<TrendingUp size={22} />}
          label="Today's Enquiries"
          value={String(todaysEnquiries)}
        />
      </section>

      {/* Quick Actions */}
      <DashboardSection title="Quick Actions">
        <div className="dashboard-quick-actions">
          <Button
            onClick={() => navigate('/walk-ins')}
            className="dashboard-quick-action-btn"
          >
            <UserRoundCheck aria-hidden="true" size={18} />
            Add Walk-in Enquiry
          </Button>
          <Button
            onClick={() => navigate('/new-admission')}
            className="dashboard-quick-action-btn"
          >
            <ClipboardPlus aria-hidden="true" size={18} />
            New Admission
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/fee-receipt')}
            className="dashboard-quick-action-btn"
          >
            <Banknote aria-hidden="true" size={18} />
            New Payment
          </Button>
        </div>
      </DashboardSection>

      {/* Recent Activity */}
      <DashboardSection
        title="Recent Activity"
        action={<Button variant="secondary" onClick={() => navigate('/students')}>View All<ArrowRight aria-hidden="true" size={14} /></Button>}
      >
        {allActivity.length ? (
          <div className="dashboard-activity-list">
            {allActivity.map((item) => (
              <ActivityItem
                key={`${item.type}-${item.id}`}
                type={item.type}
                id={item.id}
                primaryText={item.primaryText}
                secondaryText={item.secondaryText}
                tertiaryText={item.tertiaryText}
                date={item.date}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Recent admissions and payments will appear here."
            action={
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button onClick={() => navigate('/new-admission')}>New Admission</Button>
                <Button variant="secondary" onClick={() => navigate('/fee-receipt')}>New Payment</Button>
              </div>
            }
          />
        )}
      </DashboardSection>
    </>
  )
}