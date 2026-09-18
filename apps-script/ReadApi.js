function normalizeComparableDateTime_(value) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  let date = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    }
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
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
    return normalizeText_(course.type) === "regular" && normalizeActive_(course.active) === "Yes";
  });
}

function getStudents_(filters) {
  return readIndexedStudents_(filters);
}

function readStudentsForCourses_(courses, filters) {
  const students = [];
  const seen = {};
  courses.forEach(function(course) {
    if (!matchesCourseFilter_(course.courseName, filters.course)) return;
    try {
      readSheetRecords_(findAdmissionSheetForCourse_(course.courseName).sheet, CONFIG.ADMISSION_HEADERS, mapAdmissionRow_)
        .forEach(function(student) {
          if (student.studentId && !seen[student.studentId] && matchesStudentFilters_(student, filters)) {
            seen[student.studentId] = true;
            students.push(student);
          }
        });
    } catch (error) {
      // A missing course sheet contributes no admission records.
    }
  });
  return students.sort(function(left, right) { return right.admissionDate.localeCompare(left.admissionDate); });
}

function enrichStudentsWithPayments_(students, payments) {
  const latestPayments = {};
  const paymentCounts = {};

  payments.forEach(function(payment) {
    paymentCounts[payment.studentId] = (paymentCounts[payment.studentId] || 0) + 1;
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
    student.totalPaid = payment ? payment.totalPaid : 0;
    student.balance = payment ? payment.balance : student.finalFee;
    student.latestPaymentDate = payment ? normalizeComparableDateOnly_(payment.paymentDate) : "";
    student.latestReceiptId = payment ? payment.receiptId : "";
    student.paymentCount = paymentCounts[student.studentId] || 0;
    return student;
  });
}

function getStudentDetails_(parameters) {
  const studentId = String(parameters.studentId || "").trim();
  if (!studentId) throw new Error("Student ID is required.");
  const student = readIndexedStudents_({ studentId: studentId })[0];
  if (!student) throw new Error('Student ID "' + studentId + '" was not found.');
  const payments = readIndexedPayments_({ studentId: studentId });
  const latestPayment = payments.slice().sort(function(left, right) {
    return comparePaymentChronology_(right, left);
  })[0] || null;
  return {
    student: student,
    payments: payments,
    totalPaid: latestPayment ? latestPayment.totalPaid : 0,
    balance: latestPayment ? latestPayment.balance : student.finalFee,
    latestPayment: latestPayment
  };
}

function getPayments_(filters) {
  return readIndexedPayments_(filters);
}

function readPaymentsForCourses_(courses, filters) {
  const payments = [];
  const seen = {};
  courses.forEach(function(course) {
    if (!matchesCourseFilter_(course.courseName, filters.course)) return;
    try {
      readSheetRecords_(findPaymentSheetForCourse_(course.courseName).sheet, CONFIG.PAYMENT_HEADERS, mapPaymentRow_)
        .forEach(function(payment) {
          if (payment.receiptId && !seen[payment.receiptId] && matchesPaymentFilters_(payment, filters)) {
            seen[payment.receiptId] = true;
            payments.push(payment);
          }
        });
    } catch (error) {
      // A missing course sheet contributes no payment records.
    }
  });
  return payments.sort(function(left, right) {
    return comparePaymentChronology_(right, left);
  });
}

function getDashboardData_() {
  const students = readIndexedStudents_({});
  const payments = readIndexedPayments_({});
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const latestPayments = {};

  payments.forEach(function(payment) {
    const current = latestPayments[payment.studentId];
    const currentDate = current ? normalizeComparableDateTime_(current.paymentDate) : "";
    const paymentDate = normalizeComparableDateTime_(payment.paymentDate);

    if (!current || paymentDate > currentDate ||
      (paymentDate === currentDate && String(payment.receiptId || "") > String(current.receiptId || ""))) {
      latestPayments[payment.studentId] = payment;
    }
  });

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
    outstandingFees: roundMoney_(students.reduce(function(total, student) {
      const studentLatestPayment = latestPayments[student.studentId];
      return total + (studentLatestPayment ? studentLatestPayment.balance : student.finalFee);
    }, 0)),
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
  const values = sheet.getRange(1, 1, lastRow, expectedHeaders.length).getDisplayValues();
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
  return {
    studentId: value("Student ID"), fullName: value("Full Name"), fatherName: value("Father's Name"), motherName: value("Mother's Name"),
    dateOfBirth: value("Date of Birth"), gender: value("Gender"), mobileNumber: value("Mobile Number"), email: value("Email"),
    address: value("Address"), city: value("City"), state: value("State"), pincode: value("Pincode"), course: value("Course"),
    batch: value("Batch"), startTime: value("Start Time"), endTime: value("End Time"), enrollmentMonth: value("Enrollment Month"),
    enrollmentYear: value("Enrollment Year"), admissionDate: value("Admission Date"), courseDuration: value("Course Duration"),
    totalCourseFee: totalCourseFee, discount: discount, finalFee: normalizeOptionalMoney_(value("Final Fee")) || 0,
    remarks: value("Remarks"), createdAt: value("Created At")
  };
}

function mapPaymentRow_(row, columns) {
  const value = function(header) { return String(row[columns[header]] || "").trim(); };
  return {
    receiptId: value("Receipt ID"), studentId: value("Student ID"), studentName: value("Student Name"), course: value("Course"),
    batch: value("Batch"), enrollmentMonth: value("Enrollment Month"), enrollmentYear: value("Enrollment Year"), paymentDate: value("Payment Date"),
    feeType: value("Fee Type"), amountPaid: normalizeOptionalMoney_(value("Amount Paid")) || 0, paymentMode: value("Payment Mode"),
    previousPaid: normalizeOptionalMoney_(value("Previous Paid")) || 0, totalPaid: normalizeOptionalMoney_(value("Total Paid")) || 0,
    balance: normalizeOptionalMoney_(value("Balance")) || 0, createdBy: value("Created By"), createdAt: value("Created At"), remarks: value("Remarks")
  };
}

function matchesStudentFilters_(student, filters) {
  return (!filters.studentId || student.studentId === String(filters.studentId).trim()) &&
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

function matchesCourseFilter_(courseName, filter) {
  return !filter || normalizeCourseName_(courseName) === normalizeCourseName_(filter);
}

function sumBy_(records, field) {
  return records.reduce(function(total, record) { return total + Number(record[field] || 0); }, 0);
}

function groupCountBy_(records, field) {
  const groups = {};
  records.forEach(function(record) { const label = record[field] || "Unknown"; groups[label] = (groups[label] || 0) + 1; });
  return Object.keys(groups).sort().map(function(label) { return { label: label, value: groups[label] }; });
}

function groupSumBy_(records, groupField, valueField) {
  const groups = {};
  records.forEach(function(record) { const label = record[groupField] || "Unknown"; groups[label] = (groups[label] || 0) + Number(record[valueField] || 0); });
  return Object.keys(groups).sort().map(function(label) { return { label: label, value: roundMoney_(groups[label]) }; });
}