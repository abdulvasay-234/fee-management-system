import { AdmissionForm } from '../admissions/AdmissionForm'
import type { ConvertEnquiryResponse, EnquiryRecord } from '../../services/api'

interface EnquiryConversionModalProps {
  enquiry: EnquiryRecord
  onCheckStatus: () => void
  onClose: () => void
  onSuccess: (result: ConvertEnquiryResponse) => void
  onViewStudent: (studentId: string) => void
}

export function EnquiryConversionModal({
  enquiry,
  onCheckStatus,
  onClose,
  onSuccess,
  onViewStudent,
}: EnquiryConversionModalProps) {
  return (
    <AdmissionForm
      mode="convert"
      enquiry={enquiry}
      onClose={onClose}
      onConversionOutcomeUnknown={onCheckStatus}
      onConversionSuccess={onSuccess}
      onViewStudent={onViewStudent}
    />
  )
}
