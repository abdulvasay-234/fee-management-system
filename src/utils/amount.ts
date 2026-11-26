const wholeNumberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  useGrouping: true,
})

export function parseAmount(value: string) {
  const amount = Number(value.replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

export function formatAmountInput(value: string) {
  const normalized = value.replace(/,/g, '').trim()

  if (normalized === '') return ''
  if (!/^\d*\.?\d{0,2}$/.test(normalized)) return null

  const [whole = '0', decimal] = normalized.split('.')
  const formattedWhole = wholeNumberFormatter.format(Number(whole || 0))
  return normalized.includes('.')
    ? `${formattedWhole}.${decimal ?? ''}`
    : formattedWhole
}

export function sumMoney(values: number[]) {
  const paise = values.reduce((total, value) => {
    const scaled = value * 100
    const amount = Math.round(scaled)
    if (!Number.isFinite(scaled) || !Number.isSafeInteger(amount) || Math.abs(scaled - amount) > 0.000001) {
      throw new Error('Invalid monetary amount.')
    }
    const next = total + amount
    if (!Number.isSafeInteger(next)) throw new Error('Monetary total exceeds the supported amount.')
    return next
  }, 0)
  return paise / 100
}

export function getPaymentStatus(totalPaid: number, balance: number) {
  if (balance < 0) return 'Overpaid'
  if (balance === 0) return 'Paid'
  return totalPaid > 0 ? 'Partially Paid' : 'Unpaid'
}