# LSA Admin API

This directory is a `clasp` workspace for the existing **LSA Admin API** Google Apps Script project. It is connected through `.clasp.json`; do not replace its `scriptId` or create a new Apps Script project.

## Architecture

The React/Vite client calls the deployed Google Apps Script Web App. `Code.js` exposes `doGet` and `doPost`, then uses Google Drive and Google Sheets as storage. `appsscript.json` defines the V8 runtime, Asia/Kolkata timezone, Stackdriver logging, and the existing anonymous Web App access configuration.

Current API actions include:

- GET: `health`, `test-drive`, `course-codes`
- POST: `add-course`, `update-course`, `delete-course`, `add-student`

## Backend Protection Rules

- Do not alter deployed Web App settings, deployment behavior, API routes, request/response shapes, or storage conventions unless the task explicitly requires it.
- Do not change the configured Drive folder names, course-code spreadsheet ID, course list, or protected course-code behavior without explicit approval.
- The system course codes `00` through `06` are protected and must not be made deletable.
- Do not refactor, format, or rewrite existing Apps Script source as part of synchronization work.

## Synchronization Workflow

Run commands from this directory:

```sh
clasp status
clasp pull
clasp push
```

Pull before editing when remote changes may exist. Review `clasp status` before pushing. A `clasp push` updates project source but does not create a deployment; never use deployment commands unless explicitly requested.

Keep `.clasp.json` under version control because it identifies the existing project. Never commit clasp authentication files such as `.clasprc.json`.