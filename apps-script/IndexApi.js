function getStudentsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.STUDENTS_INDEX_SHEET_ID).getSheets()[0];
}

function getPaymentsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.PAYMENTS_INDEX_SHEET_ID).getSheets()[0];
}

function getVisitorsSourceSheet_() {
  return SpreadsheetApp.openById(CONFIG.VISITORS_SOURCE_SHEET_ID).getSheets()[0];
}

function getVisitorsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.VISITORS_INDEX_SHEET_ID).getSheets()[0];
}

function getFollowUpsSourceSheet_() {
  return SpreadsheetApp.openById(CONFIG.FOLLOW_UPS_SOURCE_SHEET_ID).getSheets()[0];
}

function getFollowUpsIndexSheet_() {
  return SpreadsheetApp.openById(CONFIG.FOLLOW_UPS_INDEX_SHEET_ID).getSheets()[0];
}

function getEnquiriesSheet_(propertyName) {
  const sheetId = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!sheetId) throw new Error("Enquiries sheets are not configured. Run setupEnquiries first.");
  return SpreadsheetApp.openById(sheetId).getSheets()[0];
}

function ensureEnquirySheetHeaders_(sheet) {
  let headers = sheet.getLastColumn()
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function(header) { return String(header).trim(); })
    : [];
  if (!headers.length) {
    sheet.getRange(1, 1, 1, CONFIG.ENQUIRY_HEADERS.length).setValues([CONFIG.ENQUIRY_HEADERS]);
    headers = CONFIG.ENQUIRY_HEADERS.slice();
  }

  const legacyEducationIndex = headers.indexOf("Degree / Course");
  if (legacyEducationIndex !== -1 && headers.indexOf("Education Level") === -1) {
    sheet.getRange(1, legacyEducationIndex + 1).setValue("Education Level");
    headers[legacyEducationIndex] = "Education Level";
  }

  const missingHeaders = CONFIG.ENQUIRY_HEADERS.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missingHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    Array.prototype.push.apply(headers, missingHeaders);
  }

  const columns = {};
  headers.forEach(function(header, index) { if (header) columns[header] = index + 1; });
  CONFIG.ENQUIRY_HEADERS.forEach(function(header) {
    if (!columns[header]) throw new Error('Enquiries sheet is missing required column "' + header + '".');
  });
  return { headers: headers, columns: columns };
}

function getEnquiriesSourceSheet_() {
  const sheet = getEnquiriesSheet_(CONFIG.ENQUIRIES_SOURCE_PROPERTY);
  ensureEnquirySheetHeaders_(sheet);
  return sheet;
}

function getEnquiriesIndexSheet_() {
  const sheet = getEnquiriesSheet_(CONFIG.ENQUIRIES_INDEX_PROPERTY);
  ensureEnquirySheetHeaders_(sheet);
  return sheet;
}

function getConfiguredEnquiriesFile_(id, name) {
  if (!id) return null;
  try {
    return DriveApp.getFileById(id);
  } catch {
    throw new Error("Configured " + name + " spreadsheet ID is invalid or inaccessible.");
  }
}

function inspectEnquiriesSpreadsheet_(file, folder, name) {
  if (file.isTrashed() || file.getName() !== name || file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
    throw new Error(name + " is not the expected Google spreadsheet.");
  }
  const parents = file.getParents();
  if (!parents.hasNext() || parents.next().getId() !== folder.getId() || parents.hasNext()) {
    throw new Error(name + " is not in the expected folder.");
  }
  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } catch {
    throw new Error(name + " spreadsheet is inaccessible.");
  }
  const sheets = spreadsheet.getSheets();
  if (sheets.length !== 1 || sheets[0].getName() !== name) throw new Error(name + " has an unexpected sheet layout.");
  const sheet = sheets[0];
  if (sheet.getLastColumn()) ensureEnquirySheetHeaders_(sheet);
  return sheet;
}

function findEnquiriesSpreadsheet_(folder, name) {
  const files = folder.getFilesByName(name);
  let match = null;
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    if (match) throw new Error("Multiple " + name + " spreadsheets exist in the expected folder.");
    match = file;
  }
  return match;
}

function createEnquiriesSpreadsheet_(folder, name) {
  const spreadsheet = SpreadsheetApp.create(name);
  DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(name);
  sheet.getRange(1, 1, 1, CONFIG.ENQUIRY_HEADERS.length).setValues([CONFIG.ENQUIRY_HEADERS]);
  return spreadsheet.getId();
}

