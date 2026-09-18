import { forwardRef } from 'react'
import { Badge } from '../../components/ui'
import type { AdmissionSnapshot, PaymentRecord } from '../workflow/workflowTypes'
import { formatReceiptCurrency, formatReceiptDate } from './receiptActions'

const lsaWhiteLogo = `${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent-%20WHite.png`

interface FeeReceiptProps {
  admission: AdmissionSnapshot
  payment: PaymentRecord
}

export const FeeReceipt = forwardRef<HTMLElement, FeeReceiptProps>(
  function FeeReceipt({ admission, payment }, ref) {
    return (
      <article className="receipt-preview" ref={ref}>
        <header className="receipt-preview__header">
          <div className="receipt-preview__brand">
            <img className="receipt-preview__logo" src={lsaWhiteLogo} alt="Lords Skill Academy" />
            <div className="receipt-preview__brand-copy">
              <span>Lords Skill Academy</span>
              <address>
                3rd floor Pillar No 4, KFC Building, 10-3-76, Mehdipatnam Rd,
                Royal Colony, Humayun Nagar, Hyderabad, Telangana 500028
              </address>
            </div>
          </div>
          <div className="receipt-preview__status">
            <Badge variant="yellow">Payment recorded</Badge>
            <span>Receipt ID</span>
            <strong>{payment.receiptId}</strong>
          </div>
        </header>
        <div className="receipt-preview__title">
          <h2>LSA Fee Receipt</h2>
        </div>
        <dl className="receipt-preview__details">
          <div><dt>Admission Number</dt><dd>{admission.admissionNumber}</dd></div>
          <div><dt>Student Name</dt><dd>{admission.studentName}</dd></div>
          <div><dt>Course</dt><dd>{admission.course}</dd></div>
          <div><dt>Batch</dt><dd>{admission.batchNumber}</dd></div>
          <div><dt>Enrollment Month / Year</dt><dd>{admission.enrollmentMonth} {admission.enrollmentYear}</dd></div>
          <div><dt>Admission Date</dt><dd>{formatReceiptDate(admission.admissionDate)}</dd></div>
          <div><dt>Payment Date</dt><dd>{formatReceiptDate(payment.paymentDate)}</dd></div>
          <div><dt>Fee Type</dt><dd>{payment.feeType}</dd></div>
        </dl>
        <section className="receipt-preview__amounts" aria-label="Receipt totals">
          <div><span>Amount Paid Till Now</span><strong>{formatReceiptCurrency(payment.totalPaid)}</strong></div>
          <div><span>Current Payment</span><strong>{formatReceiptCurrency(payment.amountPaid)}</strong></div>
          <div><span>Balance</span><strong>{formatReceiptCurrency(payment.balance)}</strong></div>
        </section>
        <dl className="receipt-preview__footer-details">
          <div><dt>Payment Mode</dt><dd>{payment.paymentMode}</dd></div>
          <div><dt>Remarks</dt><dd>{payment.remarks || '—'}</dd></div>
        </dl>
      </article>
    )
  },
)