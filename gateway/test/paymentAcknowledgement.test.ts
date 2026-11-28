import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/features/courseCodes/CourseLabel.tsx', () => ({
  CourseLabel: ({ name }: { name: string }) => name,
}))

const modulePath = fileURLToPath(new URL('../../src/features/payments/receiptActions.ts', import.meta.url))
const { createAdmissionConfirmationUrl, createFeeReminderUrl, createPaymentAcknowledgementUrl } = await import(modulePath)
const { toPaymentSnapshot } = await import(fileURLToPath(new URL('../../src/features/students/studentWorkflow.ts', import.meta.url)))
const { registerPendingSave, finishPendingSave, hasPendingSave } = await import(
  fileURLToPath(new URL('../../src/hooks/useSaveProtection.ts', import.meta.url)),
)

describe('pending save refresh protection', () => {
  const tokens: symbol[] = []
  afterEach(() => {
    tokens.splice(0).forEach(finishPendingSave)
    vi.unstubAllGlobals()
  })

  it('warns only while a save is pending and removes the warning after completion', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const token = Symbol('pending payment')
    tokens.push(token)
    const before = new Event('beforeunload', { cancelable: true })
    target.dispatchEvent(before)
    expect(before.defaultPrevented).toBe(false)
    registerPendingSave(token)
    expect(hasPendingSave()).toBe(true)
    const during = new Event('beforeunload', { cancelable: true })
    target.dispatchEvent(during)
    expect(during.defaultPrevented).toBe(true)
    finishPendingSave(token)
    expect(hasPendingSave()).toBe(false)
    const after = new Event('beforeunload', { cancelable: true })
    target.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })

  it('keeps the warning until all pending operations finish without double-counting the same save', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const first = Symbol('first save')
    const second = Symbol('second save')
    tokens.push(first, second)
    registerPendingSave(first)
    registerPendingSave(first)
    registerPendingSave(second)
    finishPendingSave(first)
    const during = new Event('beforeunload', { cancelable: true })
    target.dispatchEvent(during)
    expect(during.defaultPrevented).toBe(true)
    finishPendingSave(second)
    expect(hasPendingSave()).toBe(false)
    const after = new Event('beforeunload', { cancelable: true })
    target.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })
})

const admission = { mobileNumber: '9876543210' }
const payment = {
  studentName: 'Test Student',
  course: 'Data Science',
  amountPaid: 5000,
  paymentDate: '2026-12-20',
  balance: 3000,
}

const confirmationAdmission = {
  mobileNumber: '9000000001', email: '', studentName: 'Test Student',
  admissionNumber: 'TEST-ADM-001', admissionDate: '2026-11-27',
  course: 'Data Science', batchNumber: '01', courseDuration: '3 Months',
  startTime: '18:00', endTime: '20:00', enrollmentMonth: 'November', enrollmentYear: '2026',
  totalCourseFee: 8000, finalFee: 8000, discountPercentage: 0, previousPaid: 0,
}
const confirmationPayment = {
  ...payment, paymentId: 'TEST-PAY-001', receiptId: 'TEST-REC-001',
  studentId: confirmationAdmission.admissionNumber, batch: '01', feeType: 'Course Fee',
  enrollmentMonth: 'November', enrollmentYear: '2026', previousPaid: 0, totalPaid: 5000,
  paymentMode: 'Cash', createdBy: 'Test Staff', createdAt: '2026-12-20', remarks: '',
}

it('keeps the next fee deadline tied to the latest payment when recording a backdated receipt', () => {
  const snapshot = toPaymentSnapshot({
    ...confirmationAdmission, studentId: confirmationAdmission.admissionNumber,
    fullName: confirmationAdmission.studentName, totalPaid: 5000, latestPaymentDate: '2026-12-25',
  })
  const message = new URL(createPaymentAcknowledgementUrl(snapshot, confirmationPayment)).searchParams.get('text')
  expect(message).toContain('Payment Date: 20 December 2026')
  expect(message).toContain('Next Payment Date: 14 January 2027')
})

it.each(['2026-02-30', null])('does not invent a due date from an invalid latest payment date (%s)', (latestPaymentDate) => {
  expect(createPaymentAcknowledgementUrl({ ...confirmationAdmission, latestPaymentDate }, confirmationPayment)).toBeNull()
})

