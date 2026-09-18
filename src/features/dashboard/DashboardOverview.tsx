import {
  ArrowRight,
  Award,
  Banknote,
  BookOpen,
  CalendarDays,
  ClipboardPlus,
  ExternalLink,
  IndianRupee,
  ReceiptText,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Table } from '../../components/ui'
import { fetchDashboard, type DashboardData } from '../../services/api'
import { formatReceiptCurrency, formatReceiptDate } from '../payments/receiptActions'

function OverviewCard({
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
    <Card className={`dashboard-summary-card${attention ? ' dashboard-summary-card--attention' : ''}`}>
      <div className="dashboard-summary-card__icon" aria-hidden="true">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </Card>
  )
}

function MetricPanel({
  title,
  metrics,
}: {
  title: string
  metrics: Array<{ label: string; value: string }>
}) {
  return (
    <Card className="dashboard-panel dashboard-metric-panel">
      <h2>{title}</h2>
      <div className="dashboard-metric-list">
        {metrics.map((metric) => (
          <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>
        ))}
      </div>
    </Card>
  )
}

function BarList({
  items,
  valueFormatter = String,
}: {
  items: Array<{ label: string; value: number }>
  valueFormatter?: (value: number) => string
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="dashboard-bars">
      {items.map((item) => (
        <div className="dashboard-bar" key={item.label}>
          <div className="dashboard-bar__label"><span>{item.label}</span><strong>{valueFormatter(item.value)}</strong></div>
          <div className="dashboard-bar__track"><span style={{ width: `${(item.value / maxValue) * 100}%` }} /></div>
        </div>
      ))}
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
      <header className="dashboard-panel__header"><h2>{title}</h2>{action}</header>
      {children}
    </Card>
  )
}

