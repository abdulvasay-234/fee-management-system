const FEE_REMINDER_SHEET_NAME_ = "Fee Reminders";
const FEE_REMINDER_HEADERS_ = ["Reminder ID", "Record Type", "Record ID", "Snapshot"];

function feeReminderSheet_(create) {
  const book = SpreadsheetApp.openById(CONFIG.STUDENTS_INDEX_SHEET_ID);
  let sheet = book.getSheetByName(FEE_REMINDER_SHEET_NAME_);
  if (!sheet && create) {
    sheet = book.insertSheet(FEE_REMINDER_SHEET_NAME_);
    sheet.getRange(1, 1, 1, FEE_REMINDER_HEADERS_.length).setValues([FEE_REMINDER_HEADERS_]);
  }
  if (sheet) {
    const headers = sheet.getRange(1, 1, 1, FEE_REMINDER_HEADERS_.length).getDisplayValues()[0];
    if (headers.join("|") !== FEE_REMINDER_HEADERS_.join("|")) throw new Error("Fee reminder history has unexpected headers. Reconcile it before continuing.");
  }
  return sheet;
}

function feeReminderRecords_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues().map(function(row) {
    let data;
    try { data = JSON.parse(row[3]); } catch {
      throw new Error("Fee reminder history contains unreadable records. Reconcile it before continuing.");
    }
    if (!row[0] || !row[2] || !data || typeof data !== "object" || Array.isArray(data) ||
        ["queue", "recipient", "event"].indexOf(row[1]) < 0) throw new Error("Fee reminder history contains incomplete records.");
    return { id: row[0], type: row[1], recordId: row[2], data: data };
  });
}

function feeReminderPending_(recipient) {
  return ["ready", "opened", "failed"].indexOf(recipient.status) >= 0;
}

function applyFeeReminderEvent_(queue, event) {
  const announcement = queue.announcement;
  if (event.revision !== queue.revision) throw new Error("Fee reminder history has inconsistent revisions.");
  const pending = queue.recipients.filter(feeReminderPending_);
  if (!pending.length) throw new Error("This fee reminder queue is complete.");
  if (["pause", "resume", "stop", "next"].indexOf(event.change) >= 0) {
    if (event.change === "next") {
      const selected = event.recipientId ? pending.find(function(item) { return item.id === event.recipientId; }) :
        pending[(pending.findIndex(function(item) { return item.id === announcement.currentRecipientId; }) + 1) % pending.length];
      if (!selected) throw new Error("This recipient cannot be reopened. Create a new reminder to send again.");
      announcement.currentRecipientId = selected.id;
    } else {
      announcement.status = event.change === "resume" ? "active" : event.change === "stop" ? "stopped" : "paused";
    }
  } else {
    if (["opened", "sent", "skipped", "failed"].indexOf(event.change) < 0) throw new Error("Invalid fee reminder action.");
    if (announcement.status !== "active") throw new Error("Start or resume the fee reminder queue first.");
    const recipient = pending.find(function(item) { return item.id === event.recipientId; });
    if (!recipient || recipient.id !== announcement.currentRecipientId) throw new Error("Choose an unfinished recipient before updating their progress.");
    if (event.change === "sent" && recipient.status !== "opened") throw new Error("Open WhatsApp first, then manually confirm that the message was sent.");
    recipient.status = event.change;
    recipient.updatedAt = event.time;
    recipient.updatedBy = event.actor;
    if (event.change === "sent" || event.change === "skipped") {
      const remaining = queue.recipients.filter(feeReminderPending_);
      const currentIndex = queue.recipients.indexOf(recipient);
      const next = remaining.find(function(item) { return queue.recipients.indexOf(item) > currentIndex; }) || remaining[0];
      announcement.currentRecipientId = next ? next.id : null;
      if (!remaining.length) announcement.status = "completed";
    }
  }
  queue.revision++;
}

function feeReminderQueue_(records, id) {
  const own = records.filter(function(record) { return record.id === id; });
  const metadata = own.filter(function(record) { return record.type === "queue"; });
  if (metadata.length !== 1) throw new Error("Fee reminder queue is missing or duplicated.");
  const source = metadata[0].data;
  const recipients = own.filter(function(record) { return record.type === "recipient"; })
    .map(function(record) { return Object.assign({}, record.data); })
    .sort(function(left, right) { return left.position - right.position; });
  if (recipients.length !== source.recipientCount ||
      new Set(recipients.map(function(item) { return item.studentId; })).size !== recipients.length) {
    throw new Error("Fee reminder recipients are incomplete or duplicated. Retry the original creation request.");
  }
  const queue = { announcement: Object.assign({}, source.announcement), recipients: recipients, revision: 0 };
  const eventIds = new Set();
  own.filter(function(record) { return record.type === "event"; }).forEach(function(record) {
    if (eventIds.has(record.recordId)) throw new Error("Fee reminder history contains duplicate updates.");
    eventIds.add(record.recordId);
    applyFeeReminderEvent_(queue, record.data);
  });
  return queue;
}

