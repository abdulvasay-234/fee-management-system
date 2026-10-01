import { forwardRef } from 'react'
import type { AdmissionConfirmationData } from './admissionConfirmation'

const lsaBlackLogo = `${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent-%20Black.png`
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function formatDate(value: string) {
  if (!value) return ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+05:30`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(date)
}

function hasValue(value: string | number) {
  return String(value ?? '').trim() !== ''
}

function DetailSection({
  fields,
  title,
}: {
  fields: Array<{ label: string; value: string }>
  title: string
}) {
  const values = fields.filter(({ value }) => hasValue(value))
  if (!values.length) return null
  return (
    <section className="admission-confirmation-section">
      <h2>{title}</h2>
      <dl>
        {values.map(({ label, value }) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  )
}

interface AdmissionConfirmationDocumentProps {
  data: AdmissionConfirmationData
}

export const AdmissionConfirmationDocument = forwardRef<HTMLElement, AdmissionConfirmationDocumentProps>(
  function AdmissionConfirmationDocument({ data }, ref) {
    const isOtherPrograms = data.course.trim().toLowerCase() === 'other programs'
    const programAndFeeDetails = [
      { label: 'Course', value: data.course },
      ...(isOtherPrograms && hasValue(data.otherProgramDetails)
        ? [{ label: 'Program / Training Interested In', value: data.otherProgramDetails }]
        : []),
      { label: 'Batch', value: data.batch },
      { label: 'Course Duration', value: data.courseDuration },
      { label: 'Admission Date', value: formatDate(data.admissionDate) },
      { label: 'Class Timing', value: [data.startTime, data.endTime].filter(Boolean).join(' - ') },
      { label: 'Total Course Fee', value: currencyFormatter.format(data.totalCourseFee) },
      { label: 'Discount', value: currencyFormatter.format(data.discount) },
      { label: 'Final Fee', value: currencyFormatter.format(data.finalFee) },
    ]

    return (
      <article className="admission-confirmation-document" ref={ref}>
        <section className="admission-confirmation-document__confirmation">
          <header className="admission-confirmation-document__header">
            <div className="admission-confirmation-document__brand">
              <img src={lsaBlackLogo} alt="Lords Skill Academy" />
              <div>
                <strong>LORDS SKILL ACADEMY</strong>
                <span>An Initiative of Lords Institute of Engineering &amp; Technology</span>
              </div>
            </div>
            <div className="admission-confirmation-document__id">
              <span>Student / Admission ID</span>
              <strong>{data.studentId}</strong>
            </div>
          </header>

          <div className="admission-confirmation-document__title">
            <span>OFFICIAL STUDENT RECORD</span>
            <h1>ADMISSION CONFIRMATION</h1>
          </div>
          <p className="admission-confirmation-document__intro">
            This confirms the student&apos;s admission to Lords Skill Academy under the program recorded below.
          </p>

          <div className="admission-confirmation-document__details">
            <DetailSection title="Student Information" fields={[
              { label: 'Full Name', value: data.fullName },
              { label: 'Mobile Number', value: data.mobileNumber },
              { label: 'Email', value: data.email || 'Not provided' },
              { label: 'College', value: data.collegeName },
              { label: 'Education Level', value: data.educationLevel },
              { label: 'Specialization', value: data.specialization },
              { label: 'Year of Graduation', value: data.yearOfGraduation },
            ]} />
            <DetailSection title="Program & Fee Information" fields={programAndFeeDetails} />
          </div>

          <div className="admission-confirmation-document__official-signature" aria-label="Afnan, LSA official signature and academy seal">
            <div className="admission-confirmation-document__seal" role="img" aria-label="Lords Skill Academy, Hyderabad">
              <span>LORDS SKILL</span>
              <span>ACADEMY</span>
              <span>HYDERABAD</span>
            </div>
            <div className="admission-confirmation-document__signature-copy">
              <span className="admission-confirmation-document__signature-name" aria-hidden="true">Afnan</span>
              <span className="admission-confirmation-document__signature-label">LSA Official</span>
            </div>
          </div>
        </section>

        <section className="admission-confirmation-document__terms">
          <div className="admission-confirmation-document__terms-heading">
            <span>PLEASE READ CAREFULLY</span>
            <h2>TERMS &amp; CONDITIONS</h2>
          </div>
          <ol>
            <li>Admission is recorded using the information provided by the student and is subject to verification of submitted details and documents.</li>
            <li>Students are expected to follow academy rules, maintain respectful conduct, attend scheduled sessions, and participate in course activities.</li>
            <li>Course completion and any certificate are subject to completing the required learning activities, assignments, and assessments.</li>
            <li>Class timings, trainers, or course delivery may be reasonably adjusted by the academy. Students will be informed of material changes.</li>
            <li className="admission-confirmation-document__placement-term"><strong>Placement Support:</strong> eligibility requires at least 90% attendance and a minimum score of 85% in assessments. Meeting these criteria qualifies the student for placement support, but does not guarantee employment or selection by an employer.</li>
            <li>Students are responsible for keeping their contact details current and communicating absences or other relevant changes to the academy.</li>
            <li>Fees are payable as agreed at admission. This confirmation records admission details and is not a fee payment receipt.</li>
          </ol>
          <div className="admission-confirmation-document__acknowledgement">
            <p>By accepting admission, the student acknowledges and agrees to these terms and conditions.</p>
            <div className="admission-confirmation-document__acknowledgement-fields">
              <span className="admission-confirmation-document__student-signature">Student signature</span>
              <span className="admission-confirmation-document__created-date">
                <strong>Admission Created</strong>
                <time dateTime={data.createdAt || data.admissionDate}>{formatDate(data.createdAt || data.admissionDate)}</time>
              </span>
            </div>
          </div>
        </section>
      </article>
    )
  },
)