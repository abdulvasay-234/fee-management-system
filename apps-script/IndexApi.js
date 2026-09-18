function getStudentsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.STUDENTS_INDEX_SHEET_ID).getSheets()[0];
}

function getPaymentsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.PAYMENTS_INDEX_SHEET_ID).getSheets()[0];
}

function ensureIndexHeaders_(sheet, headers) {
  const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0].slice(0, headers.length) : [];
  if (existing.join("\u0001") !== headers.join("\u0001")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function readIndexRecords_(sheet, headers, mapper) {
  ensureIndexHeaders_(sheet, headers);
  return readSheetRecords_(sheet, headers, mapper);
}

function rebuildIndexes_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const courses = getRegularCourses_();
    const payments = readPaymentsForCourses_(courses, {});
    const students = enrichStudentsWithPayments_(readStudentsForCourses_(courses, {}), payments);
    const studentSheet = getStudentsIndexSheet_();
    const paymentSheet = getPaymentsIndexSheet_();
    ensureIndexHeaders_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS);
    ensureIndexHeaders_(paymentSheet, CONFIG.PAYMENT_HEADERS);
    replaceIndexRecords_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS, students, buildStudentIndexRow_);
    replaceIndexRecords_(paymentSheet, CONFIG.PAYMENT_HEADERS, payments, buildPaymentIndexRow_);
    return validateIndexes_(students, payments);
  } finally {
    lock.releaseLock();
  }
}

function replaceIndexRecords_(sheet, headers, records, rowBuilder) {
  const existingRows = Math.max(sheet.getLastRow() - 1, 0);
  if (existingRows) sheet.getRange(2, 1, existingRows, headers.length).clearContent();
  if (records.length) sheet.getRange(2, 1, records.length, headers.length).setValues(records.map(rowBuilder));
}

function synchronizeStudentIndex_(student) {
  const sheet = getStudentsIndexSheet_();
  ensureIndexHeaders_(sheet, CONFIG.STUDENTS_INDEX_HEADERS);
  upsertIndexRecord_(sheet, CONFIG.STUDENTS_INDEX_HEADERS, "Student ID", student.studentId, buildStudentIndexRow_(student));
}

function synchronizePaymentIndexes_(payment) {
  const paymentSheet = getPaymentsIndexSheet_();
  ensureIndexHeaders_(paymentSheet, CONFIG.PAYMENT_HEADERS);
  upsertIndexRecord_(paymentSheet, CONFIG.PAYMENT_HEADERS, "Receipt ID", payment.receiptId, buildPaymentIndexRow_(payment));
  const studentSheet = getStudentsIndexSheet_();
  ensureIndexHeaders_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS);
  const row = findIndexRow_(studentSheet, "Student ID", payment.studentId);
  if (!row) return;
  const headerMap = getIndexColumnMap_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS);
  studentSheet.getRange(row, headerMap["Total Paid"], 1, 5).setValues([[
    payment.totalPaid, payment.balance, formatDateValue_(payment.paymentDate), payment.receiptId,
    getPaymentCountForStudent_(paymentSheet, payment.studentId)
  ]]);
}

function upsertIndexRecord_(sheet, headers, keyHeader, keyValue, values) {
  const row = findIndexRow_(sheet, keyHeader, keyValue);
  if (row) sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  else sheet.getRange(Math.max(sheet.getLastRow() + 1, 2), 1, 1, headers.length).setValues([values]);
}

function findIndexRow_(sheet, header, key) {
  const map = getIndexColumnMap_(sheet, header === "Student ID" ? CONFIG.STUDENTS_INDEX_HEADERS : CONFIG.PAYMENT_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, map[header], lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0]).trim() === key) return index + 2;
  }
  return 0;
}

function getIndexColumnMap_(sheet, headers) {
  const values = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const map = {};
  values.forEach(function(value, index) { map[String(value).trim()] = index + 1; });
  headers.forEach(function(header) { if (!map[header]) throw new Error('Index is missing required column "' + header + '".'); });
  return map;
}

function getPaymentCountForStudent_(sheet, studentId) {
  const records = readIndexRecords_(sheet, CONFIG.PAYMENT_HEADERS, mapPaymentRow_);
  return records.filter(function(payment) { return payment.studentId === studentId; }).length;
}

function buildStudentIndexRow_(student) {
  return [student.studentId, student.fullName, student.fatherName || "", student.motherName || "", student.dateOfBirth || "", student.gender || "", student.mobileNumber || "", student.email || "", student.address || "", student.city || "", student.state || "", student.pincode || "", student.course, student.batch, student.startTime || "", student.endTime || "", student.enrollmentMonth, student.enrollmentYear, formatDateValue_(student.admissionDate), student.courseDuration || "", student.totalCourseFee, student.discount, student.finalFee, student.totalPaid || 0, student.balance === undefined ? student.finalFee : student.balance, student.latestPaymentDate || "", student.latestReceiptId || "", student.paymentCount || 0, student.remarks || "", student.createdAt || new Date()];
}

function buildPaymentIndexRow_(payment) {
  return [payment.receiptId, payment.studentId, payment.studentName, payment.course, payment.batch, payment.enrollmentMonth, payment.enrollmentYear, formatDateValue_(payment.paymentDate), payment.feeType, payment.amountPaid, payment.paymentMode, payment.previousPaid, payment.totalPaid, payment.balance, payment.createdBy || "", payment.createdAt || new Date(), payment.remarks || ""];
}

function formatDateValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const normalized = normalizeComparableDateOnly_(value);
  return normalized || String(value || "").trim();
}

function readIndexedStudents_(filters) {
  const students = readIndexRecords_(getStudentsIndexSheet_(), CONFIG.STUDENTS_INDEX_HEADERS, mapStudentIndexRow_);
  return students.filter(function(student) { return matchesStudentFilters_(student, filters); });
}

function readIndexedPayments_(filters) {
  const payments = readIndexRecords_(getPaymentsIndexSheet_(), CONFIG.PAYMENT_HEADERS, mapPaymentRow_);
  return payments.filter(function(payment) { return matchesPaymentFilters_(payment, filters); });
}

function mapStudentIndexRow_(row, columns) {
  const student = mapAdmissionRow_(row, columns);
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  student.totalPaid = normalizeOptionalMoney_(value("Total Paid")) || 0;
  student.balance = normalizeOptionalMoney_(value("Balance"));
  if (student.balance === null) student.balance = student.finalFee;
  student.latestPaymentDate = value("Latest Payment Date");
  student.latestReceiptId = value("Latest Receipt ID");
  student.paymentCount = Number(value("Payment Count")) || 0;
  return student;
}

function validateIndexes_(students, payments) {
  const studentIds = {};
  const receiptIds = {};
  students.forEach(function(student) { if (studentIds[student.studentId]) throw new Error("Duplicate Student ID in source data."); studentIds[student.studentId] = true; });
  payments.forEach(function(payment) { if (receiptIds[payment.receiptId]) throw new Error("Duplicate Receipt ID in source data."); receiptIds[payment.receiptId] = true; if (!studentIds[payment.studentId]) throw new Error('Payment without matching student: "' + payment.receiptId + '".'); });
  return { studentCount: students.length, paymentCount: payments.length, duplicateStudentIds: 0, duplicateReceiptIds: 0, paymentsWithoutStudents: 0 };
}