function getFeeReminders_() {
  const records = feeReminderRecords_(feeReminderSheet_(false));
  return Array.from(new Set(records.map(function(record) { return record.id; })))
    .map(function(id) { return feeReminderQueue_(records, id); }).reverse();
}

function feeReminderDueDate_(student) {
  if (!Number.isFinite(student.balance) || !Number.isFinite(student.totalPaid) || student.balance <= 0) {
    throw new Error("Student " + student.studentId + " has no pending fee balance. Refresh the student list.");
  }
  const latest = String(student.latestPaymentDate || "").trim();
  if (!latest && (student.totalPaid > 0 || student.paymentCount > 0)) throw new Error("The previous payment date is unavailable for " + student.studentId + ".");
  const value = latest || String(student.admissionDate || "");
  if (!/^(?:\d{4}-\d{2}-\d{2}(?:T.*)?|\d{1,2}\/\d{1,2}\/\d{4})$/.test(value)) throw new Error("The payment due date is unavailable for " + student.studentId + ".");
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const day = value.substring(0, 10);
    const checked = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(checked.getTime()) || checked.toISOString().slice(0, 10) !== day) throw new Error("Invalid admission/payment date.");
  }
  const normalized = normalizeComparableDateOnly_(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("The payment due date is unavailable for " + student.studentId + ".");
  const date = new Date(normalized + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) throw new Error("Invalid payment due date.");
  if (latest) date.setUTCDate(date.getUTCDate() + 20);
  if (date.getUTCFullYear() > 9999) throw new Error("Invalid next payment due date.");
  return date.toISOString().slice(0, 10);
}

function feeReminderPhone_(value) {
  const text = String(value || "").trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, "");
  if (digits.indexOf("00") === 0) digits = digits.substring(2);
  if (digits.length === 11 && digits[0] === "0") digits = digits.substring(1);
  if (digits.length === 10) digits = "91" + digits;
  if (!/^[1-9]\d{10,14}$/.test(digits) ||
      (digits.indexOf("91") === 0 && digits.length === 12 && !/^[6-9]\d{9}$/.test(digits.substring(2)))) return null;
  return digits;
}

function feeReminderMessage_(recipient) {
  const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(recipient.dueDate + "T00:00:00Z"));
  return "LSA FEE PAYMENT REMINDER\n\nDear " + recipient.name + ",\n\nAdmission Number: " + recipient.studentId +
    "\nCourse: " + recipient.course + "\nBatch: " + recipient.batch + "\nPending Balance: " + currency.format(recipient.balance) +
    "\nPayment Due Date: " + date +
    "\n\nPlease pay your pending course fees by the due date. If the date has passed, please contact the LSA office and arrange payment promptly." +
    "\nAfter each payment, the next payment is due 20 days later while a balance remains." +
    "\nIf you have already paid, please share your receipt with the LSA office for verification.\n\nLords Skill Academy";
}

function appendFeeReminderRecords_(sheet, rows) {
  if (rows.some(function(row) { return row[3].length > 49000; })) throw new Error("A fee reminder record exceeds the Google Sheets cell limit.");
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  SpreadsheetApp.flush();
}

function requireFeeReminderId_(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,100}$/.test(value)) throw new Error("Invalid fee reminder request ID.");
  return value;
}

