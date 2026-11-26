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

## Financial records

The admission stores the agreed course fee and discount; the final fee is the
student's fee obligation. Student balances and dashboard outstanding amounts are
derived from indexed payment transaction amounts, not the running totals
printed on historical receipts. A negative student balance represents an
overpayment; it does not offset another student's outstanding balance.

The Payments overview separates payments received from total final fees.
Course breakdowns show final fee obligations for all admissions and positive
outstanding admission balances, including courses with no recorded payments.

The Admissions directory and its course breakdown count unique admission IDs
rather than unique people, including historical admissions.
Admission date totals use the browser's local calendar date. Course filters
include active catalog courses and courses found in historical admissions;
batch navigation is derived from the selected course's admission records.
Enrollment and batch activity statuses are not currently tracked.

After a payment is recorded, staff can open a prefilled WhatsApp acknowledgement
for the student's mobile number. It suggests a next payment date 20 days later
only when a balance remains; sending the message requires confirmation in
WhatsApp.

Payment requests require an idempotency key. On the first payment after the
backend is deployed, each payment source sheet is extended with `Idempotency
Key` and `Idempotency Fingerprint` columns without changing existing rows. These
columns allow a retry to recover a payment written before an interrupted
response. Older transactions do not have these keys. Do not retry an
unconfirmed payment until its source record and payment history have been
checked.

The payment and student indexes are separate from the source sheets. A source
write can succeed even if index synchronization fails. The application reports
a warning and blocks financial reads and further payments until that payment's
index synchronization is retried successfully or the indexes are rebuilt.
Index rebuilds stop on missing sheets, duplicate identifiers, and
unlinked payments, except legacy standalone Other Programs receipts, which
remain unlinked collections and are counted in the rebuild result. Back up
and review source data before rebuilding; no historical data is automatically
corrected.

## Deployment

The GitHub Actions workflow deploys the production `dist` directory to GitHub
Pages whenever the default branch is pushed. Enable **GitHub Actions** as the
Pages source in the repository settings before the first deployment.

Hash-based routing and Vite's relative asset base allow routes and assets to
work when the application is hosted under a repository subpath.