function setupEnquiries() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const storedSourceId = properties.getProperty(CONFIG.ENQUIRIES_SOURCE_PROPERTY);
    const storedIndexId = properties.getProperty(CONFIG.ENQUIRIES_INDEX_PROPERTY);
    const administrative = DriveApp.getFolderById(CONFIG.ADMINISTRATIVE_FOLDER_ID);
    const appData = DriveApp.getFolderById(CONFIG.APP_DATA_FOLDER_ID);
    if (administrative.getName() !== "Administrative" || appData.getName() !== "App Data") {
      throw new Error("Enquiries parent folders do not match the expected layout.");
    }

    const storedSource = getConfiguredEnquiriesFile_(storedSourceId, "Enquiries source");
    const storedIndex = getConfiguredEnquiriesFile_(storedIndexId, "Enquiries Index");
    let sourceFolder = null;
    let sourceSheet = null;
    let indexSheet = null;
    if (storedSource) {
      const parents = storedSource.getParents();
      if (!parents.hasNext()) throw new Error("Configured Enquiries source is not in the Enquiries folder.");
      sourceFolder = parents.next();
      if (parents.hasNext() || sourceFolder.getName() !== "Enquiries") throw new Error("Configured Enquiries source is not in the Enquiries folder.");
      const folderParents = sourceFolder.getParents();
      if (!folderParents.hasNext() || folderParents.next().getId() !== administrative.getId() || folderParents.hasNext()) {
        throw new Error("Configured Enquiries source is not under Administrative.");
      }
      sourceSheet = inspectEnquiriesSpreadsheet_(storedSource, sourceFolder, "Enquiries");
    }
    if (storedIndex) indexSheet = inspectEnquiriesSpreadsheet_(storedIndex, appData, "Enquiries Index");

    if (!sourceFolder) {
      const folders = administrative.getFoldersByName("Enquiries");
      if (folders.hasNext()) {
        sourceFolder = folders.next();
        if (folders.hasNext()) throw new Error("Multiple Enquiries folders exist under Administrative.");
      }
    }
    const sourceFile = storedSource || (sourceFolder ? findEnquiriesSpreadsheet_(sourceFolder, "Enquiries") : null);
    const indexFile = storedIndex || findEnquiriesSpreadsheet_(appData, "Enquiries Index");
    if (sourceFile && !storedSource) sourceSheet = inspectEnquiriesSpreadsheet_(sourceFile, sourceFolder, "Enquiries");
    if (indexFile && !storedIndex) indexSheet = inspectEnquiriesSpreadsheet_(indexFile, appData, "Enquiries Index");

    if (!sourceFolder) sourceFolder = administrative.createFolder("Enquiries");
    const sourceId = sourceFile ? sourceFile.getId() : createEnquiriesSpreadsheet_(sourceFolder, "Enquiries");
    const indexId = indexFile ? indexFile.getId() : createEnquiriesSpreadsheet_(appData, "Enquiries Index");
    if (sourceSheet && !sourceSheet.getLastColumn()) {
      sourceSheet.getRange(1, 1, 1, CONFIG.ENQUIRY_HEADERS.length).setValues([CONFIG.ENQUIRY_HEADERS]);
    }
    if (indexSheet && !indexSheet.getLastColumn()) {
      indexSheet.getRange(1, 1, 1, CONFIG.ENQUIRY_HEADERS.length).setValues([CONFIG.ENQUIRY_HEADERS]);
    }
    properties.setProperty(CONFIG.ENQUIRIES_SOURCE_PROPERTY, sourceId);
    properties.setProperty(CONFIG.ENQUIRIES_INDEX_PROPERTY, indexId);
    return { sourceId: sourceId, indexId: indexId };
  } finally {
    lock.releaseLock();
  }
}

function ensureIndexHeaders_(sheet, headers) {
  if (headers === CONFIG.ENQUIRY_HEADERS) return ensureEnquirySheetHeaders_(sheet).columns;
  const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0].slice(0, headers.length) : [];
  if (existing.join("\u0001") !== headers.join("\u0001")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const columnMap = {};
  headers.forEach(function(header, index) { columnMap[header] = index + 1; });
  return columnMap;
}

function readIndexRecords_(sheet, headers, mapper) {
  ensureIndexHeaders_(sheet, headers);
  return readSheetRecords_(sheet, headers, mapper);
}

function alignEnquiryIndexRow_(sheet, headers, values) {
  const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function(header) { return String(header).trim(); });
  const valuesByHeader = {};
  headers.forEach(function(header, index) { valuesByHeader[header] = values[index]; });
  return actualHeaders.map(function(header) { return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : ""; });
}