export function DashboardOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    void fetchDashboard().then((result) => { if (active) setData(result) })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the dashboard.') })
    return () => { active = false }
  }, [])

  if (!data) return <EmptyState title={loadError ? 'Unable to load dashboard' : 'Loading dashboard'} description={loadError || 'Fetching live admissions and payment metrics.'} />

  return (
    <>
      <section className="dashboard-summary" aria-label="Dashboard summary">
        <OverviewCard icon={<UsersRound size={19} />} label="Total Students" value={String(data.totalStudents)} />
        <OverviewCard icon={<IndianRupee size={19} />} label="Total Collected" value={formatReceiptCurrency(data.totalCollected)} />
        <OverviewCard icon={<WalletCards size={19} />} label="Outstanding Fees" value={formatReceiptCurrency(data.outstandingFees)} attention />
        <OverviewCard icon={<CalendarDays size={19} />} label="Today's Collection" value={formatReceiptCurrency(data.todaysCollection)} />
      </section>

      <DashboardSection title="LSA Quick Links">
        <div className="dashboard-official-links">
          <article><div className="dashboard-official-links__icon"><BookOpen aria-hidden="true" size={20} /></div><div><h3>Explore Programs</h3><p>View the latest courses and programs offered by Lords Skill Academy.</p></div><a className="button button--secondary" href="https://lordsskillacademy.com/programs" target="_blank" rel="noopener noreferrer">Visit LSA Programs<ExternalLink aria-hidden="true" size={15} /></a></article>
          <article><div className="dashboard-official-links__icon"><Award aria-hidden="true" size={20} /></div><div><h3>Download Certificate</h3><p>Find and download certificates issued by Lords Skill Academy.</p></div><a className="button button--secondary" href="https://lordsskillacademy.com/certificate" target="_blank" rel="noopener noreferrer">Download Certificate<ExternalLink aria-hidden="true" size={15} /></a></article>
        </div>
      </DashboardSection>

      <section className="dashboard-grid dashboard-grid--overview">
        <MetricPanel title="Admissions Overview" metrics={[
          { label: "Today's Admissions", value: String(data.admissionsOverview.today) },
          { label: "This Month's Admissions", value: String(data.admissionsOverview.thisMonth) },
          { label: 'Total Admissions', value: String(data.admissionsOverview.total) },
        ]} />
        <MetricPanel title="Collection Overview" metrics={[
          { label: "Today's Collection", value: formatReceiptCurrency(data.collectionOverview.today) },
          { label: "This Month's Collection", value: formatReceiptCurrency(data.collectionOverview.thisMonth) },
          { label: 'Total Collection', value: formatReceiptCurrency(data.collectionOverview.total) },
        ]} />
      </section>

      <section className="dashboard-grid dashboard-grid--charts">
        <DashboardSection title="Students by Course">
          {data.totalStudents ? <BarList items={data.studentsByCourse} /> : <EmptyState title="No students registered yet" description="Student distribution will appear after the first admission." action={<Button onClick={() => navigate('/new-admission')}>New Admission</Button>} />}
        </DashboardSection>
        <DashboardSection title="Collection by Course">
          {data.recentPayments.length ? <BarList items={data.collectionByCourse} valueFormatter={formatReceiptCurrency} /> : <EmptyState title="No payments yet" description="Course collections will appear after the first payment." action={<Button onClick={() => navigate('/fee-receipt')}>New Payment</Button>} />}
        </DashboardSection>
      </section>

      <section className="dashboard-grid dashboard-grid--activity">
        <DashboardSection title="Recent Admissions" action={<Button variant="secondary" onClick={() => navigate('/students')}>View All Students<ArrowRight aria-hidden="true" size={14} /></Button>}>
          {data.recentAdmissions.length ? (
            <Table className="dashboard-table"><thead><tr><th>Admission Number</th><th>Student Name</th><th>Course</th><th>Batch</th><th>Admission Date</th></tr></thead><tbody>{data.recentAdmissions.map((student) => <tr key={student.studentId}><td><strong>{student.studentId}</strong></td><td>{student.fullName}</td><td>{student.course}</td><td>{student.batch}</td><td>{formatReceiptDate(student.admissionDate)}</td></tr>)}</tbody></Table>
          ) : <EmptyState title="No admissions yet" description="New admissions will appear here." action={<Button onClick={() => navigate('/new-admission')}>New Admission</Button>} />}
        </DashboardSection>
        <DashboardSection title="Recent Payments" action={<Button variant="secondary" onClick={() => navigate('/payment-history')}>View All Payments<ArrowRight aria-hidden="true" size={14} /></Button>}>
          {data.recentPayments.length ? (
            <Table className="dashboard-table dashboard-payments-table"><thead><tr><th>Receipt ID</th><th>Student Name</th><th>Course</th><th>Current Payment</th><th>Payment Date</th><th>Payment Mode</th></tr></thead><tbody>{data.recentPayments.map((payment) => <tr key={payment.receiptId}><td><strong>{payment.receiptId}</strong></td><td>{payment.studentName}</td><td>{payment.course}</td><td>{formatReceiptCurrency(payment.amountPaid)}</td><td>{formatReceiptDate(payment.paymentDate)}</td><td>{payment.paymentMode}</td></tr>)}</tbody></Table>
          ) : <EmptyState title="No payments yet" description="Recent fee payments will appear here." action={<Button onClick={() => navigate('/fee-receipt')}>New Payment</Button>} />}
        </DashboardSection>
      </section>

      <section className="dashboard-grid dashboard-grid--utility">
        <DashboardSection title="Payment Modes"><BarList items={data.paymentModes} /></DashboardSection>
        <DashboardSection title="Quick Actions">
          <div className="dashboard-actions">
            <Button onClick={() => navigate('/new-admission')}><ClipboardPlus aria-hidden="true" size={16} />New Admission</Button>
            <Button variant="secondary" onClick={() => navigate('/fee-receipt')}><Banknote aria-hidden="true" size={16} />New Payment</Button>
            <Button variant="secondary" onClick={() => navigate('/students')}><UsersRound aria-hidden="true" size={16} />Students</Button>
            <Button variant="secondary" onClick={() => navigate('/payment-history')}><ReceiptText aria-hidden="true" size={16} />Payments</Button>
          </div>
        </DashboardSection>
      </section>

    </>
  )
}