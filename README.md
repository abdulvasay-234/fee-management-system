# LSA Fee Management

Internal fee management application for Lords Skill Academy.

## Stack

- React and TypeScript
- Vite
- React Router
- Plain CSS
- GitHub Pages

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run build
npm run lint
```

## Responsive typography

Interface text uses a shared scale that increases existing sizes by 15% on larger
screens and 10% on smaller screens, with a 12px minimum for UI text. Form controls
use at least 16px for readability and to avoid automatic zoom on mobile browsers.
Admission document typography remains separate to preserve its single-page A4 layout.

## Course colours

Course labels use automatic colours derived from immutable catalog course codes,
consistently across directories, course navigation, forms, details, and documents.
Renaming or reordering catalog courses does not change their colours. Historical
courses absent from the catalog use a normalized name-based colour. Course names
remain visible; colour is an additional cue, not a status or a filter.

## Enquiry education

College Name is optional in both new and edited enquiries. It uses the existing
`college` API field and `College` column in the Enquiries source and Enquiries
Index sheets, not a duplicate column. Existing enquiry header migration appends
the column if it is missing without shifting existing data. Conversion prefills
the admission's `collegeName`, stored in its `College Name` column; student details
read it from the admission source.

Saved non-empty Referral and Consulted By values (including custom "Other"
entries) are read-only on edit. Previously empty referral/consultant fields can
be filled once, then become read-only after saving. Enquiry Date is read-only
for existing enquiries. Apps Script rejects changes to these locked fields;
deploy the updated backend to enforce this rule beyond the form.

Enquiry education is sent in dedicated fields and the legacy `degreeCourse`
field. A reserved `[LSA Enquiry Education v1]:` notes entry preserves education,
specialization, and graduation when an older backend omits the newer columns.
The application removes this entry from displayed/editable notes and restores
missing education fields on reload. Existing non-empty dedicated fields take
precedence. Records whose details were already missing before this protection
still need recovery from their original source; the application does not invent them.

## Financial records

The admission stores the agreed course fee and discount; the final fee is the
student's fee obligation. Student balances and dashboard outstanding amounts are
derived from indexed payment transaction amounts, not the running totals
printed on historical receipts. A negative student balance represents an
overpayment; it does not offset another student's outstanding balance.

The Payments overview separates payments received from total final fees.
The Total Amount card highlights total final fees, with the amount received
shown underneath in smaller text.
Course breakdowns show final fee obligations and positive outstanding balances
for matching admissions, including courses with no recorded payments.

Payments opens in Student Fee Status, including admissions with no receipts.
Course and batch navigation combine with enrollment year/month, search, and
current Pending/Paid filters; Paid includes zero and negative balances.
Batch codes can be reused across years, so use the enrollment period to isolate
older cohorts. Refresh reloads the current admissions and payment records.

Summary cards follow the filtered view. Student Fee Status totals the selected
admissions and their linked receipts. Payment History totals matching receipts;
fee obligations and current outstanding amounts count each represented admission
once, regardless of the number of matching receipts. Payment date/month filters
apply only to history. Receipt running totals remain available in View Receipt;
Pending/Paid filters always use current admission balances, not historical receipt
balances. Receipts without a linked admission remain accessible in history and
are excluded from student fee totals and Pending/Paid filters.

The Admissions directory and its course breakdown count unique admission IDs
rather than unique people, including historical admissions.
Admission date totals use the browser's local calendar date. Course filters
include active catalog courses and courses found in historical admissions;
batch navigation is derived from the selected course's admission records.
Enrollment and batch activity statuses are not currently tracked.
The Admissions directory shows the recorded pending due balance, or Paid when
the balance is zero or negative. Missing or invalid balances show Unavailable.
The student details Make Payment button is disabled when the balance is zero
or negative; it remains available for any positive outstanding balance.
Fee Information also shows Number of Instalments / Payments Done, counted
from the admission's recorded receipts. No payments shows 0; loading or failed
payment history shows Loading or Unavailable rather than a misleading count.
Batch timings and admission dates remain available in student records.

Admission numbers use `YYCCBBSS`: admission year, course code, batch, and a
two-digit serial. The form previews the next serial after the highest saved
matching ID, rather than always showing 01. While records load or the preview
is unavailable, it shows SS instead of guessing. The backend assigns the final
number under its admission lock; another staff member's save can change the
previewed number. Each year/course/batch supports serials 01 through 99.
Existing admission IDs are not renumbered.

After a payment is recorded, staff can open a prefilled WhatsApp acknowledgement
for the student's mobile number. It suggests a next payment date 20 days later
only when a balance remains; sending the message requires confirmation in
WhatsApp.

After the first successful payment (confirmed previous paid amount of zero),
Send Admission Confirmation opens a separate WhatsApp draft with the course,
batch, admission date, class timings in IST, and payment received. It asks the
student to attend classes daily and maintain at least 90% attendance. Sending
remains manual; the existing payment acknowledgement option stays available.
Missing or invalid confirmation details disable the option with an error.

Student Records also has a WhatsApp confirmation icon beside View Admission
Document for sending the confirmation again later. It uses the saved admission
details without needing payment history and does not claim a new payment was
received. Missing or invalid contact/date/timing details disable the icon.

The Student Records fee summary includes Remind Fees beside Make Payment. It
opens a formal WhatsApp reminder requesting prompt clearance of the current
saved balance, with their admission number and course. It asks students who
have already paid to share their receipt for verification. Sending remains
manual; no payment or
student record is changed. Cleared fees disable the button. Invalid contact,
admission details or balance disable it with an error.

While an admission, enquiry, walk-in, follow-up, payment, or course-code change
is being saved, shared form controls are disabled and in-app clicks cannot
discard the pending save. Repeated submissions are blocked. Failed saves
display an error and unlock controls for correction or retry; fields that were
already read-only remain locked.

Refreshing, closing the tab, or leaving the site during a pending save triggers
the browser's standard warning about changes that may not be saved. Browsers
do not allow custom warning text and may suppress prompts without prior user
interaction. The warning is removed when saving finishes. Confirmed records
remain stored in the backend; refreshing does not erase already saved records.

Dialogs share one page scroll lock and Escape listener. Closing overlapping
dialogs in either order restores the original scrolling only after the last
dialog closes. Form rerenders do not reacquire the lock or reorder dialogs.
Escape closes only the most recently opened dialog, respects dropdown-handled
Escape events, and cannot dismiss a dialog during a pending save.

Payment requests require an idempotency key. On the first payment after the
backend is deployed, each payment source sheet is extended with `Idempotency
Key` and `Idempotency Fingerprint` columns without changing existing rows. These
columns allow a retry to recover a payment written before an interrupted
response. Older transactions do not have these keys. Do not retry an
unconfirmed payment until its source record and payment history have been
checked.

Selecting UPI in Payment Mode displays the existing academy QR image and the
entered payment amount. Other modes hide the QR. The static QR does not prefill
the amount or confirm a transfer: verify the receiver and payment in the UPI app
before saving the payment. An image-load failure is shown explicitly.

Cash payments require the receiving LSA staff member's name in Remarks; blank
or whitespace-only remarks are rejected. Remarks remain optional for other
payment modes. The name is saved in the existing Remarks column. Deploy updated
Apps Script to enforce the Cash rule beyond the form; existing saved payments
remain recoverable through their original idempotency keys.

The payment and student indexes are separate from the source sheets. A source
write can succeed even if index synchronization fails. The application reports
a warning and blocks financial reads and further payments until that payment's
index synchronization is retried successfully or the indexes are rebuilt.
Index rebuilds stop on missing sheets, duplicate identifiers, and
unlinked payments, except legacy standalone Other Programs receipts, which
remain unlinked collections and are counted in the rebuild result. Back up
and review source data before rebuilding; no historical data is automatically
corrected.

`#NUM!` in cached student Total Paid / Balance no longer blocks financial reads:
these totals are calculated from the actual receipts and admission Final Fee.
Damaged payment Total Paid snapshots are recovered from valid saved Previous
Paid plus Amount Paid. If Previous Paid is blank, the source receipt must match
the indexed student and amount; actual earlier receipts for that student in
source append order supply Previous Paid. Damaged Balance snapshots use the
matching admission's Final Fee minus that receipt's Total Paid. Payment dates
are not used to reorder installments when recovering these snapshots. Do not
reorder source receipt rows before recovery. Valid historical snapshots are
unchanged. Recovery is logged and does not write spreadsheet cells during reads.
Invalid original amounts/fees, missing recovery inputs, and damaged balances
without a matching admission still fail explicitly rather than guessing values.