function rebuildIndexes_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const sourceConfigured = Boolean(properties.getProperty(CONFIG.ENQUIRIES_SOURCE_PROPERTY));
    const indexConfigured = Boolean(properties.getProperty(CONFIG.ENQUIRIES_INDEX_PROPERTY));
    if (sourceConfigured !== indexConfigured) throw new Error("Enquiries sheet configuration is incomplete.");
    const courses = getRegularCourses_();
    const studentCourses = courses.slice();
    const otherPrograms = getCourseCodes_().find(function(course) {
      return normalizeCourseName_(course.courseName) === "other programs" && normalizeActive_(course.active) === "Yes";
    });
    if (otherPrograms) studentCourses.push(otherPrograms);
    const payments = readPaymentsForCourses_(courses, {});
    const students = enrichStudentsWithPayments_(readStudentsForCourses_(studentCourses, {}), payments);
    const visitors = readVisitorSourceRecords_();
    const followUps = readFollowUpSourceRecords_();
    const enquiries = sourceConfigured ? readEnquirySourceRecords_() : [];
    const studentSheet = getStudentsIndexSheet_();
    const paymentSheet = getPaymentsIndexSheet_();
    const visitorSheet = getVisitorsIndexSheet_();
    const followUpSheet = getFollowUpsIndexSheet_();
    const enquirySheet = indexConfigured ? getEnquiriesIndexSheet_() : null;
    const result = validateIndexes_(students, payments, visitors, followUps, enquiries);
    ensureIndexHeaders_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS);
    ensureIndexHeaders_(paymentSheet, CONFIG.PAYMENT_HEADERS);
    ensureIndexHeaders_(visitorSheet, CONFIG.VISITOR_HEADERS);
    ensureIndexHeaders_(followUpSheet, CONFIG.FOLLOW_UP_HEADERS);
    if (enquirySheet) ensureEnquirySheetHeaders_(enquirySheet);
    replaceIndexRecords_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS, students, buildStudentIndexRow_);
    replaceIndexRecords_(paymentSheet, CONFIG.PAYMENT_HEADERS, payments, buildPaymentIndexRow_);
    replaceIndexRecords_(visitorSheet, CONFIG.VISITOR_HEADERS, visitors, buildVisitorRow_);
    replaceIndexRecords_(followUpSheet, CONFIG.FOLLOW_UP_HEADERS, followUps, buildFollowUpRow_);
    if (enquirySheet) replaceIndexRecords_(enquirySheet, CONFIG.ENQUIRY_HEADERS, enquiries, buildEnquiryRow_);
    result.visitorCount = visitors.length;
    result.followUpCount = followUps.length;
    return result;
  } finally {
    lock.releaseLock();
  }
}

function replaceIndexRecords_(sheet, headers, records, rowBuilder) {
  if (headers === CONFIG.ENQUIRY_HEADERS) {
    ensureEnquirySheetHeaders_(sheet);
    const width = sheet.getLastColumn();
    const existingRows = Math.max(sheet.getLastRow() - 1, 0);
    if (existingRows) sheet.getRange(2, 1, existingRows, width).clearContent();
    if (records.length) {
      const rows = records.map(function(record) { return alignEnquiryIndexRow_(sheet, headers, rowBuilder(record)); });
      sheet.getRange(2, 1, rows.length, width).setValues(rows);
    }
    return;
  }
  const existingRows = Math.max(sheet.getLastRow() - 1, 0);
  if (existingRows) sheet.getRange(2, 1, existingRows, headers.length).clearContent();
  if (records.length) sheet.getRange(2, 1, records.length, headers.length).setValues(records.map(rowBuilder));
}

function synchronizeStudentIndex_(student) {
  const sheet = getStudentsIndexSheet_();
  const columnMap = ensureIndexHeaders_(sheet, CONFIG.STUDENTS_INDEX_HEADERS);
  upsertIndexRecord_(sheet, CONFIG.STUDENTS_INDEX_HEADERS, "Student ID", student.studentId, buildStudentIndexRow_(student), columnMap);
}

