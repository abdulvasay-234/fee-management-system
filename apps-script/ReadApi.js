function normalizeComparableDateTime_(value) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const usDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (isoDate || usDate) {
    const year = Number(isoDate ? isoDate[1] : usDate[3]);
    const month = Number(isoDate ? isoDate[2] : usDate[1]);
    const day = Number(isoDate ? isoDate[3] : usDate[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") + "T00:00:00";
  }

  let date = null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    date = new Date(text);
  } else if (!Number.isNaN(Date.parse(text))) {
    date = new Date(text);
  }

  if (!date || Number.isNaN(date.getTime())) return "";

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function normalizeComparableDateOnly_(value) {
  const normalized = normalizeComparableDateTime_(value);
  return normalized ? normalized.substring(0, 10) : "";
}

function comparePaymentChronology_(left, right) {
  const leftDate = normalizeComparableDateTime_(left.paymentDate);
  const rightDate = normalizeComparableDateTime_(right.paymentDate);

  if (leftDate !== rightDate) {
    return leftDate < rightDate ? -1 : 1;
  }

  return String(left.receiptId || "").localeCompare(String(right.receiptId || ""));
}

function getRegularCourses_() {
  return getCourseCodes_().filter(function(course) {
    return normalizeText_(course.type) === "regular";
  });
}

function getStudents_(filters) {
  requireFinancialIndexReady_();
  return enrichStudentsWithPayments_(readIndexedStudents_(filters), readIndexedPayments_({}));
}

function readStudentsForCourses_(courses, filters) {
  const students = [];
  const seen = Object.create(null);
  courses.forEach(function(course) {
    if (!matchesCourseFilter_(course.courseName, filters.course)) return;
    readSheetRecords_(findAdmissionSheetForCourse_(course.courseName).sheet, CONFIG.ADMISSION_HEADERS, mapAdmissionRow_)
      .forEach(function(student) {
        if (!student.studentId) throw new Error("Admission source contains a missing Student ID.");
        if (seen[student.studentId]) throw new Error('Duplicate Student ID in source data: "' + student.studentId + '".');
        seen[student.studentId] = true;
        if (matchesStudentFilters_(student, filters)) students.push(student);
      });
  });
  return students.sort(function(left, right) { return right.admissionDate.localeCompare(left.admissionDate); });
}

function enrichStudentsWithPayments_(students, payments) {
  const latestPayments = Object.create(null);
  const paymentsByStudent = Object.create(null);

  payments.forEach(function(payment) {
    if (!paymentsByStudent[payment.studentId]) paymentsByStudent[payment.studentId] = [];
    paymentsByStudent[payment.studentId].push(payment);
    const current = latestPayments[payment.studentId];
    const currentDate = current ? normalizeComparableDateTime_(current.paymentDate) : "";
    const paymentDate = normalizeComparableDateTime_(payment.paymentDate);

    if (!current || paymentDate > currentDate ||
      (paymentDate === currentDate && String(payment.receiptId || "") > String(current.receiptId || ""))) {
      latestPayments[payment.studentId] = payment;
    }
  });

  return students.map(function(student) {
    const payment = latestPayments[student.studentId];
    const studentPayments = paymentsByStudent[student.studentId] || [];
    const financials = calculateStudentFinancials_(student, studentPayments);
    student.totalPaid = financials.totalPaid;
    student.balance = financials.balance;
    student.paymentStatus = financials.paymentStatus;
    student.latestPaymentDate = payment ? normalizeComparableDateOnly_(payment.paymentDate) : "";
    student.latestReceiptId = payment ? payment.receiptId : "";
    student.paymentCount = studentPayments.length;
    return student;
  });
}

function getStudentDetails_(parameters) {
  requireFinancialIndexReady_();
  const studentId = String(parameters.studentId || "").trim();
  if (!studentId) throw new Error("Student ID is required.");
  const student = readIndexedStudents_({ studentId: studentId })[0];
  if (!student) throw new Error('Student ID "' + studentId + '" was not found.');
  try {
    const courseCode = studentId.substring(2, 4);
    const courseInfo = getCourseCodes_().find(function(course) { return normalizeCourseCode_(course.code) === courseCode; });
    if (courseInfo) {
      const sourceSheet = findAdmissionSheetForCourse_(courseInfo.courseName).sheet;
      const sourceRecord = findAdmissionByStudentId_(sourceSheet, studentId);
      if (sourceRecord) {
        const info = getAdmissionHeaderInfo_(sourceSheet);
        const row = sourceSheet.getRange(sourceRecord.row, 1, 1, info.headers.length).getDisplayValues()[0];
        const columns = {};
        Object.keys(info.columns).forEach(function(header) { columns[header] = info.columns[header] - 1; });
        const admission = mapAdmissionRow_(row, columns);
        student.collegeName = admission.collegeName;
        student.degreeCourse = admission.degreeCourse;
        student.yearOfPassing = admission.yearOfPassing;
        student.otherProgramDetails = admission.otherProgramDetails;
      }
    }
  } catch (error) {
    Logger.log("Admission source detail lookup failed for " + studentId + ": " + error.message);
  }
  const payments = readIndexedPayments_({ studentId: studentId });
  enrichStudentsWithPayments_([student], payments);
  const latestPayment = payments.slice().sort(function(left, right) {
    return comparePaymentChronology_(right, left);
  })[0] || null;
  return {
    student: student,
    payments: payments,
    totalPaid: student.totalPaid,
    balance: student.balance,
    latestPayment: latestPayment
  };
}

function getPayments_(filters) {
  requireFinancialIndexReady_();
  return readIndexedPayments_(filters);
}

function getEnquiries_() {
  return readIndexedEnquiries_();
}

function getWalkIns_(filters) {
  return readIndexedVisitors_(filters).sort(function(left, right) {
    const dateOrder = normalizeComparableDateOnly_(right.visitDate).localeCompare(normalizeComparableDateOnly_(left.visitDate));
    return dateOrder || String(right.visitorId).localeCompare(String(left.visitorId));
  });
}

function getFollowUps_(filters) {
  return readIndexedFollowUps_(filters).sort(function(left, right) {
    if (filters.visitorId) {
      return left.followUpNumber - right.followUpNumber || normalizeComparableDateOnly_(left.scheduledDate).localeCompare(normalizeComparableDateOnly_(right.scheduledDate));
    }
    return normalizeComparableDateOnly_(right.scheduledDate).localeCompare(normalizeComparableDateOnly_(left.scheduledDate)) || String(right.followUpId).localeCompare(String(left.followUpId));
  });
}

function readVisitorSourceRecords_() {
  return readSheetRecords_(getVisitorsSourceSheet_(), CONFIG.VISITOR_HEADERS, mapVisitorRow_);
}

function readEnquirySourceRecords_() {
  return readSheetRecords_(getEnquiriesSourceSheet_(), CONFIG.ENQUIRY_HEADERS, mapEnquiryRow_);
}

function readFollowUpSourceRecords_() {
  return readSheetRecords_(getFollowUpsSourceSheet_(), CONFIG.FOLLOW_UP_HEADERS, mapFollowUpRow_);
}

function readPaymentsForCourses_(courses, filters) {
  const payments = [];
  const seen = Object.create(null);
  courses.forEach(function(course) {
    if (!matchesCourseFilter_(course.courseName, filters.course)) return;
    readSheetRecords_(findPaymentSheetForCourse_(course.courseName).sheet, CONFIG.PAYMENT_HEADERS, mapPaymentRow_)
      .forEach(function(payment) {
        if (!payment.receiptId) throw new Error("Payment source contains a missing Receipt ID.");
        if (seen[payment.receiptId]) throw new Error('Duplicate Receipt ID in source data: "' + payment.receiptId + '".');
        seen[payment.receiptId] = true;
        if (matchesPaymentFilters_(payment, filters)) payments.push(payment);
      });
  });
  return payments.sort(function(left, right) {
    return comparePaymentChronology_(right, left);
  });
}

function getDashboardData_() {
  requireFinancialIndexReady_();
  const payments = readIndexedPayments_({}).sort(function(left, right) {
    return comparePaymentChronology_(right, left);
  });
  const students = enrichStudentsWithPayments_(readIndexedStudents_({}), payments);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const todayPayments = payments.filter(function(payment) {
    return normalizeComparableDateOnly_(payment.paymentDate) === today;
  });
  const monthPayments = payments.filter(function(payment) {
    const paymentDate = normalizeComparableDateOnly_(payment.paymentDate);
    return paymentDate && paymentDate.substring(0, 7) === today.substring(0, 7);
  });
  const totalCollected = sumBy_(payments, "amountPaid");
  return {
    totalStudents: students.length,
    totalCollected: roundMoney_(totalCollected),
    outstandingFees: students.reduce(function(total, student) {
      return total + Math.max(moneyToPaise_(student.balance), 0);
    }, 0) / 100,
    todaysCollection: roundMoney_(sumBy_(todayPayments, "amountPaid")),
    admissionsOverview: {
      today: students.filter(function(student) { return normalizeComparableDateOnly_(student.admissionDate) === today; }).length,
      thisMonth: students.filter(function(student) { return normalizeComparableDateOnly_(student.admissionDate).substring(0, 7) === today.substring(0, 7); }).length,
      total: students.length
    },
    collectionOverview: { today: roundMoney_(sumBy_(todayPayments, "amountPaid")), thisMonth: roundMoney_(sumBy_(monthPayments, "amountPaid")), total: roundMoney_(totalCollected) },
    studentsByCourse: groupCountBy_(students, "course"),
    collectionByCourse: groupSumBy_(payments, "course", "amountPaid"),
    recentAdmissions: students.slice(0, 5),
    recentPayments: payments.slice(0, 5),
    paymentModes: groupCountBy_(payments, "paymentMode")
  };
}

function readSheetRecords_(sheet, expectedHeaders, mapper) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getDisplayValues();
  const headers = values[0].map(function(header) { return String(header).trim(); });
  const columns = {};
  headers.forEach(function(header, index) { columns[header] = index; });
  expectedHeaders.forEach(function(header) {
    if (columns[header] === undefined) throw new Error('Sheet is missing required column "' + header + '".');
  });
  return values.slice(1)
    .filter(function(row) { return row.some(function(value) { return value !== ""; }); })
    .map(function(row) { return mapper(row, columns); });
}

function mapAdmissionRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  const totalCourseFee = normalizeOptionalMoney_(value("Total Course Fee")) || 0;
  const discount = normalizeOptionalMoney_(value("Discount")) || 0;
  const finalFee = normalizeOptionalMoney_(value("Final Fee"));
  if (finalFee === null) throw new Error('Student "' + value("Student ID") + '" has no final fee.');
  return {
    studentId: value("Student ID"), fullName: value("Full Name"), fatherName: value("Father's Name"), motherName: value("Mother's Name"),
    dateOfBirth: value("Date of Birth"), gender: value("Gender"), mobileNumber: value("Mobile Number"), email: value("Email"),
    address: value("Address"), city: value("City"), state: value("State"), pincode: value("Pincode"), course: value("Course"),
    batch: value("Batch"), startTime: value("Start Time"), endTime: value("End Time"), enrollmentMonth: value("Enrollment Month"),
    enrollmentYear: value("Enrollment Year"), admissionDate: value("Admission Date"), courseDuration: value("Course Duration"),
    totalCourseFee: totalCourseFee, discount: discount, finalFee: finalFee,
    remarks: value("Remarks"), createdAt: value("Created At"), yearOfPassing: value("Year of Passing"),
    collegeName: value("College Name"), degreeCourse: value("Degree / Course"),
    otherProgramDetails: value("Other Program Details")
  };
}

function mapPaymentRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  const amountPaid = normalizeOptionalMoney_(value("Amount Paid"));
  if (amountPaid === null) throw new Error('Payment "' + value("Receipt ID") + '" has no amount.');
  const paymentDate = normalizeComparableDateOnly_(value("Payment Date"));
  if (!paymentDate) throw new Error('Payment "' + value("Receipt ID") + '" has an invalid payment date.');
  let previousPaid = normalizeOptionalMoney_(value("Previous Paid"));
  const damagedTotal = value("Total Paid") === "#NUM!";
  const damagedBalance = value("Balance") === "#NUM!";
  const savedTotalPaid = damagedTotal ? null : normalizeOptionalMoney_(value("Total Paid"));
  if (damagedTotal || damagedBalance) moneyToPaise_(amountPaid);
  let totalPaid;
  if (damagedTotal) {
    if (previousPaid === null) {
      previousPaid = getPreviousPaidForReceipt_(
        findPaymentSheetForCourse_(value("Course")).sheet,
        value("Student ID"), value("Receipt ID"), amountPaid
      );
    }
    totalPaid = sumPaymentAmounts_([{ amountPaid: previousPaid }, { amountPaid: amountPaid }]);
  } else {
    totalPaid = savedTotalPaid || 0;
  }
  let balance;
  if (damagedBalance) {
    if (!damagedTotal && savedTotalPaid === null) {
      throw new Error('Cannot recalculate Balance for receipt "' + value("Receipt ID") + '": Total Paid is missing.');
    }
    const admission = findAdmissionByStudentId_(findAdmissionSheetForCourse_(value("Course")).sheet, value("Student ID"));
    if (!admission) throw new Error('Cannot recalculate Balance for receipt "' + value("Receipt ID") + '": no matching admission. Verify the original agreed fee and correct the balance.');
    balance = calculateStudentFinancials_(admission, [{ amountPaid: totalPaid }]).balance;
  } else {
    balance = normalizeOptionalMoney_(value("Balance")) || 0;
  }
  if (damagedTotal || damagedBalance) Logger.log('Recalculated #NUM! payment summary for receipt "' + value("Receipt ID") + '" from saved monetary records; source cells require financial summary repair.');
  return {
    receiptId: value("Receipt ID"), studentId: value("Student ID"), studentName: value("Student Name"), course: value("Course"),
    batch: value("Batch"), enrollmentMonth: value("Enrollment Month"), enrollmentYear: value("Enrollment Year"), paymentDate: paymentDate,
    feeType: value("Fee Type"), amountPaid: amountPaid, paymentMode: value("Payment Mode"),
    previousPaid: previousPaid || 0, totalPaid: totalPaid,
    balance: balance, createdBy: value("Created By"), createdAt: value("Created At"), remarks: value("Remarks")
  };
}

function mapVisitorRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  return {
    visitorId: value("Visitor ID"), fullName: value("Full Name"), mobileNumber: value("Mobile Number"), email: value("Email"),
    college: value("College"), degreeCourse: value("Degree / Course"), yearOfGraduation: value("Year of Graduation"),
    courseInterestedIn: value("Course Interested In"), otherCourse: value("Other Course"), referral: value("Referral"),
    otherReferral: value("Other Referral"), notes: value("Notes / Remarks"), consultedWith: value("Consulted With"),
    visitDate: value("Visit Date"), entryTime: value("Entry Time"), exitTime: value("Exit Time"), visitStatus: value("Visit Status"),
    followUpRequired: value("Follow-up Required"), conversionStatus: value("Conversion Status"), admissionId: value("Admission ID"),
    createdAt: value("Created At"), updatedAt: value("Updated At")
  };
}

function mapEnquiryRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  const educationLevel = value("Education Level") || value("Degree / Course");
  return {
    enquiryId: value("Enquiry ID"), fullName: value("Full Name"), mobileNumber: value("Mobile Number"),
    email: value("Email"), college: value("College"), educationLevel: educationLevel,
    specialization: value("Specialization"), yearOfGraduation: value("Year of Graduation"), courseInterestedIn: value("Course Interested In"),
    otherProgramDetails: value("Other Program Details"),
    referral: value("Referral"), notes: value("Notes / Remarks"), consultedBy: value("Consulted By"),
    enquiryDate: normalizeComparableDateOnly_(value("Enquiry Date")), status: value("Status"), admissionId: value("Admission ID"),
    createdAt: value("Created At"), updatedAt: value("Updated At")
  };
}

function mapFollowUpRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  return {
    followUpId: value("Follow-up ID"), visitorId: value("Visitor ID"), fullName: value("Full Name"), mobileNumber: value("Mobile Number"),
    courseInterestedIn: value("Course Interested In"), followUpNumber: Number(value("Follow-up Number")) || 0,
    scheduledDate: value("Scheduled Date"), completedDate: value("Completed Date"), followUpStatus: value("Follow-up Status"),
    contactMethod: value("Contact Method"), notes: value("Notes"), createdBy: value("Created By"),
    createdAt: value("Created At"), updatedAt: value("Updated At")
  };
}

function matchesStudentFilters_(student, filters) {
  const search = String(filters.search || "").trim();
  const matchesSearch = !search ||
    student.studentId.indexOf(search) !== -1 ||
    normalizeText_(student.fullName).indexOf(normalizeText_(search)) !== -1 ||
    student.mobileNumber.indexOf(search) !== -1;

  return matchesSearch &&
    (!filters.studentId || student.studentId === String(filters.studentId).trim()) &&
    (!filters.name || normalizeText_(student.fullName).indexOf(normalizeText_(filters.name)) !== -1) &&
    (!filters.mobile || student.mobileNumber.indexOf(String(filters.mobile).trim()) !== -1) &&
    (!filters.batch || student.batch === normalizeBatch_(filters.batch));
}

