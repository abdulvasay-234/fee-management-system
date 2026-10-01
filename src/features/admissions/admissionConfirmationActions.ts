export async function downloadAdmissionConfirmationPdf(documentElement: HTMLElement, studentId: string) {
  documentElement.classList.add('admission-confirmation-document--pdf')
  try {
    await document.fonts.ready
    await Promise.all(
      Array.from(documentElement.querySelectorAll('img')).map((image) => (
        image.complete ? Promise.resolve() : image.decode()
      )),
    )
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const canvas = await html2canvas(documentElement, {
      backgroundColor: '#ffffff',
      logging: false,
      scale: 2,
      useCORS: true,
    })
    const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST')

    const objectUrl = URL.createObjectURL(pdf.output('blob'))
    const downloadLink = document.createElement('a')
    downloadLink.href = objectUrl
    downloadLink.download = `LSA-Admission-Confirmation-${studentId}.pdf`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } finally {
    documentElement.classList.remove('admission-confirmation-document--pdf')
  }
}