function synchronizePaymentIndexes_(payment) {
  const paymentSheet = getPaymentsIndexSheet_();
  const paymentColumnMap = ensureIndexHeaders_(paymentSheet, CONFIG.PAYMENT_HEADERS);
  upsertIndexRecord_(paymentSheet, CONFIG.PAYMENT_HEADERS, "Receipt ID", payment.receiptId, buildPaymentIndexRow_(payment), paymentColumnMap);
  const studentSheet = getStudentsIndexSheet_();
  const studentColumnMap = ensureIndexHeaders_(studentSheet, CONFIG.STUDENTS_INDEX_HEADERS);
  const row = findIndexRow_(studentSheet, "Student ID", payment.studentId, studentColumnMap);
  if (!row) return;
  const headerMap = studentColumnMap;
  studentSheet.getRange(row, headerMap["Total Paid"], 1, 5).setValues([[
    payment.totalPaid, payment.balance, formatDateValue_(payment.paymentDate), payment.receiptId,
    payment.paymentCount === undefined ? getPaymentCountForStudent_(paymentSheet, payment.studentId) : payment.paymentCount
  ]]);
}

function synchronizeVisitorIndex_(visitor) {
  const sheet = getVisitorsIndexSheet_();
  const columnMap = ensureIndexHeaders_(sheet, CONFIG.VISITOR_HEADERS);
  upsertIndexRecord_(sheet, CONFIG.VISITOR_HEADERS, "Visitor ID", visitor.visitorId, buildVisitorRow_(visitor), columnMap);
}

function synchronizeEnquiryIndex_(enquiry) {
  const sheet = getEnquiriesIndexSheet_();
  const columnMap = ensureEnquirySheetHeaders_(sheet).columns;
  upsertIndexRecord_(sheet, CONFIG.ENQUIRY_HEADERS, "Enquiry ID", enquiry.enquiryId, buildEnquiryRow_(enquiry), columnMap);
}

function synchronizeFollowUpIndex_(followUp) {
  const sheet = getFollowUpsIndexSheet_();
  const columnMap = ensureIndexHeaders_(sheet, CONFIG.FOLLOW_UP_HEADERS);
  upsertIndexRecord_(sheet, CONFIG.FOLLOW_UP_HEADERS, "Follow-up ID", followUp.followUpId, buildFollowUpRow_(followUp), columnMap);
}

function upsertIndexRecord_(sheet, headers, keyHeader, keyValue, values, columnMap) {
  const row = findIndexRow_(sheet, keyHeader, keyValue, columnMap);
  if (headers === CONFIG.ENQUIRY_HEADERS) {
    const aligned = alignEnquiryIndexRow_(sheet, headers, values);
    const width = sheet.getLastColumn();
    if (row) sheet.getRange(row, 1, 1, width).setValues([aligned]);
    else sheet.getRange(Math.max(sheet.getLastRow() + 1, 2), 1, 1, width).setValues([aligned]);
    return;
  }
  if (row) sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  else sheet.getRange(Math.max(sheet.getLastRow() + 1, 2), 1, 1, headers.length).setValues([values]);
}

function findIndexRow_(sheet, header, key, columnMap) {
  const headersByKey = {
    "Student ID": CONFIG.STUDENTS_INDEX_HEADERS,
    "Receipt ID": CONFIG.PAYMENT_HEADERS,
    "Visitor ID": CONFIG.VISITOR_HEADERS,
    "Enquiry ID": CONFIG.ENQUIRY_HEADERS,
    "Follow-up ID": CONFIG.FOLLOW_UP_HEADERS
  };
  const map = columnMap || getIndexColumnMap_(sheet, headersByKey[header]);
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
  return [student.studentId, student.fullName, student.fatherName || "", student.motherName || "", student.dateOfBirth || "", student.gender || "", student.mobileNumber || "", student.email || "", student.address || "", student.city || "", student.state || "", student.pincode || "", student.course, student.batch, student.startTime || "", student.endTime || "", student.enrollmentMonth, student.enrollmentYear, formatDateValue_(student.admissionDate), student.courseDuration || "", student.totalCourseFee, student.discount, student.finalFee, student.totalPaid || 0, student.balance === undefined ? student.finalFee : student.balance, student.latestPaymentDate || "", student.latestReceiptId || "", student.paymentCount || 0, student.remarks || "", student.createdAt || new Date(), safeSheetValue_(student.otherProgramDetails || "")];
}

function buildPaymentIndexRow_(payment) {
  return [payment.receiptId, payment.studentId, payment.studentName, payment.course, payment.batch, payment.enrollmentMonth, payment.enrollmentYear, formatDateValue_(payment.paymentDate), payment.feeType, payment.amountPaid, payment.paymentMode, payment.previousPaid, payment.totalPaid, payment.balance, payment.createdBy || "", payment.createdAt || new Date(), payment.remarks || ""];
}