After backing up and reviewing the source sheets, deploy the updated Apps Script
and run `previewFinancialSummaryRepair` in its editor to validate source records
and report how many payment cells need repair without writing them. With approval,
run `repairFinancialSummaries`: it replaces `#NUM!` cells in source Total Paid /
Balance and fills blank Previous Paid for those damaged totals from verified
source receipts, then runs the existing index rebuild.
Amounts, fees, identifiers, dates, remarks and valid source snapshots are not
changed. Financial access stays blocked if a repair/rebuild is interrupted;
correct the reported problem and rerun it. A GitHub push alone does not update
the Apps Script deployment or repair existing spreadsheet cells.

The payment summary helper returns `{ totalPaid: 0, paymentCount: 0 }` for an
empty source sheet, not a bare number. The writer uses validated paise arithmetic
and rejects missing/nonfinite or inconsistent totals before appending a receipt.
Older deployed code returned a bare `0` on this branch while its caller expected
an object, causing the first receipt's totals to become `NaN` / `#NUM!`.
Running the frontend locally still uses the configured remote gateway and its
deployed Apps Script; editing backend files locally does not activate this fix.

## Deployment

The GitHub Actions workflow deploys the production `dist` directory to GitHub
Pages whenever the default branch is pushed. Enable **GitHub Actions** as the
Pages source in the repository settings before the first deployment.

Hash-based routing and Vite's relative asset base allow routes and assets to
work when the application is hosted under a repository subpath.
