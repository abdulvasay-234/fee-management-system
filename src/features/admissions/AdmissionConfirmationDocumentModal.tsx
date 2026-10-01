import { Download, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { downloadAdmissionConfirmationPdf } from './admissionConfirmationActions'
import type { AdmissionConfirmationData } from './admissionConfirmation'
import { AdmissionConfirmationDocument } from './AdmissionConfirmationDocument'

interface AdmissionConfirmationDocumentModalProps {
  data: AdmissionConfirmationData
  onClose: () => void
  open: boolean
}

export function AdmissionConfirmationDocumentModal({
  data,
  onClose,
  open,
}: AdmissionConfirmationDocumentModalProps) {
  const documentRef = useRef<HTMLElement | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [printError, setPrintError] = useState('')

  async function downloadPdf() {
    if (!documentRef.current) return
    setIsDownloading(true)
    setDownloadError('')
    try {
      await downloadAdmissionConfirmationPdf(documentRef.current, data.studentId)
    } catch {
      setDownloadError('Unable to generate the Admission PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  function printDocument() {
    setPrintError('')
    try {
      if (typeof window.print !== 'function') throw new Error('Printing is unavailable.')
      window.print()
    } catch {
      setPrintError('Printing is unavailable in this browser.')
    }
  }

  return (
    <Modal
      className="admission-confirmation-modal"
      open={open}
      title="Admission Confirmation"
      description={`${data.fullName} · ${data.studentId}`}
      onClose={onClose}
      footer={(
        <div className="admission-confirmation-actions">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={printDocument}>
            <Printer aria-hidden="true" size={16} />
            Print
          </Button>
          <Button onClick={() => void downloadPdf()} disabled={isDownloading}>
            <Download aria-hidden="true" size={16} />
            {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
        </div>
      )}
    >
      <AdmissionConfirmationDocument data={data} ref={documentRef} />
      {downloadError && <p className="admission-confirmation-action-error" role="alert">{downloadError}</p>}
      {printError && <p className="admission-confirmation-action-error" role="alert">{printError}</p>}
    </Modal>
  )
}