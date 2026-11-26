import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../../src/features/payments/receiptActions.ts', import.meta.url))
const { createPaymentAcknowledgementUrl } = await import(modulePath)

const admission = { mobileNumber: '9876543210' }
const payment = {
  studentName: 'Test Student',
  course: 'Data Science',
  amountPaid: 5000,
  paymentDate: '2026-12-20',
  balance: 3000,
}

describe('payment acknowledgement WhatsApp link', () => {
  it('includes payment details and a date exactly 20 days later across years', () => {
    const url = new URL(createPaymentAcknowledgementUrl(admission, payment))
    const message = url.searchParams.get('text')
    expect(url.origin + url.pathname).toBe('https://wa.me/919876543210')
    expect(message).toContain('LSA - Data Science - Payment Acknowledgement - Test Student')
    expect(message).toContain('Amount Paid:')
    expect(message).toContain('5,000.00')
    expect(message).toContain('Payment Date: 20 December 2026')
    expect(message).toContain('Balance:')
    expect(message).toContain('3,000.00')
    expect(message).toContain('Next Payment Date: 09 January 2027')
  })

  it('handles leap days and omits the next date when fully paid', () => {
    const leapUrl = new URL(createPaymentAcknowledgementUrl(admission, { ...payment, paymentDate: '2024-02-20' }))
    expect(leapUrl.searchParams.get('text')).toContain('Next Payment Date: 11 March 2024')
    const paidUrl = new URL(createPaymentAcknowledgementUrl(admission, { ...payment, balance: 0 }))
    expect(paidUrl.searchParams.get('text')).toContain('No further payment is due.')
    expect(paidUrl.searchParams.get('text')).not.toContain('Next Payment Date:')
  })

  it('does not create a link for an invalid phone number or payment date', () => {
    expect(createPaymentAcknowledgementUrl({ mobileNumber: '' }, payment)).toBeNull()
    expect(createPaymentAcknowledgementUrl(admission, { ...payment, paymentDate: '2026-02-30' })).toBeNull()
  })
})