describe('admission confirmation WhatsApp option', () => {
  it('creates a later admission confirmation without inventing a payment receipt', () => {
    const message = new URL(createAdmissionConfirmationUrl(confirmationAdmission)).searchParams.get('text')
    expect(message).toContain('Your admission to Data Science at Lords Skill Academy is confirmed.')
    expect(message).toContain('Admission Date: 27 November 2026')
    expect(message).toContain('Class Time: 18:00 - 20:00 (IST)')
    expect(message).toContain('minimum of 90% attendance')
    expect(message).not.toContain('Payment Received:')
  })

  it('prepares the course, admission date, class times and daily 90% attendance rule', () => {
    const url = new URL(createAdmissionConfirmationUrl(confirmationAdmission, confirmationPayment))
    expect(url.origin + url.pathname).toBe('https://wa.me/919000000001')
    const message = url.searchParams.get('text')
    expect(message).toContain('Dear Test Student')
    expect(message).toContain('Your admission to Data Science at Lords Skill Academy is confirmed.')
    expect(message).toContain('Admission Number: TEST-ADM-001')
    expect(message).toContain('Batch: 01')
    expect(message).toContain('Admission Date: 27 November 2026')
    expect(message).toContain('Class Time: 18:00 - 20:00 (IST)')
    expect(message).toContain('Payment Received:')
    expect(message).toContain('5,000.00')
    expect(message).toContain('attend classes daily and maintain a minimum of 90% attendance')
  })

  it('does not prepare a confirmation with invalid contact, dates, times or a mismatched admission', () => {
    for (const overrides of [
      { mobileNumber: '' }, { admissionDate: '2026-02-30' }, { startTime: '' },
      { startTime: '24:00' }, { endTime: '20:60' }, { admissionNumber: 'DIFFERENT-ADM' },
    ]) {
      expect(createAdmissionConfirmationUrl({ ...confirmationAdmission, ...overrides }, confirmationPayment)).toBeNull()
    }
  })

  it.each([
    { name: 'first payment', previousPaid: 0, startTime: '18:00', shown: true, available: true },
    { name: 'later payment', previousPaid: 1000, startTime: '18:00', shown: false, available: false },
    { name: 'missing class time', previousPaid: 0, startTime: '', shown: true, available: false },
  ])('offers the confirmation only after the first successful payment ($name)', async ({ previousPaid, startTime, shown, available }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { WorkflowContext } = await import(fileURLToPath(new URL('../../src/features/workflow/WorkflowContext.ts', import.meta.url)))
    const { FeeReceiptWorkflow } = await import(fileURLToPath(new URL('../../src/features/payments/FeeReceiptWorkflow.tsx', import.meta.url)))
    const snapshot = {
      admission: { ...confirmationAdmission, startTime },
      payment: { ...confirmationPayment, previousPaid, totalPaid: previousPaid + 5000, balance: 3000 - previousPaid },
      setAdmission: vi.fn(), setPayment: vi.fn(), clearWorkflow: vi.fn(),
    }
    const html = renderToStaticMarkup(createElement(WorkflowContext, { value: snapshot },
      createElement(MemoryRouter, { initialEntries: [{ pathname: '/fee-receipt', state: { fromAdmission: true } }] },
        createElement(FeeReceiptWorkflow)),
    ))
    expect(html.includes('Send Admission Confirmation')).toBe(shown)
    const link = html.match(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?Send Admission Confirmation<\/a>/)?.[0]
    expect(Boolean(link)).toBe(available)
    expect(html).toContain('Send WhatsApp Message')
    if (available) {
      expect(link).toContain(createAdmissionConfirmationUrl(snapshot.admission, snapshot.payment))
    } else if (shown) {
      expect(html).toContain('Admission confirmation is unavailable.')
    }
  })
})

describe('fee reminder WhatsApp link', () => {
  it('requests the current remaining balance without requiring payment history or class timings', () => {
    const url = new URL(createFeeReminderUrl({ ...confirmationAdmission, startTime: '', admissionDate: '' }, 12500.50))
    expect(url.origin + url.pathname).toBe('https://wa.me/919000000001')
    expect(url.searchParams.get('text')).toBe(`IMPORTANT: FEE PAYMENT REMINDER

Dear Test Student,

Our records show that your course fee balance remains unpaid. Please give this matter your immediate attention.

Admission Number: TEST-ADM-001
Course: Data Science
Balance Left: ₹12,500.50

Please clear the outstanding balance without further delay. If you are facing any difficulty with payment, contact the LSA office promptly.

If payment has already been made, share the receipt with the LSA office for verification.

Lords Skill Academy`)
    expect(new URL(createFeeReminderUrl(confirmationAdmission, 0.01)).searchParams.get('text')).toContain('Balance Left: ₹0.01')
  })

  it('rejects cleared or invalid balances and incomplete recipient details', () => {
    for (const balance of [0, -10, NaN, Infinity, -Infinity]) {
      expect(createFeeReminderUrl(confirmationAdmission, balance)).toBeNull()
    }
    for (const overrides of [{ mobileNumber: '' }, { studentName: ' ' }, { admissionNumber: '' }, { course: ' ' }]) {
      expect(createFeeReminderUrl({ ...confirmationAdmission, ...overrides }, 3000)).toBeNull()
    }
  })
})

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
