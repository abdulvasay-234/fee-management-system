import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { PaymentsDirectory } from '../features/payments/PaymentsDirectory'

export function PaymentHistoryPage() {
  const navigate = useNavigate()

  return (
    <section className="page page--payments">
      <header className="payments-page-header">
        <div><span className="page__eyebrow">LSA WORKSPACE</span><h1 className="page__title">Payments</h1><p className="page__description">Track fee collections, payment history, and outstanding balances.</p></div>
        <Button onClick={() => navigate('/fee-receipt')}><Plus aria-hidden="true" size={17} />New Payment</Button>
      </header>
      <PaymentsDirectory />
    </section>
  )
}