function buildVisitorRow_(visitor) {
  return [visitor.visitorId, visitor.fullName, visitor.mobileNumber, visitor.email || "", visitor.college || "", visitor.degreeCourse || "", visitor.yearOfGraduation || "", visitor.courseInterestedIn, visitor.otherCourse || "", visitor.referral, visitor.otherReferral || "", visitor.notes || "", visitor.consultedWith, formatDateValue_(visitor.visitDate), visitor.entryTime, visitor.exitTime || "", visitor.visitStatus, visitor.followUpRequired, visitor.conversionStatus, visitor.admissionId || "", visitor.createdAt, visitor.updatedAt].map(safeSheetValue_);
}

function buildEnquiryRow_(enquiry) {
  return [enquiry.enquiryId, enquiry.fullName, enquiry.mobileNumber, enquiry.email || "", enquiry.college || "", enquiry.educationLevel || "", enquiry.specialization || "", enquiry.yearOfGraduation || "", enquiry.courseInterestedIn, enquiry.otherProgramDetails || "", enquiry.referral || "", enquiry.notes || "", enquiry.consultedBy || "", enquiry.enquiryDate, enquiry.status, enquiry.admissionId || "", enquiry.createdAt, enquiry.updatedAt].map(safeSheetValue_);
}

function buildFollowUpRow_(followUp) {
  return [followUp.followUpId, followUp.visitorId, followUp.fullName, followUp.mobileNumber, followUp.courseInterestedIn, followUp.followUpNumber, formatDateValue_(followUp.scheduledDate), followUp.completedDate || "", followUp.followUpStatus, followUp.contactMethod || "", followUp.notes || "", followUp.createdBy || "", followUp.createdAt, followUp.updatedAt].map(safeSheetValue_);
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

function readIndexedVisitors_(filters) {
  const visitors = readIndexRecords_(getVisitorsIndexSheet_(), CONFIG.VISITOR_HEADERS, mapVisitorRow_);
  return visitors.filter(function(visitor) { return matchesVisitorFilters_(visitor, filters); });
}

function readIndexedEnquiries_() {
  return readIndexRecords_(getEnquiriesIndexSheet_(), CONFIG.ENQUIRY_HEADERS, mapEnquiryRow_);
}

function readIndexedFollowUps_(filters) {
  const followUps = readIndexRecords_(getFollowUpsIndexSheet_(), CONFIG.FOLLOW_UP_HEADERS, mapFollowUpRow_);
  return followUps.filter(function(followUp) { return matchesFollowUpFilters_(followUp, filters); });
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

function validateIndexes_(students, payments, visitors, followUps, enquiries) {
  const studentIds = {};
  const receiptIds = {};
  const visitorIds = {};
  const followUpIds = {};
  const enquiryIds = {};
  students.forEach(function(student) { if (studentIds[student.studentId]) throw new Error("Duplicate Student ID in source data."); studentIds[student.studentId] = true; });
  payments.forEach(function(payment) { if (receiptIds[payment.receiptId]) throw new Error("Duplicate Receipt ID in source data."); receiptIds[payment.receiptId] = true; if (!studentIds[payment.studentId]) throw new Error('Payment without matching student: "' + payment.receiptId + '".'); });
  (visitors || []).forEach(function(visitor) { if (visitorIds[visitor.visitorId]) throw new Error("Duplicate Visitor ID in source data."); visitorIds[visitor.visitorId] = true; });
  (followUps || []).forEach(function(followUp) {
    if (followUpIds[followUp.followUpId]) throw new Error("Duplicate Follow-up ID in source data.");
    followUpIds[followUp.followUpId] = true;
    if (!visitorIds[followUp.visitorId]) throw new Error('Follow-up without matching visitor: "' + followUp.followUpId + '".');
  });
  (enquiries || []).forEach(function(enquiry) { if (!enquiry.enquiryId || enquiryIds[enquiry.enquiryId]) throw new Error("Missing or duplicate Enquiry ID in source data."); enquiryIds[enquiry.enquiryId] = true; });
  return { studentCount: students.length, paymentCount: payments.length, enquiryCount: (enquiries || []).length, duplicateStudentIds: 0, duplicateReceiptIds: 0, paymentsWithoutStudents: 0, duplicateVisitorIds: 0, duplicateFollowUpIds: 0, followUpsWithoutVisitors: 0, duplicateEnquiryIds: 0 };
}