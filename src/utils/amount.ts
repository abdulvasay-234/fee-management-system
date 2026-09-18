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