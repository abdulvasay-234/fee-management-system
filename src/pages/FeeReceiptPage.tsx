import { FeeReceiptWorkflow } from '../features/payments/FeeReceiptWorkflow'

export function FeeReceiptPage() {
  return (
    <section className="page page--payment">
      <header className="page__header">
        <h1 className="page__title">Fee Payment</h1>
        <p className="page__description">
          Record a student payment and review the updated fee balance.
        </p>
      </header>
      <FeeReceiptWorkflow />
    </section>
  )
}