import type { AdmissionSnapshot, PaymentRecord } from '../workflow/workflowTypes'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatReceiptCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatReceiptDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return '—'

  let date: Date | null = null
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const usDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (isoDate) {
    date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))
  } else if (usDate) {
    date = new Date(Number(usDate[3]), Number(usDate[1]) - 1, Number(usDate[2]))
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = new Date(text)
    date = Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (!date || Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function receiptMessage(
  payment: PaymentRecord,
  greeting: string,
) {
  return `${greeting}

Receipt ID: ${payment.receiptId}
Admission Number: ${payment.studentId}
Course: ${payment.course}
Batch: ${payment.batch}
Payment Date: ${formatReceiptDate(payment.paymentDate)}
Current Payment: ${formatReceiptCurrency(payment.amountPaid)}
Amount Paid Till Now: ${formatReceiptCurrency(payment.totalPaid)}
Balance: ${formatReceiptCurrency(payment.balance)}
Payment Mode: ${payment.paymentMode}

Please attach the downloaded fee receipt manually before sending.

Regards,
Lords Skill Academy`
}

export function createEmailUrl(
  admission: AdmissionSnapshot,
  payment: PaymentRecord,
) {
  if (!admission.email.trim()) return null

  const subject = `LSA Fee Receipt - ${payment.receiptId}`
  const body = receiptMessage(
    payment,
    `Dear ${payment.studentName},\n\nPlease find your fee receipt details below.`,
  )
  return `mailto:${encodeURIComponent(admission.email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function normalizeWhatsAppNumber(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length < 11 || digits.length > 15) return null
  return digits
}

export function createWhatsAppUrl(
  admission: AdmissionSnapshot,
  payment: PaymentRecord,
) {
  const phone = normalizeWhatsAppNumber(admission.mobileNumber)
  if (!phone) return null

  const message = receiptMessage(
    payment,
    `Dear ${payment.studentName},\n\nYour fee receipt from Lords Skill Academy is ready.`,
  ).replace('\nRegards,', '\nThank you,')

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export async function downloadReceiptPdf(
  receiptElement: HTMLElement,
  receiptId: string,
) {
  await document.fonts.ready
  await Promise.all(
    Array.from(receiptElement.querySelectorAll('img')).map((image) =>
      image.complete ? Promise.resolve() : image.decode(),
    ),
  )

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const canvas = await html2canvas(receiptElement, {
    backgroundColor: '#ffffff',
    logging: false,
    scale: 2,
    useCORS: true,
  })
  const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const margin = 10
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2
  const maxHeight = pdf.internal.pageSize.getHeight() - margin * 2
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale

  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    (pdf.internal.pageSize.getWidth() - width) / 2,
    margin,
    width,
    height,
    undefined,
    'FAST',
  )
  const objectUrl = URL.createObjectURL(pdf.output('blob'))
  const downloadLink = document.createElement('a')
  downloadLink.href = objectUrl
  downloadLink.download = `LSA-Receipt-${receiptId}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}