function matchesPaymentFilters_(payment, filters) {
  const normalizedDate = normalizeComparableDateOnly_(payment.paymentDate);
  const normalizedDateFrom = normalizeComparableDateOnly_(filters.dateFrom);
  const normalizedDateTo = normalizeComparableDateOnly_(filters.dateTo);

  return (!filters.studentId || payment.studentId === String(filters.studentId).trim()) &&
    (!filters.batch || payment.batch === normalizeBatch_(filters.batch)) &&
    (!filters.paymentMode || normalizeText_(payment.paymentMode) === normalizeText_(filters.paymentMode)) &&
    (!filters.feeType || normalizeText_(payment.feeType) === normalizeText_(filters.feeType)) &&
    (!normalizedDateFrom || normalizedDate >= normalizedDateFrom) &&
    (!normalizedDateTo || normalizedDate <= normalizedDateTo);
}

function matchesVisitorFilters_(visitor, filters) {
  const search = normalizeText_(filters.search);
  const visitDate = normalizeComparableDateOnly_(visitor.visitDate);
  const dateFrom = normalizeComparableDateOnly_(filters.dateFrom);
  const dateTo = normalizeComparableDateOnly_(filters.dateTo);
  const month = String(filters.month || "").trim();
  const matchesSearch = !search || [visitor.visitorId, visitor.fullName, visitor.mobileNumber].some(function(value) {
    return normalizeText_(value).indexOf(search) !== -1;
  });

  return matchesSearch &&
    (!filters.visitorId || visitor.visitorId === String(filters.visitorId).trim()) &&
    (!filters.mobile || visitor.mobileNumber.indexOf(String(filters.mobile).trim()) !== -1) &&
    (!filters.name || normalizeText_(visitor.fullName).indexOf(normalizeText_(filters.name)) !== -1) &&
    (!filters.date || visitDate === normalizeComparableDateOnly_(filters.date)) &&
    (!dateFrom || visitDate >= dateFrom) && (!dateTo || visitDate <= dateTo) &&
    (!month || visitDate.substring(0, 7) === month) &&
    (!filters.course || normalizeCourseName_(visitor.courseInterestedIn) === normalizeCourseName_(filters.course)) &&
    (!filters.referral || normalizeText_(visitor.referral) === normalizeText_(filters.referral)) &&
    (!filters.consultedWith || normalizeText_(visitor.consultedWith) === normalizeText_(filters.consultedWith)) &&
    (!filters.status || normalizeText_(visitor.visitStatus) === normalizeText_(filters.status)) &&
    (!filters.followUpRequired || normalizeText_(visitor.followUpRequired) === normalizeText_(filters.followUpRequired)) &&
    (!filters.conversionStatus || normalizeText_(visitor.conversionStatus) === normalizeText_(filters.conversionStatus));
}

function matchesFollowUpFilters_(followUp, filters) {
  const search = normalizeText_(filters.search);
  const scheduledDate = normalizeComparableDateOnly_(followUp.scheduledDate);
  const month = String(filters.month || "").trim();
  const matchesSearch = !search || [followUp.followUpId, followUp.visitorId, followUp.fullName, followUp.mobileNumber].some(function(value) {
    return normalizeText_(value).indexOf(search) !== -1;
  });

  return matchesSearch &&
    (!filters.visitorId || followUp.visitorId === String(filters.visitorId).trim()) &&
    (!filters.followUpId || followUp.followUpId === String(filters.followUpId).trim()) &&
    (!filters.status || normalizeText_(followUp.followUpStatus) === normalizeText_(filters.status)) &&
    (!filters.scheduledDate || scheduledDate === normalizeComparableDateOnly_(filters.scheduledDate)) &&
    (!month || scheduledDate.substring(0, 7) === month);
}

function matchesCourseFilter_(courseName, filter) {
  return !filter || normalizeCourseName_(courseName) === normalizeCourseName_(filter);
}

function sumBy_(records, field) {
  return sumPaymentAmounts_(records.map(function(record) { return { amountPaid: record[field] }; }));
}

function groupCountBy_(records, field) {
  const groups = {};
  records.forEach(function(record) { const label = record[field] || "Unknown"; groups[label] = (groups[label] || 0) + 1; });
  return Object.keys(groups).sort().map(function(label) { return { label: label, value: groups[label] }; });
}

function groupSumBy_(records, groupField, valueField) {
  const groups = {};
  records.forEach(function(record) {
    const label = record[groupField] || "Unknown";
    groups[label] = (groups[label] || 0) + moneyToPaise_(record[valueField]);
    if (!Number.isSafeInteger(groups[label])) throw new Error("Collection total exceeds the supported amount.");
  });
  return Object.keys(groups).sort().map(function(label) { return { label: label, value: groups[label] / 100 }; });
}