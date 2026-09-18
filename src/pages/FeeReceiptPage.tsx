import { FeeReceiptWorkflow } from '../features/payments/FeeReceiptWorkflow'

export function FeeReceiptPage() {
  return (
    <section className="page page--payment">
      <header className="page__header">
        <span className="page__eyebrow">LSA WORKSPACE</span>
        <h1 className="page__title">Fee Payment & Receipt</h1>
        <p className="page__description">
          Record a student payment and prepare a fee receipt.
        </p>
      </header>
      <FeeReceiptWorkflow />
    </section>
  )
}