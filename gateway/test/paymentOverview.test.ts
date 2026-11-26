import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../../src/features/payments/paymentOverview.ts', import.meta.url))
const { summarizePaymentOverview } = await import(modulePath)

const students = [
  { studentId: 'A001', course: 'Data Science', finalFee: 100.05, balance: 85 },
  { studentId: 'A002', course: 'data science', finalFee: 200, balance: 0 },
  { studentId: 'A003', course: 'Cyber Security', finalFee: 300, balance: 300 },
  { studentId: 'A004', course: 'Cyber Security', finalFee: 50, balance: -5 },
]
const payments = [
  { receiptId: 'R001', amountPaid: 10.01 },
  { receiptId: 'R002', amountPaid: 5.04 },
  { receiptId: 'R003', amountPaid: 200 },
  { receiptId: 'R004', amountPaid: 55 },
]

describe('Payments overview', () => {
  it('keeps actual collections separate from final fees and positive balances by course', () => {
    expect(summarizePaymentOverview(payments, students)).toEqual({
      totalCollected: 270.05,
      totalFees: 650.05,
      outstanding: 385,
      pendingAdmissions: 2,
      courses: [
        { name: 'Cyber Security', totalFees: 350, outstanding: 300 },
        { name: 'Data Science', totalFees: 300.05, outstanding: 85 },
      ],
    })
  })

  it('includes unpaid and fully paid courses and supports an empty directory', () => {
    expect(summarizePaymentOverview([], students.slice(2, 3)).courses)
      .toEqual([{ name: 'Cyber Security', totalFees: 300, outstanding: 300 }])
    expect(summarizePaymentOverview([], [students[1]]).courses)
      .toEqual([{ name: 'data science', totalFees: 200, outstanding: 0 }])
    expect(summarizePaymentOverview([], [])).toEqual({ totalCollected: 0, totalFees: 0, outstanding: 0, pendingAdmissions: 0, courses: [] })
  })

  it('rejects duplicate or missing identifiers and invalid monetary totals', () => {
    expect(() => summarizePaymentOverview(payments, [...students, { ...students[0], studentId: ' A001 ' }])).toThrow(/duplicate admission ID/)
    expect(() => summarizePaymentOverview([...payments, { ...payments[0], receiptId: ' R001 ' }], students)).toThrow(/duplicate receipt ID/)
    expect(() => summarizePaymentOverview([{ ...payments[0], receiptId: '' }], students)).toThrow(/missing or duplicate receipt ID/)
    expect(() => summarizePaymentOverview(payments, [{ ...students[0], course: '' }])).toThrow(/no course/)
    expect(() => summarizePaymentOverview(payments, [{ ...students[0], balance: NaN }])).toThrow(/monetary amount/)
  })
})