function createFeeReminder_(payload, identity) {
  const id = requireFeeReminderId_(payload.id);
  if (!Array.isArray(payload.studentIds) || !payload.studentIds.length ||
      payload.studentIds.some(function(value) { return typeof value !== "string" || !/^\d{8}$/.test(value); }) ||
      new Set(payload.studentIds).size !== payload.studentIds.length) throw new Error("Select unique, valid admission IDs for the fee reminder.");
  const ids = payload.studentIds.slice().sort();
  const fingerprint = getIdempotencyContext_("create-fee-reminder", { idempotencyKey: "fee-reminder:" + id, studentIds: ids }).fingerprint;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = feeReminderSheet_(true);
    const records = feeReminderRecords_(sheet);
    const existing = records.find(function(record) { return record.id === id && record.type === "queue"; });
    if (existing) {
      if (existing.data.fingerprint !== fingerprint) throw new Error("Fee reminder ID was reused with different students.");
      return feeReminderQueue_(records, id);
    }
    if (records.some(function(record) { return record.id === id; })) throw new Error("Fee reminder creation is incomplete. Reconcile its records before creating another queue.");
    const students = getStudents_({});
    const byId = new Map();
    students.forEach(function(student) {
      if (byId.has(student.studentId)) throw new Error("Admissions contain duplicate IDs. Reconcile them before sending reminders.");
      byId.set(student.studentId, student);
    });
    const now = new Date().toISOString();
    const recipients = ids.map(function(studentId, position) {
      const student = byId.get(studentId);
      if (!student || !String(student.fullName || "").trim() || !String(student.course || "").trim()) throw new Error("A selected admission is missing. Refresh the student list.");
      const dueDate = feeReminderDueDate_(student);
      const phone = feeReminderPhone_(student.mobileNumber);
      const recipient = {
        id: id + ":" + studentId, announcementId: id, studentId: studentId,
        name: student.fullName, mobileNumber: student.mobileNumber, phone: phone,
        course: student.course, batch: student.batch, balance: student.balance, dueDate: dueDate,
        lastPaymentDate: student.latestPaymentDate || "", status: phone ? "ready" : "invalid",
        updatedAt: now, updatedBy: identity.email, position: position
      };
      recipient.message = feeReminderMessage_(recipient);
      return recipient;
    });
    const first = recipients.find(feeReminderPending_);
    if (!first) throw new Error("No selected students have valid mobile numbers. Correct their records before sending reminders.");
    const announcement = {
      id: id, title: "Fee reminders - " + Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"),
      template: "Fee reminder for {name}", createdAt: now, creator: identity.email,
      course: "", batch: "", query: "", status: "paused", currentRecipientId: first.id
    };
    const rows = [[id, "queue", id, JSON.stringify({ announcement: announcement, recipientCount: recipients.length, fingerprint: fingerprint })]];
    recipients.forEach(function(recipient) { rows.push([id, "recipient", recipient.id, JSON.stringify(recipient)]); });
    appendFeeReminderRecords_(sheet, rows);
    return feeReminderQueue_(feeReminderRecords_(sheet), id);
  } finally {
    lock.releaseLock();
  }
}

function updateFeeReminder_(payload, identity) {
  const id = requireFeeReminderId_(payload.id);
  const operationId = requireFeeReminderId_(payload.operationId);
  if (!Number.isInteger(payload.revision) || payload.revision < 0 || typeof payload.change !== "string" ||
      (payload.recipientId !== undefined && typeof payload.recipientId !== "string")) throw new Error("Invalid fee reminder update.");
  const signature = JSON.stringify([payload.revision, payload.change, payload.recipientId || ""]);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = feeReminderSheet_(false);
    if (!sheet) throw new Error("Fee reminder queue was not found.");
    const records = feeReminderRecords_(sheet);
    const queue = feeReminderQueue_(records, id);
    const recorded = records.find(function(record) { return record.id === id && record.type === "event" && record.recordId === operationId; });
    if (recorded) {
      if (recorded.data.signature !== signature) throw new Error("Fee reminder update ID was reused with different data.");
      return queue;
    }
    if (queue.revision !== payload.revision) throw new Error("Fee reminder progress changed by another administrator. Refresh history before continuing.");
    if (payload.change === "opened") {
      const recipient = queue.recipients.find(function(item) { return item.id === payload.recipientId; });
      const current = recipient && getStudents_({ studentId: recipient.studentId });
      if (!recipient || current.length !== 1) throw new Error("The reminder's admission is missing or duplicated.");
      const student = current[0];
      if (feeReminderDueDate_(student) !== recipient.dueDate || student.balance !== recipient.balance ||
          student.fullName !== recipient.name || student.course !== recipient.course || student.batch !== recipient.batch ||
          student.mobileNumber !== recipient.mobileNumber) throw new Error("Student fee details changed. Skip this saved reminder and create a new one from the refreshed student list.");
    }
    const event = {
      revision: payload.revision, change: payload.change, recipientId: payload.recipientId || "",
      time: new Date().toISOString(), actor: identity.email, signature: signature
    };
    applyFeeReminderEvent_(queue, event);
    appendFeeReminderRecords_(sheet, [[id, "event", operationId, JSON.stringify(event)]]);
    return feeReminderQueue_(feeReminderRecords_(sheet), id);
  } finally {
    lock.releaseLock();
  }
}
