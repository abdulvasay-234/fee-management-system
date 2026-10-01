/**
 * LSA Fee Management API
 * Backend: Google Apps Script
 *
 * V1 architecture:
 * React/Vite frontend
 *        ↓
 * Google Apps Script Web App
 *        ↓
 * Google Drive / Google Sheets
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  FEES_ROOT_FOLDER_ID:
    "11Knbp8NxYwf_4hxzDyEXbNkpFgaZOTeE",

  ADMISSIONS_ROOT_FOLDER_ID:
    "1XZUV9VAksUz6i0Dc0B2pNVwWIwRT2iIN",

  COURSE_CODES_SHEET_ID:
    "1c6Euw_qMZ0wdYORDecKIZKSAsEcyamQTGYe0ZzSMqlE",

  STUDENTS_INDEX_SHEET_ID:
    "19AQaMhiaX04gBiDaDAQVF26MRsCPQSpJRD4dyaqBZM8",

  PAYMENTS_INDEX_SHEET_ID:
    "1GnYoyluxLMU5ESCIB_qYdp69Tp4rAdt_-ZsAMvbYaYw",

  VISITORS_SOURCE_SHEET_ID:
    "1uwYU2X0k9v24bT0C0adQGrdg3yIuUNJ4YVL5gAA4Om8",

  VISITORS_INDEX_SHEET_ID:
    "1k9k3vEu93qDLnXuh7NKYA1QLBtsWay-p8Shg88cZri4",

  FOLLOW_UPS_SOURCE_SHEET_ID:
    "1eatei4b5DmyHHTJLBetpBustlDGPAz_o28aNvkL0XSY",

  FOLLOW_UPS_INDEX_SHEET_ID:
    "1CVULH9rG73dvbAl4EQ89jNG-KaWkZ0e57sNdd4NXA5I",

  ADMINISTRATIVE_FOLDER_ID: "1JjFl-ZHv1rtd5iB1wHxqg0WQlKenOyHG",
  APP_DATA_FOLDER_ID: "1SvV5CIkn97kFzhCJlPe4jT_2rRoy5M58",
  ENQUIRIES_SOURCE_PROPERTY: "ENQUIRIES_SOURCE_SHEET_ID",
  ENQUIRIES_INDEX_PROPERTY: "ENQUIRIES_INDEX_SHEET_ID",

  ADMISSION_SHEET_IDS: {
    "python programming": "1rTp-0i6I-_K0QzLLwoZnOgsQ6qiBkeL9OKcO2EYin8U",
    "data science": "1JL202KADTPv5iGkYeiazeKtWDk_0hxlOiIuJgjBSuA0",
    "full stack java": "1gBqAdF3qyYf3s3p4iTL0zmic8AkT1KQmJsvpff6akN0",
    "devops": "1Ke6YqhBYHV2YJDOa5yn8sKRiXM3IIVHMC5nfZe0NEzw",
    "cyber security": "1z3aYiMFnz9vGZDKin6w6qmyvdPu8oCJ5V2VhiWBe0tM",
    "other programs": "1EYEjrVTcb76ECdQ3yciXGlez8MHPck5lRV1aLYeAIgo"
  },

  PAYMENT_SHEET_IDS: {
    "python programming": "1vC0f9kAnCh7HPBRyEqgNHvNcAyQCuhvoKKydmtr9wOQ",
    "data science": "1LURcTzTj4F6d9l5Xp1CW7k3oeKpumJ5aXcLu0OAQzc0",
    "full stack java": "17yGgz6Q3SP6J7VSVBioQShOatBMCReQAccClnT_WQfk",
    "devops": "1PcE98B-LxKPhg6R1caOSs1XNLWKhD3ATetvvViBLZYY",
    "cyber security": "1_N9UxAGQHtU2JjbQqzdjviYbt3wB_ES3N27a0H8Dwjc"
  },

  COURSE_CODES_FOLDER: "Course Code",

  ADMISSION_HEADERS: [
    "Student ID", "Full Name", "Father's Name", "Mother's Name",
    "Date of Birth", "Gender", "Mobile Number", "Email", "Address",
    "City", "State", "Pincode", "Course", "Batch", "Start Time",
    "End Time", "Enrollment Month", "Enrollment Year", "Admission Date",
    "Course Duration", "Total Course Fee", "Discount", "Final Fee",
    "Remarks", "Created At", "Year of Passing", "College Name",
    "Degree / Course"
  ],

  PAYMENT_HEADERS: [
    "Receipt ID", "Student ID", "Student Name", "Course", "Batch",
    "Enrollment Month", "Enrollment Year", "Payment Date", "Fee Type",
    "Amount Paid", "Payment Mode", "Previous Paid", "Total Paid",
    "Balance", "Created By", "Created At", "Remarks"
  ],

  STUDENTS_INDEX_HEADERS: [
    "Student ID", "Full Name", "Father's Name", "Mother's Name", "Date of Birth", "Gender", "Mobile Number", "Email", "Address", "City", "State", "Pincode", "Course", "Batch", "Start Time", "End Time", "Enrollment Month", "Enrollment Year", "Admission Date", "Course Duration", "Total Course Fee", "Discount", "Final Fee", "Total Paid", "Balance", "Latest Payment Date", "Latest Receipt ID", "Payment Count", "Remarks", "Created At", "Other Program Details"
  ],

  VISITOR_HEADERS: [
    "Visitor ID", "Full Name", "Mobile Number", "Email", "College",
    "Degree / Course", "Year of Graduation", "Course Interested In",
    "Other Course", "Referral", "Other Referral", "Notes / Remarks",
    "Consulted With", "Visit Date", "Entry Time", "Exit Time",
    "Visit Status", "Follow-up Required", "Conversion Status",
    "Admission ID", "Created At", "Updated At"
  ],

  FOLLOW_UP_HEADERS: [
    "Follow-up ID", "Visitor ID", "Full Name", "Mobile Number",
    "Course Interested In", "Follow-up Number", "Scheduled Date",
    "Completed Date", "Follow-up Status", "Contact Method", "Notes",
    "Created By", "Created At", "Updated At"
  ],

  ENQUIRY_HEADERS: [
    "Enquiry ID", "Full Name", "Mobile Number", "Email", "College",
    "Education Level", "Specialization", "Year of Graduation", "Course Interested In",
    "Other Program Details", "Referral", "Notes / Remarks", "Consulted By",
    "Enquiry Date", "Status", "Admission ID", "Created At", "Updated At"
  ],

  ENQUIRY_STATUSES: ["New", "Follow-up", "Converted", "Not Interested"],

  PAYMENT_MODES: ["Cash", "UPI", "Bank Transfer", "Card", "Other"],
  FEE_TYPES: ["Admission Fee", "Installment", "Full Payment", "Other"],
  FOLLOW_UP_STATUSES: ["Pending", "Completed", "Not Required"],
  OTHER_PROGRAM_TYPES: [
    "Workshop", "Bootcamp", "Masterclass", "Seminar", "Event",
    "Certification", "Other"
  ],

  // These are the official/system course codes.
  // They cannot be deleted.
  PROTECTED_COURSE_CODES: [
    "00",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06"
  ]
};

let CURRENT_GATEWAY_IDENTITY_ = null;


// ============================================================
// GET REQUEST
// ============================================================

function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || "").trim() : "";
  if (action === "health") return jsonResponse_({ success: true, status: "ok" });
  return jsonResponse_({ success: false, error: "Unauthorized" });
}


// ============================================================
// POST REQUEST
// ============================================================

function doPost(e) {
  CURRENT_GATEWAY_IDENTITY_ = null;
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Unauthorized");
    let body;
    try { body = JSON.parse(e.postData.contents); } catch { throw new Error("Unauthorized"); }
    const identity = requireGatewayRequest_(body);
    CURRENT_GATEWAY_IDENTITY_ = identity;
    const action = String(body.action || "").trim();
    const parameters = getGatewayParameters_(body);
    return jsonResponse_(dispatchGatewayAction_(action, parameters, identity));
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: error.message === "Unauthorized" ? "Unauthorized" : error.message
    });
  } finally {
    CURRENT_GATEWAY_IDENTITY_ = null;
  }
}

function getGatewaySecret_() {
  return String(PropertiesService.getScriptProperties().getProperty("GATEWAY_SECRET") || "");
}

function gatewaySecretsMatch_(supplied, expected) {
  const left = String(supplied || "");
  const right = String(expected || "");
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function requireGatewayRequest_(requestData) {
  const expectedSecret = getGatewaySecret_();
  if (!expectedSecret || !gatewaySecretsMatch_(requestData && requestData.gatewaySecret, expectedSecret)) throw new Error("Unauthorized");
  const gatewayIdentity = requestData && requestData.gatewayIdentity;
  const googleSub = gatewayIdentity ? String(gatewayIdentity.googleSub || "").trim() : "";
  const email = gatewayIdentity ? String(gatewayIdentity.email || "").trim().toLowerCase() : "";
  if (!googleSub || !email) throw new Error("Unauthorized");
  return { googleSub: googleSub, email: email, name: String(gatewayIdentity.name || "").trim() };
}

function getGatewayParameters_(body) {
  let source;
  if (Object.prototype.hasOwnProperty.call(body, "parameters")) {
    if (!body.parameters || typeof body.parameters !== "object" || Array.isArray(body.parameters)) throw new Error("Invalid request parameters.");
    source = body.parameters;
  } else {
    source = body;
  }
  const parameters = Object.create(null);
  const reserved = { action: true, parameters: true, gatewaySecret: true, gatewayIdentity: true };
  const prohibited = { __proto__: true, constructor: true, prototype: true };
  Object.keys(source).forEach(function(key) {
    if (prohibited[key]) throw new Error("Invalid request parameters.");
    if (!reserved[key]) parameters[key] = source[key];
  });
  return parameters;
}

const IDEMPOTENCY_PROPERTY_PREFIX_ = "LSA_IDEMPOTENCY_";
const IDEMPOTENCY_RETENTION_MS_ = 7 * 24 * 60 * 60 * 1000;

function getIdempotencyContext_(action, payload) {
  const key = String(payload.idempotencyKey || "").trim();
  if (!key) return null;
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) throw new Error("Invalid idempotency key.");
  const fingerprint = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload))
  );
  return { action: action, key: key, fingerprint: fingerprint };
}

function getIdempotencyResult_(context) {
  if (!context) return { found: false };
  const properties = PropertiesService.getScriptProperties();
  const raw = properties.getProperty(IDEMPOTENCY_PROPERTY_PREFIX_ + context.key);
  if (!raw) return { found: false };
  let record;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    properties.deleteProperty(IDEMPOTENCY_PROPERTY_PREFIX_ + context.key);
    return { found: false };
  }
  if (record.action !== context.action || record.fingerprint !== context.fingerprint) {
    throw new Error("Idempotency key was reused with different request data.");
  }
  return { found: true, response: record.response };
}

function rememberIdempotentResult_(context, response) {
  if (!context) return response;
  const properties = PropertiesService.getScriptProperties();
  const now = Date.now();
  const allProperties = properties.getProperties();
  Object.keys(allProperties).forEach(function(name) {
    if (name.indexOf(IDEMPOTENCY_PROPERTY_PREFIX_) !== 0) return;
    try {
      const record = JSON.parse(allProperties[name]);
      if (!record.createdAt || now - record.createdAt > IDEMPOTENCY_RETENTION_MS_) properties.deleteProperty(name);
    } catch (error) {
      properties.deleteProperty(name);
    }
  });
  properties.setProperty(IDEMPOTENCY_PROPERTY_PREFIX_ + context.key, JSON.stringify({
    action: context.action,
    fingerprint: context.fingerprint,
    createdAt: now,
    response: response
  }));
  return response;
}

function dispatchGatewayAction_(action, parameters, identity) {
  if (action === "course-codes") return { success: true, data: getCourseCodes_() };
  if (action === "students") return { success: true, data: getStudents_(parameters) };
  if (action === "student") return { success: true, data: getStudentDetails_(parameters) };
  if (action === "payments") return { success: true, data: getPayments_(parameters) };
  if (action === "dashboard") return { success: true, data: getDashboardData_() };
  if (action === "enquiries") return { success: true, data: getEnquiries_() };
  if (action === "walkins") return { success: true, data: getWalkIns_(parameters) };
  if (action === "followups") return { success: true, data: getFollowUps_(parameters) };
  if (action === "rebuild-indexes") {
    if (!Object.prototype.hasOwnProperty.call(parameters, "confirm") || parameters.confirm !== "REBUILD_INDEXES") throw new Error("Index rebuild requires explicit confirmation.");
    return { success: true, data: rebuildIndexes_() };
  }
  if (action === "add-course") return addCourseCode_(parameters);
  if (action === "update-course") return updateCourseCode_(parameters);
  if (action === "delete-course") return deleteCourseCode_(parameters);
  if (action === "add-student") return addStudent_(parameters);
  if (action === "add-payment") return addPayment_(parameters);
  if (action === "add-enquiry") return addEnquiry_(parameters);
  if (action === "update-enquiry") return updateEnquiry_(parameters);
  if (action === "convert-enquiry") return convertEnquiry_(parameters);
  if (action === "add-walkin") return addWalkIn_(parameters);
  if (action === "update-walkin") return updateWalkIn_(parameters);
  if (action === "mark-walkin-exit") return markWalkInExit_(parameters);
  if (action === "add-followup") {
    parameters.createdBy = identity.email;
    return addFollowUp_(parameters);
  }
  if (action === "update-followup") return updateFollowUp_(parameters);
  throw new Error("Unknown API action.");
}


// ============================================================
// TEST DRIVE / SHEET CONNECTION
// ============================================================

function testDriveConnection_() {

  const result = {

    success: true,

    feesRootFolder: null,

    admissionsRootFolder: null,

    courseFolders: [],

    admissionFolders: []

  };


  // ----------------------------------------------------------
  // Fees-management folder
  // ----------------------------------------------------------

  const feesFolder =
    DriveApp.getFolderById(
      CONFIG.FEES_ROOT_FOLDER_ID
    );


  if (!feesFolder) {

    throw new Error(
      "Fees-management folder was not found."
    );

  }


  result.feesRootFolder = {

    name: feesFolder.getName(),

    id: feesFolder.getId()

  };


  // ----------------------------------------------------------
  // Admissions folder
  // ----------------------------------------------------------

  const admissionsFolder =
    DriveApp.getFolderById(
      CONFIG.ADMISSIONS_ROOT_FOLDER_ID
    );


  if (!admissionsFolder) {

    throw new Error(
      "Admissions folder was not found."
    );

  }


  result.admissionsRootFolder = {

    name: admissionsFolder.getName(),

    id: admissionsFolder.getId()

  };


  // ----------------------------------------------------------
  // Course folders inside Fees-management
  // ----------------------------------------------------------

  getCourseCodes_().filter(
    function(course) {
      return normalizeActive_(course.active) === "Yes";
    }
  ).forEach(
    function(courseInfo) {

      const courseName = courseInfo.courseName;

      const folder =
        getSubFolderByName_(
          feesFolder,
          courseName
        );


      if (folder) {

        const spreadsheets =
          getGoogleSheetsInFolder_(
            folder
          );


        result.courseFolders.push({

          course: courseName,

          folderId:
            folder.getId(),

          spreadsheets:
            spreadsheets

        });

      } else {

        result.courseFolders.push({

          course: courseName,

          found: false

        });

      }

    }
  );


  // ----------------------------------------------------------
  // Admission folders
  // ----------------------------------------------------------

  getCourseCodes_().filter(
    function(course) {
      return normalizeActive_(course.active) === "Yes";
    }
  ).forEach(
    function(courseInfo) {

      const courseName = courseInfo.courseName;

      const folder =
        getSubFolderByName_(
          admissionsFolder,
          courseName
        );


      if (folder) {

        const spreadsheets =
          getGoogleSheetsInFolder_(
            folder
          );


        result.admissionFolders.push({

          course: courseName,

          folderId:
            folder.getId(),

          spreadsheets:
            spreadsheets

        });

      } else {

        result.admissionFolders.push({

          course: courseName,

          found: false

        });

      }

    }
  );


  return result;

}


// ============================================================
// DRIVE HELPERS
// ============================================================

function getFolderByName_(folderName) {

  const folders =
    DriveApp.getFoldersByName(
      folderName
    );


  if (folders.hasNext()) {

    return folders.next();

  }


  return null;

}


function getSubFolderByName_(
  parentFolder,
  folderName
) {

  const folders =
    parentFolder.getFoldersByName(
      folderName
    );


  if (folders.hasNext()) {

    return folders.next();

  }


  return null;

}


function getGoogleSheetsInFolder_(
  folder
) {

  const files =
    folder.getFilesByType(
      MimeType.GOOGLE_SHEETS
    );


  const results = [];


  while (files.hasNext()) {

    const file =
      files.next();


    results.push({

      name: file.getName(),

      id: file.getId(),

      url: file.getUrl()

    });

  }


  return results;

}


// ============================================================
// COURSE CODES API - READ
// ============================================================

/**
 * Reads ALL course codes from the Course Codes sheet.
 *
 * Expected columns:
 *
 * Code
 * Course Name
 * Type
 * Active
 *
 * IMPORTANT:
 * This returns both Active and Inactive courses.
 * The frontend can decide which ones to display in
 * admission dropdowns.
 */

function getCourseCodes_() {

  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.COURSE_CODES_SHEET_ID
    );


  const sheets =
    spreadsheet.getSheets();


  if (!sheets.length) {

    throw new Error(
      "Course Codes spreadsheet has no sheets."
    );

  }


  const sheet =
    sheets[0];


  const values =
    sheet
      .getDataRange()
      .getDisplayValues();


  if (
    !values ||
    values.length < 2
  ) {

    return [];

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const codeIndex =
    headers.indexOf("Code");


  const courseNameIndex =
    headers.indexOf("Course Name");


  const typeIndex =
    headers.indexOf("Type");


  const activeIndex =
    headers.indexOf("Active");


  if (
    codeIndex === -1 ||
    courseNameIndex === -1 ||
    typeIndex === -1 ||
    activeIndex === -1
  ) {

    throw new Error(
      "Course Codes sheet must contain: Code, Course Name, Type, Active"
    );

  }


  return values
    .slice(1)

    .filter(
      function(row) {

        return (
          row[codeIndex] ||
          row[courseNameIndex] ||
          row[typeIndex] ||
          row[activeIndex]
        );

      }
    )

    .map(
      function(row) {

        return {

          code:
            String(
              row[codeIndex]
            ).trim(),

          courseName:
            String(
              row[courseNameIndex]
            ).trim(),

          type:
            String(
              row[typeIndex]
            ).trim(),

          active:
            String(
              row[activeIndex]
            ).trim()

        };

      }
    );

}


// ============================================================
// COURSE CODES API - ADD
// ============================================================

function addCourseCode_(payload) {

  const lock =
    LockService.getScriptLock();


  lock.waitLock(10000);


  try {

    // --------------------------------------------------------
    // INPUT
    // --------------------------------------------------------

    const suppliedCode =
      normalizeCourseCode_(
        payload.code
      );


    const courseName =
      String(
        payload.courseName || ""
      ).trim();


    const type =
      String(
        payload.type || ""
      ).trim();


    const active =
      normalizeActive_(
        payload.active
      );


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!courseName) {

      throw new Error(
        "Course name is required."
      );

    }


    if (!type) {

      throw new Error(
        "Course type is required."
      );

    }

    if (normalizeText_(type) !== "regular") {

      throw new Error(
        "Only Regular courses can be added; code 00 is reserved for Other Programs."
      );

    }


    // --------------------------------------------------------
    // SHEET
    // --------------------------------------------------------

    const sheet =
      getCourseCodesSheet_();


    const headerInfo =
      getHeaderInfo_(
        sheet
      );


    const codeColumn =
      getRequiredColumn_(
        headerInfo,
        "Code"
      );


    const courseNameColumn =
      getRequiredColumn_(
        headerInfo,
        "Course Name"
      );


    const typeColumn =
      getRequiredColumn_(
        headerInfo,
        "Type"
      );


    const activeColumn =
      getRequiredColumn_(
        headerInfo,
        "Active"
      );

    const code =
      getNextRegularCourseCode_(
        sheet,
        headerInfo
      );

    if (
      suppliedCode &&
      suppliedCode !== code
    ) {

      throw new Error(
        "Regular course code must be the next sequential code: " +
        code +
        "."
      );

    }


    // --------------------------------------------------------
    // DUPLICATE CODE CHECK
    // --------------------------------------------------------

    const existingRow =
      findCourseRowByCode_(
        sheet,
        headerInfo,
        code
      );


    if (existingRow) {

      throw new Error(
        "Course code " +
        code +
        " already exists."
      );

    }


    // --------------------------------------------------------
    // NEXT ROW
    // --------------------------------------------------------

    const nextRow =
      Math.max(
        sheet.getLastRow() + 1,
        2
      );


    // --------------------------------------------------------
    // WRITE
    // --------------------------------------------------------

    sheet
      .getRange(
        nextRow,
        codeColumn
      )
      .setNumberFormat("@")
      .setValue(code);


    sheet
      .getRange(
        nextRow,
        courseNameColumn
      )
      .setValue(
        courseName
      );


    sheet
      .getRange(
        nextRow,
        typeColumn
      )
      .setValue(
        type
      );


    sheet
      .getRange(
        nextRow,
        activeColumn
      )
      .setValue(
        active
      );


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return {

      success: true,

      message:
        "Course code added successfully.",

      record: {

        code: code,

        courseName:
          courseName,

        type:
          type,

        active:
          active

      }

    };


  } finally {

    lock.releaseLock();

  }

}


// ============================================================
// COURSE CODES API - UPDATE
// ============================================================

function updateCourseCode_(payload) {

  const lock =
    LockService.getScriptLock();


  lock.waitLock(10000);


  try {

    // --------------------------------------------------------
    // INPUT
    // --------------------------------------------------------

    const code =
      normalizeCourseCode_(
        payload.code
      );


    const courseName =
      String(
        payload.courseName || ""
      ).trim();


    const type =
      String(
        payload.type || ""
      ).trim();


    const active =
      normalizeActive_(
        payload.active
      );


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!code) {

      throw new Error(
        "Course code is required."
      );

    }


    if (!/^\d{2}$/.test(code)) {

      throw new Error(
        "Course code must be exactly two digits."
      );

    }


    // 00 is reserved and cannot be edited.

    if (code === "00") {

      throw new Error(
        "Course code 00 cannot be edited."
      );

    }


    if (!courseName) {

      throw new Error(
        "Course name is required."
      );

    }


    if (!type) {

      throw new Error(
        "Course type is required."
      );

    }

    if (normalizeText_(type) !== "regular") {

      throw new Error(
        "Only Regular course codes can be updated."
      );

    }


    // --------------------------------------------------------
    // SHEET
    // --------------------------------------------------------

    const sheet =
      getCourseCodesSheet_();


    const headerInfo =
      getHeaderInfo_(
        sheet
      );


    const courseRow =
      findCourseRowByCode_(
        sheet,
        headerInfo,
        code
      );


    if (!courseRow) {

      throw new Error(
        "Course code " +
        code +
        " was not found."
      );

    }


    const courseNameColumn =
      getRequiredColumn_(
        headerInfo,
        "Course Name"
      );


    const typeColumn =
      getRequiredColumn_(
        headerInfo,
        "Type"
      );


    const activeColumn =
      getRequiredColumn_(
        headerInfo,
        "Active"
      );


    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------
    //
    // The CODE itself is immutable.
    //
    // We only update:
    // Course Name
    // Type
    // Active
    //
    // --------------------------------------------------------

    sheet
      .getRange(
        courseRow,
        courseNameColumn
      )
      .setValue(
        courseName
      );


    sheet
      .getRange(
        courseRow,
        typeColumn
      )
      .setValue(
        type
      );


    sheet
      .getRange(
        courseRow,
        activeColumn
      )
      .setValue(
        active
      );


    return {

      success: true,

      message:
        "Course code updated successfully.",

      record: {

        code: code,

        courseName:
          courseName,

        type:
          type,

        active:
          active

      }

    };


  } finally {

    lock.releaseLock();

  }

}


// ============================================================
// COURSE CODES API - DELETE
// ============================================================

function deleteCourseCode_(payload) {

  const lock =
    LockService.getScriptLock();


  lock.waitLock(10000);


  try {

    const code =
      normalizeCourseCode_(
        payload.code
      );


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!code) {

      throw new Error(
        "Course code is required."
      );

    }


    if (!/^\d{2}$/.test(code)) {

      throw new Error(
        "Course code must be exactly two digits."
      );

    }


    // --------------------------------------------------------
    // PROTECTED CODES
    // --------------------------------------------------------

    if (
      CONFIG
        .PROTECTED_COURSE_CODES
        .indexOf(code) !== -1
    ) {

      throw new Error(
        "Course code " +
        code +
        " is a protected system course and cannot be deleted."
      );

    }


    // --------------------------------------------------------
    // SHEET
    // --------------------------------------------------------

    const sheet =
      getCourseCodesSheet_();


    const headerInfo =
      getHeaderInfo_(
        sheet
      );


    const courseRow =
      findCourseRowByCode_(
        sheet,
        headerInfo,
        code
      );


    if (!courseRow) {

      throw new Error(
        "Course code " +
        code +
        " was not found."
      );

    }


    // --------------------------------------------------------
    // DELETE ROW
    // --------------------------------------------------------

    sheet.deleteRow(
      courseRow
    );


    return {

      success: true,

      message:
        "Course code " +
        code +
        " deleted successfully.",

      code: code

    };


  } finally {

    lock.releaseLock();

  }

}


// ============================================================
// COURSE CODES SHEET HELPER
// ============================================================

function getCourseCodesSheet_() {

  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.COURSE_CODES_SHEET_ID
    );


  const sheets =
    spreadsheet.getSheets();


  if (!sheets.length) {

    throw new Error(
      "Course Codes spreadsheet has no sheets."
    );

  }


  return sheets[0];

}


// ============================================================
// HEADER HELPERS
// ============================================================

function getHeaderInfo_(sheet) {

  const lastColumn =
    sheet.getLastColumn();


  if (lastColumn === 0) {

    throw new Error(
      "Course Codes sheet has no headers."
    );

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(
        function(header) {

          return String(
            header
          ).trim();

        }
      );


  const columns = {};


  headers.forEach(
    function(header, index) {

      if (header) {

        columns[header] =
          index + 1;

      }

    }
  );


  return {

    headers: headers,

    columns: columns

  };

}


// ============================================================
// REQUIRED COLUMN
// ============================================================

function getRequiredColumn_(
  headerInfo,
  headerName
) {

  const column =
    headerInfo
      .columns[headerName];


  if (!column) {

    throw new Error(
      'Required column "' +
      headerName +
      '" was not found in Course Codes sheet.'
    );

  }


  return column;

}


// ============================================================
// FIND COURSE ROW BY CODE
// ============================================================

function findCourseRowByCode_(
  sheet,
  headerInfo,
  code
) {

  const codeColumn =
    getRequiredColumn_(
      headerInfo,
      "Code"
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return null;

  }


  const values =
    sheet
      .getRange(
        2,
        codeColumn,
        lastRow - 1,
        1
      )
      .getDisplayValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const existingCode =
      normalizeCourseCode_(
        values[i][0]
      );


    if (
      existingCode === code
    ) {

      return i + 2;

    }

  }


  return null;

}


function getNextRegularCourseCode_(
  sheet,
  headerInfo
) {

  const codeColumn =
    getRequiredColumn_(
      headerInfo,
      "Code"
    );

  const typeColumn =
    getRequiredColumn_(
      headerInfo,
      "Type"
    );

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    return "01";

  }

  const values =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      Math.max(codeColumn, typeColumn)
    ).getDisplayValues();

  let highestCode = 0;

  values.forEach(
    function(row) {

      if (
        normalizeText_(row[typeColumn - 1]) !== "regular"
      ) {

        return;

      }

      const code =
        normalizeCourseCode_(
          row[codeColumn - 1]
        );

      if (/^\d{2}$/.test(code)) {

        highestCode = Math.max(
          highestCode,
          Number(code)
        );

      }

    }
  );

  if (highestCode >= 99) {

    throw new Error(
      "No regular course codes remain."
    );

  }

  return String(
    highestCode + 1
  ).padStart(2, "0");

}


// ============================================================
// NORMALIZE COURSE CODE
// ============================================================

function normalizeCourseCode_(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  let code =
    String(value).trim();


  // Convert 7 → 07

  if (
    /^\d$/.test(code)
  ) {

    code =
      "0" + code;

  }


  return code;

}


// ============================================================
// NORMALIZE ACTIVE
// ============================================================

function normalizeActive_(value) {

  const normalized =
    String(
      value === undefined ||
      value === null
        ? ""
        : value
    )
      .trim()
      .toLowerCase();


  if (
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "1"
  ) {

    return "Yes";

  }


  if (
    normalized === "no" ||
    normalized === "false" ||
    normalized === "0"
  ) {

    return "No";

  }


  // Default

  return "Yes";

}


// ============================================================
// PUBLIC TEST FUNCTIONS
// ============================================================

function testDriveConnection() {

  const result =
    testDriveConnection_();


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}


function testCourseCodes() {

  const courses =
    getCourseCodes_();


  Logger.log(
    JSON.stringify(
      courses,
      null,
      2
    )
  );


  return courses;

}


// ============================================================
// COURSE CODE WRITE TESTS
// ============================================================
//
// These are temporary test functions.
// You can delete them after testing.
// ============================================================


function testAddCourseCode() {

  Logger.log(
    "Non-destructive test only. Use getCourseCodes_ to inspect course codes."
  );

}


function testUpdateCourseCode() {

  Logger.log(
    "Non-destructive test only. No Course Codes changes were made."
  );

}


function testDeleteCourseCode() {

  Logger.log(
    "Non-destructive test only. No Course Codes changes were made."
  );

}


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse_(data) {

  return ContentService

    .createTextOutput(
      JSON.stringify(data)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}

// ============================================================
// ADMISSIONS API - ADD STUDENT
// ============================================================

/**
 * Creates a new student admission.
 *
 * Expected payload:
 *
 * {
 *   action: "add-student",
 *   fullName: "...",
 *   fathersName: "...",
 *   mothersName: "...",
 *   dateOfBirth: "YYYY-MM-DD",
 *   gender: "...",
 *   mobileNumber: "...",
 *   email: "...",
 *   address: "...",
 *   city: "...",
 *   state: "...",
 *   pincode: "...",
 *   course: "Python Programming",
 *   batch: "01",
 *   startTime: "10:00",
 *   endTime: "12:00",
 *   admissionDate: "YYYY-MM-DD",
 *   courseDuration: "...",
 *   totalCourseFee: 10000,
 *   discount: 1000,
 *   finalFee: 9000,
 *   remarks: "..."
 * }
 *
 * Student ID format:
 *
 * YYCCBBSS
 *
 * YY = admission year
 * CC = course code
 * BB = batch
 * SS = student sequence
 */

function addStudent_(payload, conversion) {

  const lock =
    conversion ? null : LockService.getScriptLock();

  if (lock) lock.waitLock(15000);

  try {
    const idempotency = getIdempotencyContext_("add-student", payload);
    const previousResult = getIdempotencyResult_(idempotency);
    if (previousResult.found) return previousResult.response;

    // ========================================================
    // READ INPUT
    // ========================================================

    const fullName =
      String(
        payload.fullName || ""
      ).trim();

    const fathersName =
      String(
        payload.fathersName || ""
      ).trim();

    const mothersName =
      String(
        payload.mothersName || ""
      ).trim();

    const dateOfBirth =
      String(
        payload.dateOfBirth || ""
      ).trim();

    const gender =
      String(
        payload.gender || ""
      ).trim();

    const mobileNumber =
      String(
        payload.mobileNumber || ""
      ).trim();

    const email =
      String(
        payload.email || ""
      ).trim();

    const address =
      String(
        payload.address || ""
      ).trim();

    const city =
      String(
        payload.city || ""
      ).trim();

    const state =
      String(
        payload.state || ""
      ).trim();

    const pincode =
      String(
        payload.pincode || ""
      ).trim();

    const course =
      String(
        payload.course || ""
      ).trim();

    const batch =
      normalizeBatch_(
        payload.batch
      );

    const startTime =
      String(
        payload.startTime || ""
      ).trim();

    const endTime =
      String(
        payload.endTime || ""
      ).trim();

    const admissionDate =
      String(
        payload.admissionDate || ""
      ).trim();

    const courseDuration =
      String(
        payload.courseDuration || ""
      ).trim();

    const totalCourseFee =
      normalizeOptionalMoney_(
        payload.totalCourseFee
      );

    const discount =
      normalizeOptionalMoney_(
        payload.discount
      ) || 0;

    const suppliedFinalFee =
      normalizeOptionalMoney_(
        payload.finalFee
      );

    const remarks =
      conversion ? String(payload.remarks ?? "") : String(payload.remarks || "").trim();

    const otherProgramDetails =
      String(payload.otherProgramDetails || "").trim();

    const yearOfPassing =
      String(
        payload.yearOfPassing || ""
      ).trim();

    const collegeName =
      String(
        payload.collegeName || ""
      ).trim();

    const degreeCourse =
      String(
        payload.degreeCourse || ""
      ).trim();


    // ========================================================
    // REQUIRED FIELD VALIDATION
    // ========================================================

    if (!fullName) {

      throw new Error(
        "Full Name is required."
      );

    }

    if (!mobileNumber) {

      throw new Error(
        "Mobile Number is required."
      );

    }

    if (!course) {

      throw new Error(
        "Course is required."
      );

    }

    if (!batch) {

      throw new Error(
        "Batch is required."
      );

    }

    if (!admissionDate) {

      throw new Error(
        "Admission Date is required."
      );

    }

    if (totalCourseFee === null) {

      throw new Error(
        "Total Course Fee is required."
      );

    }


    // ========================================================
    // BATCH VALIDATION
    // ========================================================

    if (!/^\d{2}$/.test(batch)) {

      throw new Error(
        "Batch must be a two-digit number."
      );

    }

    validateBatchTimes_(
      startTime,
      endTime
    );


    // ========================================================
    // DATE VALIDATION
    // ========================================================

    const admissionDateObject =
      parseDateOnly_(
        admissionDate
      );

    if (!admissionDateObject) {

      throw new Error(
        "Invalid Admission Date. Expected YYYY-MM-DD."
      );

    }


    let dobObject = "";

    if (dateOfBirth) {

      dobObject =
        parseDateOnly_(
          dateOfBirth
        );

      if (!dobObject) {

        throw new Error(
          "Invalid Date of Birth. Expected YYYY-MM-DD."
        );

      }

    }


    // ========================================================
    // FEE VALIDATION
    // ========================================================

    if (totalCourseFee < 0) {

      throw new Error(
        "Total Course Fee cannot be negative."
      );

    }

    if (discount < 0) {

      throw new Error(
        "Discount cannot be negative."
      );

    }

    if (discount > totalCourseFee) {

      throw new Error(
        "Discount cannot be greater than Total Course Fee."
      );

    }


    const calculatedFinalFee =
      totalCourseFee - discount;


    // If frontend sends finalFee, verify it.
    // Otherwise calculate it here.

    if (
      suppliedFinalFee !== null &&
      Math.abs(
        suppliedFinalFee -
        calculatedFinalFee
      ) > 0.01
    ) {

      throw new Error(
        "Final Fee does not match Total Course Fee minus Discount."
      );

    }


    // ========================================================
    // FIND COURSE CODE
    // ========================================================

    const courseInfo =
      findCourseCodeByName_(
        course
      );


    if (!courseInfo) {

      throw new Error(
        'Course "' +
        course +
        '" was not found in Course Codes.'
      );

    }


    const courseCode =
      normalizeCourseCode_(
        courseInfo.code
      );

    if (courseCode === "00" && !conversion) {

      throw new Error(
        "Other Programs are payment and receipt only; regular admissions are not supported."
      );

    }


    // ========================================================
    // COURSE MUST BE ACTIVE
    // ========================================================

    if (
      String(
        courseInfo.active
      ).toLowerCase() !== "yes"
    ) {

      throw new Error(
        'Course "' +
        course +
        '" is inactive and cannot receive new admissions.'
      );

    }

    if (courseCode === "00" && !otherProgramDetails) {
      throw new Error("Other Program Details are required for Other Programs.");
    }

    if (courseCode !== "00" && otherProgramDetails) {
      throw new Error("Other Program Details are only valid for Other Programs.");
    }


    // ========================================================
    // DETERMINE ADMISSION YEAR
    // ========================================================

    const admissionYear =
      admissionDateObject
        .getFullYear();


    const yearCode =
      String(
        admissionYear
      ).slice(-2);


    // ========================================================
    // FIND CORRECT ADMISSIONS SHEET
    // ========================================================

    const admissionSheetInfo =
      findAdmissionSheetForCourse_(
        course
      );


    if (!admissionSheetInfo) {

      throw new Error(
        'Admissions sheet for "' +
        course +
        '" was not found.'
      );

    }


    const sheet =
      admissionSheetInfo.sheet;


    // ========================================================
    // GENERATE NEXT STUDENT SEQUENCE
    // ========================================================

    const sequence =
      getNextStudentSequence_(
        sheet,
        courseCode,
        batch,
        yearCode
      );


    if (sequence > 99) {

      throw new Error(
        "Student sequence limit reached for this course, batch and year."
      );

    }


    const studentSequence =
      String(
        sequence
      ).padStart(
        2,
        "0"
      );


    // ========================================================
    // GENERATE STUDENT ID
    // ========================================================

    const studentId =
      yearCode +
      courseCode +
      batch +
      studentSequence;


    // ========================================================
    // ENROLLMENT MONTH / YEAR
    // ========================================================

    const enrollmentMonth =
      admissionDateObject.toLocaleString(
        "en-US",
        {
          month: "long"
        }
      );

    const enrollmentYear =
      String(
        admissionYear
      );


    // ========================================================
    // CREATED AT
    // ========================================================

    const createdAt =
      new Date();


    // ========================================================
    // GET SHEET HEADERS
    // ========================================================

    const headerInfo =
      getAdmissionHeaderInfo_(
        sheet,
        Boolean(conversion)
      );

    if (conversion) {
      ["Enquiry ID", "Conversion Fingerprint"].forEach(function(header) {
        if (headerInfo.columns[header]) return;
        const column = headerInfo.headers.length + 1;
        sheet.getRange(1, column).setValue(header);
        headerInfo.headers.push(header);
        headerInfo.columns[header] = column;
      });
    }


    // ========================================================
    // PREPARE ROW
    // ========================================================

    const rowValues =
      buildAdmissionRow_(
        headerInfo,
        {
          studentId:
            studentId,

          fullName:
            fullName,

          fathersName:
            fathersName,

          mothersName:
            mothersName,

          dateOfBirth:
            dobObject,

          gender:
            gender,

          mobileNumber:
            mobileNumber,

          email:
            email,

          address:
            address,

          city:
            city,

          state:
            state,

          pincode:
            pincode,

          course:
            course,

          batch:
            batch,

          startTime:
            startTime,

          endTime:
            endTime,

          enrollmentMonth:
            enrollmentMonth,

          enrollmentYear:
            enrollmentYear,

          admissionDate:
            admissionDateObject,

          courseDuration:
            courseDuration,

          totalCourseFee:
            totalCourseFee,

          discount:
            discount,

          finalFee:
            calculatedFinalFee,

          remarks:
            remarks,

          createdAt:
            createdAt,

          yearOfPassing:
            yearOfPassing,

          collegeName:
            collegeName,

          degreeCourse:
            degreeCourse,

          otherProgramDetails:
            otherProgramDetails,
          enquiryId:
            conversion ? payload.enquiryId : "",
          conversionFingerprint:
            conversion ? payload.conversionFingerprint : ""
        }
      );

    if (conversion) conversion.reserve(studentId, sheet);

    // ========================================================
    // WRITE STUDENT
    // ========================================================

    const nextRow =
      Math.max(
        sheet.getLastRow() + 1,
        2
      );


    sheet
      .getRange(
        nextRow,
        1,
        1,
        rowValues.length
      )
      .setValues([
        rowValues
      ]);

    if (conversion) conversion.recordAdmission(studentId, sheet);


    // ========================================================
    // FORCE STUDENT ID TO TEXT
    // ========================================================

    const studentIdColumn =
      headerInfo.columns[
        "Student ID"
      ];


    if (studentIdColumn) {

      sheet
        .getRange(
          nextRow,
          studentIdColumn
        )
        .setNumberFormat("@")
        .setValue(
          studentId
        );

    }

    let indexWarning = "";

    try {

      synchronizeStudentIndex_({
        studentId: studentId,
        fullName: fullName,
        fatherName: fathersName,
        motherName: mothersName,
        dateOfBirth: dateOfBirth,
        gender: gender,
        mobileNumber: mobileNumber,
        email: email,
        address: address,
        city: city,
        state: state,
        pincode: pincode,
        course: course,
        batch: batch,
        startTime: startTime,
        endTime: endTime,
        enrollmentMonth: enrollmentMonth,
        enrollmentYear: enrollmentYear,
        admissionDate: admissionDate,
        courseDuration: courseDuration,
        totalCourseFee: totalCourseFee,
        discount: discount,
        finalFee: calculatedFinalFee,
        totalPaid: 0,
        balance: calculatedFinalFee,
        paymentCount: 0,
        remarks: remarks,
        createdAt: createdAt
      });

    } catch (error) {

      indexWarning = "Students Index synchronization failed: " + error.message;

    }


    // ========================================================
    // RESPONSE
    // ========================================================

    const response = {

      success: true,

      message:
        "Student admission created successfully.",

      student: {

        studentId:
          studentId,

        fullName:
          fullName,

        course:
          course,

        courseCode:
          courseCode,

        batch:
          batch,

        admissionDate:
          admissionDate,

        enrollmentMonth:
          enrollmentMonth,

        enrollmentYear:
          enrollmentYear,

        courseDuration:
          courseDuration,

        totalCourseFee:
          totalCourseFee,

        discount:
          discount,

        finalFee:
          calculatedFinalFee

      },

      sheet: {

        name:
          sheet.getName(),

        id:
          sheet.getParent().getId(),

        row:
          nextRow

      }

    };

    if (indexWarning) response.indexWarning = indexWarning;

    return rememberIdempotentResult_(idempotency, response);


  } finally {

    if (lock) lock.releaseLock();

  }

}


// ============================================================
// FIND COURSE CODE BY COURSE NAME
// ============================================================

function findCourseCodeByName_(courseName) {

  const courses =
    getCourseCodes_();


  const normalizedName =
    normalizeCourseName_(
      courseName
    );


  for (
    let i = 0;
    i < courses.length;
    i++
  ) {

    const currentName =
      normalizeCourseName_(
        courses[i].courseName
      );


    if (
      currentName ===
      normalizedName
    ) {

      return courses[i];

    }

  }


  return null;

}


// ============================================================
// FIND ADMISSIONS SHEET
// ============================================================

function findAdmissionSheetForCourse_(
  courseName
) {

  return findCourseSheet_(
    CONFIG.ADMISSIONS_ROOT_FOLDER_ID,
    "Admissions",
    "Admission",
    courseName,
    CONFIG.ADMISSION_SHEET_IDS[
      normalizeCourseName_(courseName)
    ]
  );

}


function findPaymentSheetForCourse_(
  courseName
) {

  return findCourseSheet_(
    CONFIG.FEES_ROOT_FOLDER_ID,
    "Fees-management",
    "Payment",
    courseName,
    CONFIG.PAYMENT_SHEET_IDS[
      normalizeCourseName_(courseName)
    ]
  );

}


function findCourseSheet_(
  rootFolderId,
  rootFolderName,
  sheetLabel,
  courseName,
  knownSheetId
) {

  let rootFolder;

  try {

    rootFolder =
      DriveApp.getFolderById(
        rootFolderId
      );

  } catch (error) {

    throw new Error(
      rootFolderName +
      " folder was not found."
    );

  }

  if (knownSheetId) {

    try {

      const knownSpreadsheet =
        SpreadsheetApp.openById(
          knownSheetId
        );

      const knownSheets =
        knownSpreadsheet.getSheets();

      if (!knownSheets.length) {

        throw new Error("No sheets.");

      }

      return {
        folder: null,
        spreadsheet: knownSpreadsheet,
        sheet: knownSheets[0]
      };

    } catch (error) {

      throw new Error(
        sheetLabel +
        ' sheet not found for "' +
        courseName +
        '".'
      );

    }

  }

  const folder =
    findCourseFolder_(
      rootFolder,
      courseName
    );

  if (!folder) {

    throw new Error(
      rootFolderName +
      ' folder for "' +
      courseName +
      '" was not found.'
    );

  }

  const files =
    folder.getFilesByType(
      MimeType.GOOGLE_SHEETS
    );

  if (!files.hasNext()) {

    throw new Error(
      sheetLabel +
      ' sheet not found for "' +
      courseName +
      '".'
    );

  }

  const spreadsheet =
    SpreadsheetApp.openById(
      files.next().getId()
    );

  const sheets =
    spreadsheet.getSheets();

  if (!sheets.length) {

    throw new Error(
      sheetLabel +
      ' spreadsheet for "' +
      courseName +
      '" has no sheets.'
    );

  }

  return {
    folder: folder,
    spreadsheet: spreadsheet,
    sheet: sheets[0]
  };

}


// ============================================================
// GET NEXT STUDENT SEQUENCE
// ============================================================

function getNextStudentSequence_(
  sheet,
  courseCode,
  batch,
  yearCode
) {

  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return 1;

  }


  const headerInfo =
    getAdmissionHeaderInfo_(
      sheet
    );


  const studentIdColumn =
    headerInfo.columns[
      "Student ID"
    ];


  if (!studentIdColumn) {

    throw new Error(
      'Admissions sheet must contain "Student ID" column.'
    );

  }


  const values =
    sheet
      .getRange(
        2,
        studentIdColumn,
        lastRow - 1,
        1
      )
      .getDisplayValues();

  return getNextStudentSequenceFromValues_(
    values,
    courseCode,
    batch,
    yearCode
  );

}


function getNextStudentSequenceFromValues_(
  values,
  courseCode,
  batch,
  yearCode
) {


  const prefix =
    yearCode +
    courseCode +
    batch;


  let highestSequence =
    0;


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const studentId =
      String(
        values[i][0] || ""
      ).trim();


    if (
      studentId.indexOf(prefix) !== 0
    ) {

      continue;

    }


    if (
      studentId.length !== 8
    ) {

      continue;

    }


    const sequenceText =
      studentId.substring(
        6,
        8
      );


    if (
      !/^\d{2}$/.test(
        sequenceText
      )
    ) {

      continue;

    }


    const sequence =
      parseInt(
        sequenceText,
        10
      );


    if (
      sequence >
      highestSequence
    ) {

      highestSequence =
        sequence;

    }

  }


  return (
    highestSequence + 1
  );

}


// ============================================================
// ADMISSION HEADER INFO
// ============================================================

function getAdmissionHeaderInfo_(
  sheet,
  includeConversionFields
) {

  const lastColumn =
    sheet.getLastColumn();


  if (lastColumn === 0) {

    throw new Error(
      "Admissions sheet has no headers."
    );

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(
        function(header) {

          return String(
            header
          ).trim();

        }
      );

  const legacyEducationHeaderCount =
    CONFIG.ADMISSION_HEADERS.length - 3;

  if (
    headers.length >= legacyEducationHeaderCount &&
    headers.length < CONFIG.ADMISSION_HEADERS.length &&
    headers.every(function(header, index) {
      return header === CONFIG.ADMISSION_HEADERS[index];
    })
  ) {

    const missingHeaders = CONFIG.ADMISSION_HEADERS.slice(headers.length);

    sheet
      .getRange(
        1,
        headers.length + 1,
        1,
        missingHeaders.length
      )
      .setValues([
        missingHeaders
      ]);

    Array.prototype.push.apply(
      headers,
      missingHeaders
    );

  }

  if (includeConversionFields && headers.indexOf("Other Program Details") === -1) {
    sheet.getRange(1, headers.length + 1).setValue("Other Program Details");
    headers.push("Other Program Details");
  }


  const columns = {};


  headers.forEach(
    function(header, index) {

      if (header) {

        columns[header] =
          index + 1;

      }

    }
  );

  CONFIG.ADMISSION_HEADERS.forEach(
    function(header) {

      if (!columns[header]) {

        throw new Error(
          'Admissions sheet is missing required column "' +
          header +
          '".'
        );

      }

    }
  );

  if (columns.Status) {

    throw new Error(
      'Admissions sheet must not contain a "Status" column.'
    );

  }


  return {

    headers:
      headers,

    columns:
      columns

  };

}


// ============================================================
// BUILD ADMISSION ROW
// ============================================================

function buildAdmissionRow_(
  headerInfo,
  student
) {

  return headerInfo.headers.map(
    function(header) {

      switch (header) {

        case "Student ID":
          return student.studentId;

        case "Full Name":
          return student.fullName;

        case "Father's Name":
          return student.fathersName;

        case "Mother's Name":
          return student.mothersName;

        case "Date of Birth":
          return student.dateOfBirth;

        case "Gender":
          return student.gender;

        case "Mobile Number":
          return student.mobileNumber;

        case "Email":
          return student.email;

        case "Address":
          return student.address;

        case "City":
          return student.city;

        case "State":
          return student.state;

        case "Pincode":
          return student.pincode;

        case "Course":
          return student.course;

        case "Batch":
          return student.batch;

        case "Start Time":
          return student.startTime;

        case "End Time":
          return student.endTime;

        case "Enrollment Month":
          return student.enrollmentMonth;

        case "Enrollment Year":
          return student.enrollmentYear;

        case "Admission Date":
          return student.admissionDate;

        case "Course Duration":
          return student.courseDuration;

        case "Total Course Fee":
          return student.totalCourseFee;

        case "Discount":
          return student.discount;

        case "Final Fee":
          return student.finalFee;

        case "Remarks":
          return student.remarks;

        case "Created At":
          return student.createdAt;

        case "Year of Passing":
          return student.yearOfPassing;

        case "College Name":
          return student.collegeName;

        case "Degree / Course":
          return student.degreeCourse;

        case "Other Program Details":
          return safeSheetValue_(student.otherProgramDetails || "");

        case "Enquiry ID":
          return student.enquiryId;

        case "Conversion Fingerprint":
          return student.conversionFingerprint;

        default:
          return "";

      }

    }
  );

}


// ============================================================
// NORMALIZE BATCH
// ============================================================

function normalizeBatch_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  let batch =
    String(
      value
    ).trim();


  if (
    /^\d$/.test(batch)
  ) {

    batch =
      "0" +
      batch;

  }


  return batch;

}


// ============================================================
// NORMALIZE MONEY
// ============================================================

function normalizeOptionalMoney_(
  value
) {

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {

    return null;

  }


  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(/[₹$]/g, "")
      .trim();


  const number =
    Number(cleaned);


  if (
    !Number.isFinite(number)
  ) {

    throw new Error(
      "Invalid fee amount: " +
      value
    );

  }


  return number;

}


function validateBatchTimes_(
  startTime,
  endTime
) {

  const startMinutes =
    parseTimeToMinutes_(
      startTime
    );

  const endMinutes =
    parseTimeToMinutes_(
      endTime
    );

  if (startMinutes === null || endMinutes === null) {

    throw new Error(
      "Start Time and End Time are required in HH:MM format."
    );

  }

  if (endMinutes <= startMinutes) {

    throw new Error(
      "End time must be later than start time."
    );

  }

}


function parseTimeToMinutes_(
  value
) {

  const text = String(value || "").trim();

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {

    return null;

  }

  const parts = text.split(":");

  return Number(parts[0]) * 60 + Number(parts[1]);

}


// ============================================================
// PARSE DATE ONLY
// ============================================================

function parseDateOnly_(
  value
) {

  const text =
    String(
      value || ""
    ).trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {

    return null;

  }


  const parts =
    text.split("-");


  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {

    return null;

  }


  return date;

}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText_(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

}


function normalizeCourseName_(
  value
) {

  const normalized =
    normalizeText_(value);

  const aliases = {
    "python": "python programming",
    "ds": "data science",
    "other fees": "other programs"
  };

  return aliases[normalized] || normalized;

}


function findCourseFolder_(
  parentFolder,
  courseName
) {

  const expectedName =
    normalizeCourseName_(
      courseName
    );

  const folders =
    parentFolder.getFolders();

  while (folders.hasNext()) {

    const folder = folders.next();

    if (
      normalizeCourseName_(
        folder.getName()
      ) === expectedName
    ) {

      return folder;

    }

  }

  return null;

}


// ============================================================
// WALK-INS & FOLLOW-UPS API
// ============================================================

function getStructuredSheetInfo_(sheet, expectedHeaders, label) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error(label + " sheet has no headers.");
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(header) {
    return String(header).trim();
  });
  const columns = {};
  headers.forEach(function(header, index) { if (header) columns[header] = index + 1; });
  expectedHeaders.forEach(function(header) {
    if (!columns[header]) throw new Error(label + ' sheet is missing required column "' + header + '".');
  });
  return { headers: headers, columns: columns };
}

function safeSheetValue_(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function appendStructuredRecord_(sheet, headers, rowValues, textHeaders) {
  const info = getStructuredSheetInfo_(sheet, headers, "Source");
  const valuesByHeader = {};
  headers.forEach(function(header, index) { valuesByHeader[header] = rowValues[index]; });
  const alignedValues = info.headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : "";
  });
  const nextRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(nextRow, 1, 1, info.headers.length).setValues([alignedValues]);
  (textHeaders || []).forEach(function(header) {
    sheet.getRange(nextRow, info.columns[header]).setNumberFormat("@").setValue(valuesByHeader[header]);
  });
  return nextRow;
}

function findStructuredRecord_(sheet, headers, keyHeader, keyValue, mapper) {
  const info = getStructuredSheetInfo_(sheet, headers, "Source");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const zeroBasedColumns = {};
  Object.keys(info.columns).forEach(function(header) { zeroBasedColumns[header] = info.columns[header] - 1; });
  const keyValues = sheet.getRange(2, info.columns[keyHeader], lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < keyValues.length; index++) {
    if (String(keyValues[index][0] || "").trim() === keyValue) {
      const row = sheet.getRange(index + 2, 1, 1, info.headers.length).getDisplayValues()[0];
      return { row: index + 2, record: mapper(row, zeroBasedColumns), info: info };
    }
  }
  return null;
}

function updateStructuredRecord_(sheet, row, values, expectedHeaders) {
  if (!expectedHeaders) {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
    return;
  }
  const info = getStructuredSheetInfo_(sheet, expectedHeaders, "Source");
  const existing = sheet.getRange(row, 1, 1, info.headers.length).getValues()[0];
  const valuesByHeader = {};
  expectedHeaders.forEach(function(header, index) { valuesByHeader[header] = values[index]; });
  const alignedValues = info.headers.map(function(header, index) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : existing[index];
  });
  sheet.getRange(row, 1, 1, info.headers.length).setValues([alignedValues]);
}

function getNextAnnualId_(sheet, headers, idHeader, prefix, date) {
  const info = getStructuredSheetInfo_(sheet, headers, "Source");
  const year = Utilities.formatDate(date, Session.getScriptTimeZone(), "yy");
  const expectedPrefix = prefix + "-" + year + "-";
  const lastRow = sheet.getLastRow();
  let highest = 0;
  if (lastRow >= 2) {
    const values = sheet.getRange(2, info.columns[idHeader], lastRow - 1, 1).getDisplayValues();
    values.forEach(function(row) {
      const id = String(row[0] || "").trim();
      if (id.indexOf(expectedPrefix) !== 0) return;
      const sequence = Number(id.substring(expectedPrefix.length));
      if (Number.isInteger(sequence) && sequence > highest) highest = sequence;
    });
  }
  return expectedPrefix + String(highest + 1).padStart(4, "0");
}

function validateEmail_(email) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid Email address.");
}

function normalizeInterestedCourse_(value) {
  const course = String(value || "").trim();
  if (!course) throw new Error("Course Interested In is required.");
  if (normalizeText_(course) === "other") return "Other";
  const match = getCourseCodes_().find(function(item) {
    return normalizeCourseName_(item.courseName) === normalizeCourseName_(course) && normalizeActive_(item.active) === "Yes";
  });
  if (!match) throw new Error('Course Interested In "' + course + '" is not an active course.');
  return match.courseName;
}

function validateVisitorRecord_(visitor) {
  if (!visitor.fullName) throw new Error("Full Name is required.");
  if (!visitor.mobileNumber) throw new Error("Mobile Number is required.");
  validateEmail_(visitor.email);
  visitor.courseInterestedIn = normalizeInterestedCourse_(visitor.courseInterestedIn);
  if (normalizeText_(visitor.courseInterestedIn) === "other" && !visitor.otherCourse) throw new Error("Other Course is required when Course Interested In is Other.");
  if (normalizeText_(visitor.courseInterestedIn) !== "other") visitor.otherCourse = "";
  if (!visitor.referral) throw new Error("Referral is required.");
  if (normalizeText_(visitor.referral) === "other" && !visitor.otherReferral) throw new Error("Other Referral is required when Referral is Other.");
  if (normalizeText_(visitor.referral) !== "other") visitor.otherReferral = "";
  if (!visitor.consultedWith) throw new Error("Consulted With is required.");
  visitor.followUpRequired = requireAllowedOption_(visitor.followUpRequired, ["Yes", "No"], "Follow-up Required");
  visitor.conversionStatus = requireAllowedOption_(visitor.conversionStatus, ["Not Converted", "Converted"], "Conversion Status");
  return visitor;
}

function visitorFromPayload_(payload, existing) {
  const visitor = existing || {};
  const fields = {
    fullName: "fullName", mobileNumber: "mobileNumber", email: "email", college: "college",
    degreeCourse: "degreeCourse", yearOfGraduation: "yearOfGraduation", courseInterestedIn: "courseInterestedIn",
    otherCourse: "otherCourse", referral: "referral", otherReferral: "otherReferral", notes: "notes",
    consultedWith: "consultedWith", followUpRequired: "followUpRequired", conversionStatus: "conversionStatus"
  };
  Object.keys(fields).forEach(function(field) {
    if (!existing || Object.prototype.hasOwnProperty.call(payload, fields[field])) visitor[field] = String(payload[fields[field]] || "").trim();
  });
  if (!existing) visitor.conversionStatus = "Not Converted";
  return validateVisitorRecord_(visitor);
}

function enquiryFromPayload_(payload, existing) {
  const enquiry = existing ? Object.assign({}, existing) : {};
  const fields = ["fullName", "mobileNumber", "email", "college", "educationLevel", "specialization", "yearOfGraduation", "courseInterestedIn", "otherProgramDetails", "referral", "notes", "consultedBy", "enquiryDate"];
  fields.forEach(function(field) {
    if (!existing || Object.prototype.hasOwnProperty.call(payload, field)) enquiry[field] = String(payload[field] || "").trim();
  });
  if (Object.prototype.hasOwnProperty.call(payload, "degreeCourse") && !Object.prototype.hasOwnProperty.call(payload, "educationLevel")) {
    enquiry.educationLevel = String(payload.degreeCourse || "").trim();
  }
  if (!enquiry.fullName) throw new Error("Full Name is required.");
  if (!enquiry.mobileNumber) throw new Error("Mobile Number is required.");
  if (!enquiry.educationLevel) throw new Error("Education Level is required.");
  if (!enquiry.courseInterestedIn) throw new Error("Course Interested In is required.");
  enquiry.courseInterestedIn = normalizeInterestedCourse_(enquiry.courseInterestedIn);
  if (normalizeCourseName_(enquiry.courseInterestedIn) === "other programs" && !enquiry.otherProgramDetails) {
    throw new Error("Other Program Details are required for Other Programs.");
  }
  if (normalizeCourseName_(enquiry.courseInterestedIn) !== "other programs") enquiry.otherProgramDetails = "";
  if (!enquiry.enquiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(enquiry.enquiryDate) || !parseDateOnly_(enquiry.enquiryDate)) {
    throw new Error("Enquiry Date must be a valid YYYY-MM-DD date.");
  }
  validateEmail_(enquiry.email);
  enquiry.status = requireAllowedOption_(Object.prototype.hasOwnProperty.call(payload, "status") ? payload.status : (existing ? existing.status : "New"), CONFIG.ENQUIRY_STATUSES, "Status");
  if (String(payload.admissionId || "").trim()) throw new Error("Admission ID cannot be set before admission conversion.");
  return enquiry;
}

function getNextEnquiryId_(sheet) {
  const info = getStructuredSheetInfo_(sheet, CONFIG.ENQUIRY_HEADERS, "Enquiries source");
  const lastRow = sheet.getLastRow();
  let highest = 0;
  if (lastRow >= 2) {
    sheet.getRange(2, info.columns["Enquiry ID"], lastRow - 1, 1).getDisplayValues().forEach(function(row) {
      const match = /^ENQ-(\d+)$/.exec(String(row[0] || "").trim());
      if (match) highest = Math.max(highest, Number(match[1]));
    });
  }
  return "ENQ-" + String(highest + 1).padStart(6, "0");
}

function addEnquiry_(payload) {
  const enquiry = enquiryFromPayload_(payload, null);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const idempotency = getIdempotencyContext_("add-enquiry", payload);
    const previousResult = getIdempotencyResult_(idempotency);
    if (previousResult.found) return previousResult.response;
    const sheet = getEnquiriesSourceSheet_();
    const now = new Date();
    enquiry.enquiryId = getNextEnquiryId_(sheet);
    enquiry.admissionId = "";
    enquiry.createdAt = now;
    enquiry.updatedAt = now;
    appendStructuredRecord_(sheet, CONFIG.ENQUIRY_HEADERS, buildEnquiryRow_(enquiry), ["Enquiry ID", "Mobile Number"]);
    let indexWarning = "";
    try { synchronizeEnquiryIndex_(enquiry); } catch (error) {
      Logger.log("Enquiries Index synchronization failed: " + error.message);
      indexWarning = "Enquiry source was saved, but Enquiries Index synchronization failed. Rebuild the indexes.";
    }
    const response = { success: true, data: enquiry };
    if (indexWarning) response.indexWarning = indexWarning;
    return rememberIdempotentResult_(idempotency, response);
  } finally {
    lock.releaseLock();
  }
}

function updateEnquiry_(payload) {
  const enquiryId = String(payload.enquiryId || "").trim();
  if (!/^ENQ-\d+$/.test(enquiryId)) throw new Error("A valid Enquiry ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let enquiry;
  let indexWarning = "";
  try {
    const sheet = getEnquiriesSourceSheet_();
    const found = findStructuredRecord_(sheet, CONFIG.ENQUIRY_HEADERS, "Enquiry ID", enquiryId, mapEnquiryRow_);
    if (!found) throw new Error('Enquiry ID "' + enquiryId + '" was not found.');
    enquiry = enquiryFromPayload_(payload, found.record);
    enquiry.enquiryId = found.record.enquiryId;
    enquiry.admissionId = found.record.admissionId;
    enquiry.createdAt = sheet.getRange(found.row, found.info.columns["Created At"]).getValue();
    enquiry.updatedAt = new Date();
    updateStructuredRecord_(sheet, found.row, buildEnquiryRow_(enquiry), CONFIG.ENQUIRY_HEADERS);
    try { synchronizeEnquiryIndex_(enquiry); } catch (error) {
      Logger.log("Enquiries Index synchronization failed: " + error.message);
      indexWarning = "Enquiry source was updated, but Enquiries Index synchronization failed. Rebuild the indexes.";
    }
  } finally {
    lock.releaseLock();
  }
  const response = { success: true, data: enquiry };
  if (indexWarning) response.indexWarning = indexWarning;
  return response;
}

const ENQUIRY_CONVERSION_PREFIX_ = "LSA_ENQUIRY_CONVERSION_";

function findEnquiryAdmission_(sheet, enquiry, reservation) {
  const info = getAdmissionHeaderInfo_(sheet);
  const lastRow = sheet.getLastRow();
  let matchingRow = 0;
  if (lastRow >= 2 && info.columns["Enquiry ID"] && info.columns["Conversion Fingerprint"]) {
    sheet.getRange(2, info.columns["Enquiry ID"], lastRow - 1, 1).getDisplayValues().forEach(function(row, index) {
      if (String(row[0] || "").trim() !== enquiry.enquiryId) return;
      if (matchingRow) throw new Error("Multiple admissions reference this Enquiry ID.");
      matchingRow = index + 2;
    });
  }
  if (matchingRow) {
    const row = sheet.getRange(matchingRow, 1, 1, info.headers.length).getDisplayValues()[0];
    const studentId = String(row[info.columns["Student ID"] - 1] || "").trim();
    const fingerprint = String(row[info.columns["Conversion Fingerprint"] - 1] || "").trim();
    if (!studentId || !fingerprint || (reservation && (studentId !== reservation.studentId || fingerprint !== reservation.fingerprint))) {
      throw new Error("Reserved admission does not match its source row.");
    }
    if (enquiry.admissionId && studentId !== enquiry.admissionId) throw new Error("Linked admission does not match this enquiry.");
    if (!enquiry.admissionId && !reservation && (normalizeText_(row[info.columns["Full Name"] - 1]) !== normalizeText_(enquiry.fullName) ||
        String(row[info.columns["Mobile Number"] - 1] || "").trim() !== enquiry.mobileNumber ||
        normalizeCourseName_(row[info.columns.Course - 1]) !== normalizeCourseName_(enquiry.courseInterestedIn))) {
      throw new Error("Admission association does not match this enquiry.");
    }
    return { studentId: studentId, row: matchingRow, fingerprint: fingerprint };
  }
  if (reservation && findAdmissionByStudentId_(sheet, reservation.studentId)) {
    throw new Error("Reserved admission exists without its Enquiry ID association.");
  }
  return null;
}

function synchronizeConversionStudentIndex_(sheet, admissionRow) {
  const info = getAdmissionHeaderInfo_(sheet);
  const row = sheet.getRange(admissionRow, 1, 1, info.headers.length).getDisplayValues()[0];
  const columns = {};
  Object.keys(info.columns).forEach(function(header) { columns[header] = info.columns[header] - 1; });
  const student = mapAdmissionRow_(row, columns);
  student.createdAt = sheet.getRange(admissionRow, info.columns["Created At"]).getValue();
  const payments = readIndexedPayments_({ studentId: student.studentId });
  synchronizeStudentIndex_(enrichStudentsWithPayments_([student], payments)[0]);
}

function linkEnquiryAdmission_(sheet, found, studentId) {
  const columns = found.info.columns;
  const row = sheet.getRange(found.row, 1, 1, found.info.headers.length).getValues()[0];
  const existingId = String(row[columns["Admission ID"] - 1] || "").trim();
  if (existingId && existingId !== studentId) throw new Error("Enquiry is linked to another admission.");
  if (row[columns.Status - 1] !== "Converted" || !existingId) {
    row[columns.Status - 1] = "Converted";
    row[columns["Admission ID"] - 1] = studentId;
    row[columns["Updated At"] - 1] = new Date();
    sheet.getRange(found.row, 1, 1, row.length).setValues([row]);
  }
  const enquiry = Object.assign({}, found.record, {
    status: "Converted", admissionId: studentId,
    createdAt: row[columns["Created At"] - 1], updatedAt: row[columns["Updated At"] - 1]
  });
  const response = { success: true, data: { enquiryId: enquiry.enquiryId, admissionId: studentId, studentId: studentId } };
  try { synchronizeEnquiryIndex_(enquiry); } catch (error) {
    Logger.log("Enquiries Index synchronization failed: " + error.message);
    response.indexWarning = "Admission linked in the Enquiries source, but Enquiries Index synchronization failed. Rebuild the indexes.";
  }
  return response;
}

function getEnquiryConversionReservation_(properties, propertyKey, enquiryId) {
  const stored = properties.getProperty(propertyKey);
  if (!stored) return null;
  let reservation;
  try { reservation = JSON.parse(stored); } catch (error) { throw new Error("Enquiry conversion reservation is invalid."); }
  if (!reservation || typeof reservation !== "object" || Array.isArray(reservation)) {
    throw new Error("Enquiry conversion reservation is invalid.");
  }
  if (reservation.enquiryId !== enquiryId || !/^\d{8}$/.test(reservation.studentId) ||
      !reservation.sheetId || !reservation.fingerprint || !reservation.createdAt ||
      Number.isNaN(Date.parse(reservation.createdAt)) ||
      !["reserved", "admission-written"].includes(reservation.state)) {
    throw new Error("Enquiry conversion reservation is incomplete or inconsistent.");
  }
  return reservation;
}

function convertEnquiry_(payload) {
  const enquiryId = String(payload.enquiryId || "").trim();
  if (!/^ENQ-\d+$/.test(enquiryId)) throw new Error("A valid Enquiry ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getEnquiriesSourceSheet_();
    const found = findStructuredRecord_(sheet, CONFIG.ENQUIRY_HEADERS, "Enquiry ID", enquiryId, mapEnquiryRow_);
    if (!found) throw new Error('Enquiry ID "' + enquiryId + '" was not found.');
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = ENQUIRY_CONVERSION_PREFIX_ + enquiryId;
    let reservation = getEnquiryConversionReservation_(properties, propertyKey, enquiryId);
    if (found.record.admissionId) {
      const admissionCode = found.record.admissionId.substring(2, 4);
      const courseInfo = getCourseCodes_().find(function(course) { return normalizeCourseCode_(course.code) === admissionCode; });
      if (!courseInfo) throw new Error("Linked admission course code was not found.");
      const source = findAdmissionSheetForCourse_(courseInfo.courseName).sheet;
      const associated = findEnquiryAdmission_(source, found.record, null);
      if (!associated || associated.studentId !== found.record.admissionId) throw new Error("Linked admission association is missing or inconsistent.");
      if (reservation && (reservation.studentId !== associated.studentId ||
          reservation.sheetId !== source.getParent().getId() || reservation.fingerprint !== associated.fingerprint)) {
        throw new Error("Linked admission conflicts with its conversion reservation.");
      }
      try {
        synchronizeConversionStudentIndex_(source, associated.row);
      } catch (error) {
        return { success: true, partial: true, studentIndexSynchronized: false,
          indexWarning: "Students Index synchronization failed: " + error.message,
          data: { enquiryId: enquiryId, admissionId: associated.studentId, studentId: associated.studentId },
          error: "Admission is linked, but Students Index could not be repaired. Retry to recover." };
      }
      const response = linkEnquiryAdmission_(sheet, found, associated.studentId);
      if (reservation && !response.indexWarning) properties.deleteProperty(propertyKey);
      response.studentIndexSynchronized = true;
      return response;
    }
    if (!payload.admission || typeof payload.admission !== "object" || Array.isArray(payload.admission)) throw new Error("Admission details are required.");
    if (found.record.status === "Not Interested") throw new Error("This enquiry cannot be converted.");
    if (!found.record.fullName || !found.record.mobileNumber || !found.record.courseInterestedIn) throw new Error("Enquiry is missing required admission details.");
    const admission = Object.assign(Object.create(null), payload.admission);
    admission.idempotencyKey = "convert-enquiry:" + enquiryId;
    admission.enquiryId = enquiryId;
    const fingerprint = getIdempotencyContext_("add-student", admission).fingerprint;
    admission.conversionFingerprint = fingerprint;
    if (found.record.status === "Converted" && !reservation) throw new Error("Converted enquiry has no recoverable admission association.");
    if (reservation && reservation.fingerprint !== fingerprint) throw new Error("Enquiry conversion details differ from the reserved attempt.");
    const admissionSheet = reservation
      ? SpreadsheetApp.openById(reservation.sheetId).getSheets()[0]
      : findAdmissionSheetForCourse_(admission.course).sheet;
    let existing = findEnquiryAdmission_(admissionSheet, found.record, reservation);
    if (existing && existing.fingerprint !== fingerprint) throw new Error("Admission association differs from the conversion details.");
    if (found.record.status === "Converted" && !existing) throw new Error("Converted enquiry has no recoverable admission source row.");
    if (!existing && !reservation && (normalizeText_(admission.fullName) !== normalizeText_(found.record.fullName) ||
        String(admission.mobileNumber || "").trim() !== found.record.mobileNumber ||
        normalizeCourseName_(admission.course) !== normalizeCourseName_(found.record.courseInterestedIn))) {
      throw new Error("Admission identity must match the enquiry.");
    }
    if (!existing && getIdempotencyResult_(getIdempotencyContext_("add-student", admission)).found) {
      throw new Error("Admission was recorded but its Enquiry association could not be located.");
    }
    let initialStudentIndexWarning = "";
    if (!existing) {
      try {
        const created = addStudent_(admission, { reserve: function(nextId, sourceSheet) {
          reservation = { enquiryId: enquiryId, studentId: nextId, sheetId: sourceSheet.getParent().getId(),
            fingerprint: fingerprint, createdAt: reservation ? reservation.createdAt : new Date().toISOString(), state: "reserved" };
          properties.setProperty(propertyKey, JSON.stringify(reservation));
        }, recordAdmission: function() {
          reservation.state = "admission-written";
          properties.setProperty(propertyKey, JSON.stringify(reservation));
        } });
        existing = findEnquiryAdmission_(admissionSheet, found.record, reservation);
        if (!existing || existing.studentId !== created.student.studentId) throw new Error("Admission association was not saved.");
        initialStudentIndexWarning = created.indexWarning || "";
      } catch (error) {
        if (!reservation) throw error;
        existing = findEnquiryAdmission_(SpreadsheetApp.openById(reservation.sheetId).getSheets()[0], found.record, reservation);
        if (!existing) throw error;
      }
    }
    const studentId = existing.studentId;
    if (reservation && reservation.state === "reserved") {
      reservation.state = "admission-written";
      properties.setProperty(propertyKey, JSON.stringify(reservation));
    }
    try {
      synchronizeConversionStudentIndex_(admissionSheet, existing.row);
    } catch (error) {
      return { success: true, partial: true, studentIndexSynchronized: false,
        indexWarning: "Students Index synchronization failed: " + error.message,
        data: { enquiryId: enquiryId, admissionId: studentId, studentId: studentId },
        error: "Admission created, but Students Index could not be synchronized. Retry this conversion to repair it." };
    }
    try {
      const response = linkEnquiryAdmission_(sheet, found, studentId);
      if (!response.indexWarning) properties.deleteProperty(propertyKey);
      response.studentIndexSynchronized = true;
      if (initialStudentIndexWarning) response.studentIndexWarning = initialStudentIndexWarning;
      return response;
    } catch (error) {
      Logger.log("Admission created but Enquiry linkage failed: " + error.message);
      return { success: true, partial: true, data: { enquiryId: enquiryId, admissionId: studentId, studentId: studentId },
        error: "Admission created, but enquiry could not be linked. Retry this conversion to recover without creating another admission." };
    }
  } finally {
    lock.releaseLock();
  }
}

function addWalkIn_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let visitor;
  let indexWarning = "";
  let idempotency = null;
  try {
    idempotency = getIdempotencyContext_("add-walkin", payload);
    const previousResult = getIdempotencyResult_(idempotency);
    if (previousResult.found) return previousResult.response;
    const now = new Date();
    const sheet = getVisitorsSourceSheet_();
    visitor = visitorFromPayload_(payload, null);
    visitor.visitorId = getNextAnnualId_(sheet, CONFIG.VISITOR_HEADERS, "Visitor ID", "VIS", now);
    visitor.visitDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    visitor.entryTime = now;
    visitor.exitTime = "";
    visitor.visitStatus = "Currently Inside";
    visitor.conversionStatus = "Not Converted";
    visitor.admissionId = "";
    visitor.createdAt = now;
    visitor.updatedAt = now;
    appendStructuredRecord_(sheet, CONFIG.VISITOR_HEADERS, buildVisitorRow_(visitor), ["Visitor ID", "Mobile Number"]);
    try { synchronizeVisitorIndex_(visitor); } catch (error) {
      Logger.log("Visitors Index synchronization failed: " + error.message);
      indexWarning = "Walk-in source was saved, but Visitors Index synchronization failed. Rebuild the visitor indexes.";
    }
    const response = { success: true, data: visitor };
    if (indexWarning) response.indexWarning = indexWarning;
    return rememberIdempotentResult_(idempotency, response);
  } finally {
    lock.releaseLock();
  }
}

function updateWalkIn_(payload) {
  const visitorId = String(payload.visitorId || "").trim();
  if (!visitorId) throw new Error("Visitor ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let visitor;
  let indexWarning = "";
  try {
    const sheet = getVisitorsSourceSheet_();
    const found = findStructuredRecord_(sheet, CONFIG.VISITOR_HEADERS, "Visitor ID", visitorId, mapVisitorRow_);
    if (!found) throw new Error('Visitor ID "' + visitorId + '" was not found.');
    visitor = visitorFromPayload_(payload, found.record);
    visitor.visitorId = visitorId;
    visitor.admissionId = found.record.admissionId;
    visitor.createdAt = found.record.createdAt;
    visitor.updatedAt = new Date();
    updateStructuredRecord_(sheet, found.row, buildVisitorRow_(visitor), CONFIG.VISITOR_HEADERS);
    try { synchronizeVisitorIndex_(visitor); } catch (error) {
      Logger.log("Visitors Index synchronization failed: " + error.message);
      indexWarning = "Walk-in source was updated, but Visitors Index synchronization failed. Rebuild the visitor indexes.";
    }
  } finally { lock.releaseLock(); }
  const response = { success: true, data: visitor };
  if (indexWarning) response.indexWarning = indexWarning;
  return response;
}

function markWalkInExit_(payload) {
  const visitorId = String(payload.visitorId || "").trim();
  if (!visitorId) throw new Error("Visitor ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let visitor;
  let alreadyCompleted = false;
  let indexWarning = "";
  try {
    const sheet = getVisitorsSourceSheet_();
    const found = findStructuredRecord_(sheet, CONFIG.VISITOR_HEADERS, "Visitor ID", visitorId, mapVisitorRow_);
    if (!found) throw new Error('Visitor ID "' + visitorId + '" was not found.');
    visitor = found.record;
    alreadyCompleted = visitor.visitStatus === "Completed" && Boolean(visitor.exitTime);
    if (!alreadyCompleted) {
      visitor.exitTime = new Date();
      visitor.visitStatus = "Completed";
      visitor.updatedAt = new Date();
      updateStructuredRecord_(sheet, found.row, buildVisitorRow_(visitor), CONFIG.VISITOR_HEADERS);
    }
    try { synchronizeVisitorIndex_(visitor); } catch (error) {
      Logger.log("Visitors Index synchronization failed: " + error.message);
      indexWarning = "Walk-in source is safe, but Visitors Index synchronization failed. Rebuild the visitor indexes.";
    }
  } finally { lock.releaseLock(); }
  const response = { success: true, data: visitor, alreadyCompleted: alreadyCompleted };
  if (indexWarning) response.indexWarning = indexWarning;
  return response;
}

function addFollowUp_(payload) {
  const visitorId = String(payload.visitorId || "").trim();
  if (!visitorId) throw new Error("Visitor ID is required.");
  const scheduledDateText = String(payload.scheduledDate || "").trim();
  const scheduledDate = parseDateOnly_(scheduledDateText);
  if (!scheduledDate) throw new Error("Scheduled Date must use YYYY-MM-DD.");
  const status = requireAllowedOption_(payload.followUpStatus || "Pending", CONFIG.FOLLOW_UP_STATUSES, "Follow-up Status");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let followUp;
  let indexWarning = "";
  let idempotency = null;
  try {
    idempotency = getIdempotencyContext_("add-followup", payload);
    const previousResult = getIdempotencyResult_(idempotency);
    if (previousResult.found) return previousResult.response;
    const now = new Date();
    const visitorFound = findStructuredRecord_(getVisitorsSourceSheet_(), CONFIG.VISITOR_HEADERS, "Visitor ID", visitorId, mapVisitorRow_);
    if (!visitorFound) throw new Error('Visitor ID "' + visitorId + '" was not found.');
    const visitor = visitorFound.record;
    const sheet = getFollowUpsSourceSheet_();
    const existing = readFollowUpSourceRecords_().filter(function(record) { return record.visitorId === visitorId; });
    const nextNumber = existing.reduce(function(highest, record) { return Math.max(highest, record.followUpNumber); }, 0) + 1;
    followUp = {
      followUpId: getNextAnnualId_(sheet, CONFIG.FOLLOW_UP_HEADERS, "Follow-up ID", "FU", now),
      visitorId: visitorId, fullName: visitor.fullName, mobileNumber: visitor.mobileNumber,
      courseInterestedIn: visitor.courseInterestedIn, followUpNumber: nextNumber, scheduledDate: scheduledDateText,
      completedDate: status === "Completed" ? now : "", followUpStatus: status,
      contactMethod: String(payload.contactMethod || "").trim(), notes: String(payload.notes || "").trim(),
      createdBy: String(payload.createdBy || "").trim(), createdAt: now, updatedAt: now
    };
    appendStructuredRecord_(sheet, CONFIG.FOLLOW_UP_HEADERS, buildFollowUpRow_(followUp), ["Follow-up ID", "Visitor ID", "Mobile Number"]);
    try { synchronizeFollowUpIndex_(followUp); } catch (error) {
      Logger.log("Follow-ups Index synchronization failed: " + error.message);
      indexWarning = "Follow-up source was saved, but Follow-ups Index synchronization failed. Rebuild the visitor indexes.";
    }
    const response = { success: true, data: followUp };
    if (indexWarning) response.indexWarning = indexWarning;
    return rememberIdempotentResult_(idempotency, response);
  } finally { lock.releaseLock(); }
}

function updateFollowUp_(payload) {
  const followUpId = String(payload.followUpId || "").trim();
  if (!followUpId) throw new Error("Follow-up ID is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let followUp;
  let indexWarning = "";
  try {
    const sheet = getFollowUpsSourceSheet_();
    const found = findStructuredRecord_(sheet, CONFIG.FOLLOW_UP_HEADERS, "Follow-up ID", followUpId, mapFollowUpRow_);
    if (!found) throw new Error('Follow-up ID "' + followUpId + '" was not found.');
    followUp = found.record;
    if (Object.prototype.hasOwnProperty.call(payload, "scheduledDate")) {
      const scheduledDate = String(payload.scheduledDate || "").trim();
      if (!parseDateOnly_(scheduledDate)) throw new Error("Scheduled Date must use YYYY-MM-DD.");
      followUp.scheduledDate = scheduledDate;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "followUpStatus")) {
      const previousStatus = followUp.followUpStatus;
      followUp.followUpStatus = requireAllowedOption_(payload.followUpStatus, CONFIG.FOLLOW_UP_STATUSES, "Follow-up Status");
      if (followUp.followUpStatus === "Completed" && previousStatus !== "Completed") followUp.completedDate = new Date();
      if (followUp.followUpStatus !== "Completed") followUp.completedDate = "";
    }
    if (Object.prototype.hasOwnProperty.call(payload, "contactMethod")) followUp.contactMethod = String(payload.contactMethod || "").trim();
    if (Object.prototype.hasOwnProperty.call(payload, "notes")) followUp.notes = String(payload.notes || "").trim();
    followUp.updatedAt = new Date();
    updateStructuredRecord_(sheet, found.row, buildFollowUpRow_(followUp), CONFIG.FOLLOW_UP_HEADERS);
    try { synchronizeFollowUpIndex_(followUp); } catch (error) {
      Logger.log("Follow-ups Index synchronization failed: " + error.message);
      indexWarning = "Follow-up source was updated, but Follow-ups Index synchronization failed. Rebuild the visitor indexes.";
    }
  } finally { lock.releaseLock(); }
  const response = { success: true, data: followUp };
  if (indexWarning) response.indexWarning = indexWarning;
  return response;
}


// ============================================================
// PAYMENTS API - ADD PAYMENT
// ============================================================

function addPayment_(payload) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(15000);

  try {
    const idempotency = getIdempotencyContext_("add-payment", payload);
    const previousResult = getIdempotencyResult_(idempotency);
    if (previousResult.found) return previousResult.response;

    const course =
      String(payload.course || "").trim();

    const studentId =
      String(payload.studentId || "").trim();

    const paymentDate =
      parseDateOnly_(
        payload.paymentDate
      );

    const feeType =
      optionalAllowedOption_(
        payload.feeType,
        CONFIG.FEE_TYPES,
        "Fee Type"
      );

    const paymentMode =
      optionalAllowedOption_(
        payload.paymentMode,
        CONFIG.PAYMENT_MODES,
        "Payment Mode"
      );

    const amountPaid =
      normalizeOptionalMoney_(
        payload.amountPaid
      );

    if (!course) {

      throw new Error("Course is required.");

    }

    if (!paymentDate) {

      throw new Error(
        "Invalid Payment Date. Expected YYYY-MM-DD."
      );

    }

    if (amountPaid === null || amountPaid <= 0) {

      throw new Error(
        "Amount Paid must be greater than zero."
      );

    }

    const courseInfo =
      findCourseCodeByName_(course);

    if (!courseInfo) {

      throw new Error(
        'Course "' +
        course +
        '" was not found in Course Codes.'
      );

    }

    if (normalizeActive_(courseInfo.active) !== "Yes") {

      throw new Error(
        'Course "' +
        course +
        '" is inactive.'
      );

    }

    if (normalizeCourseCode_(courseInfo.code) === "00") {

      return rememberIdempotentResult_(idempotency, addOtherProgramPayment_(
        payload,
        courseInfo,
        paymentDate,
        feeType,
        paymentMode,
        amountPaid
      ));

    }

    if (!studentId) {

      throw new Error("Student ID is required.");

    }

    const admissionInfo =
      findAdmissionSheetForCourse_(
        courseInfo.courseName
      );

    const admission =
      findAdmissionByStudentId_(
        admissionInfo.sheet,
        studentId
      );

    if (!admission) {

      throw new Error(
        'Student ID "' +
        studentId +
        '" was not found for course "' +
        courseInfo.courseName +
        '".'
      );

    }

    if (
      normalizeCourseName_(admission.course) !==
      normalizeCourseName_(courseInfo.courseName)
    ) {

      throw new Error(
        "Student course does not match the requested payment course."
      );

    }

    const paymentInfo =
      findPaymentSheetForCourse_(
        courseInfo.courseName
      );

    const previousPaymentSummary =
      getPreviousPaid_(
        paymentInfo.sheet,
        studentId
      );

    const previousPaid = previousPaymentSummary.totalPaid;

    const totalPaid =
      roundMoney_(
        previousPaid + amountPaid
      );

    const balance =
      roundMoney_(
        admission.finalFee - totalPaid
      );

    if (balance < 0) {

      throw new Error(
        "Payment exceeds the student's remaining balance."
      );

    }

    return rememberIdempotentResult_(idempotency, appendPayment_(
      paymentInfo.sheet,
      {
        receiptId: getNextReceiptId_(
          paymentInfo.sheet,
          paymentDate,
          normalizeCourseCode_(courseInfo.code),
          admission.batch
        ),
        studentId: studentId,
        studentName: admission.fullName,
        course: courseInfo.courseName,
        batch: admission.batch,
        enrollmentMonth: admission.enrollmentMonth,
        enrollmentYear: admission.enrollmentYear,
        paymentDate: paymentDate,
        feeType: feeType,
        amountPaid: amountPaid,
        paymentMode: paymentMode,
        previousPaid: previousPaid,
        totalPaid: totalPaid,
        balance: balance,
        paymentCount: previousPaymentSummary.paymentCount + 1,
        createdBy: getCreatedBy_(),
        createdAt: new Date(),
        remarks: String(payload.remarks || "").trim()
      }
    ));

  } finally {

    lock.releaseLock();

  }

}


function addOtherProgramPayment_(
  payload,
  courseInfo,
  paymentDate,
  feeType,
  paymentMode,
  amountPaid
) {

  const programType =
    requireAllowedOption_(
      payload.programType,
      CONFIG.OTHER_PROGRAM_TYPES,
      "Program Type"
    );

  const finalFee =
    normalizeOptionalMoney_(
      payload.finalFee
    );

  const studentName =
    String(
      payload.studentName ||
      payload.fullName ||
      ""
    ).trim();

  if (!studentName) {

    throw new Error("Student Name is required.");

  }

  if (finalFee === null || finalFee < 0) {

    throw new Error(
      "Final Fee is required for an Other Programs payment."
    );

  }

  if (amountPaid > finalFee) {

    throw new Error("Payment exceeds the remaining balance.");

  }

  const paymentInfo =
    findPaymentSheetForCourse_(
      courseInfo.courseName
    );

  const receiptId =
    getNextOtherProgramReceiptId_(
      paymentInfo.sheet,
      paymentDate,
      programType
    );

  return appendPayment_(
    paymentInfo.sheet,
    {
      receiptId: receiptId,
      studentId: receiptId,
      studentName: studentName,
      course: courseInfo.courseName,
      batch: "",
      enrollmentMonth: paymentDate.toLocaleString(
        "en-US", { month: "long" }
      ),
      enrollmentYear: String(paymentDate.getFullYear()),
      paymentDate: paymentDate,
      feeType: feeType,
      amountPaid: amountPaid,
      paymentMode: paymentMode,
      previousPaid: 0,
      totalPaid: amountPaid,
      balance: roundMoney_(finalFee - amountPaid),
      createdBy: getCreatedBy_(),
      createdAt: new Date(),
      remarks: String(payload.remarks || "").trim()
    }
  );

}


function findAdmissionByStudentId_(
  sheet,
  studentId
) {

  const headerInfo =
    getAdmissionHeaderInfo_(sheet);

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {

    return null;

  }

  const values = sheet.getRange(
    2, 1, lastRow - 1, headerInfo.headers.length
  ).getDisplayValues();

  for (let index = 0; index < values.length; index++) {

    const row = values[index];

    if (
      String(
        row[headerInfo.columns["Student ID"] - 1] || ""
      ).trim() !== studentId
    ) {

      continue;

    }

    const finalFee = normalizeOptionalMoney_(
      row[headerInfo.columns["Final Fee"] - 1]
    );

    if (finalFee === null || finalFee < 0) {

      throw new Error(
        'Student ID "' +
        studentId +
        '" has an invalid Final Fee.'
      );

    }

    return {
      row: index + 2,
      fullName: row[headerInfo.columns["Full Name"] - 1],
      course: row[headerInfo.columns.Course - 1],
      batch: row[headerInfo.columns.Batch - 1],
      enrollmentMonth: row[headerInfo.columns["Enrollment Month"] - 1],
      enrollmentYear: row[headerInfo.columns["Enrollment Year"] - 1],
      finalFee: finalFee
    };

  }

  return null;

}


function getPaymentHeaderInfo_(
  sheet
) {

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {

    throw new Error("Payment sheet has no headers.");

  }

  const headers = sheet.getRange(
    1, 1, 1, lastColumn
  ).getDisplayValues()[0].map(
    function(header) {
      return String(header).trim();
    }
  );

  const columns = {};

  headers.forEach(
    function(header, index) {
      if (header) {
        columns[header] = index + 1;
      }
    }
  );

  CONFIG.PAYMENT_HEADERS.forEach(
    function(header) {
      if (!columns[header]) {
        throw new Error(
          'Payment sheet is missing required column "' +
          header +
          '".'
        );
      }
    }
  );

  return { headers: headers, columns: columns };

}


function getPreviousPaid_(
  sheet,
  studentId
) {

  const headerInfo = getPaymentHeaderInfo_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(
    2, 1, lastRow - 1, headerInfo.headers.length
  ).getDisplayValues();

  let totalPaid = 0;
  let paymentCount = 0;
  values.forEach(function(row) {
        if (
          String(
            row[headerInfo.columns["Student ID"] - 1] || ""
          ).trim() !== studentId
        ) {
          return;
        }

        const paid = normalizeOptionalMoney_(
          row[headerInfo.columns["Amount Paid"] - 1]
        );

        totalPaid += paid === null ? 0 : paid;
        paymentCount += 1;
      });

  return {
    totalPaid: roundMoney_(totalPaid),
    paymentCount: paymentCount
  };

}


function appendPayment_(
  sheet,
  payment
) {

  const headerInfo = getPaymentHeaderInfo_(sheet);
  const rowValues = headerInfo.headers.map(
    function(header) {
      const fieldNames = {
        "Receipt ID": "receiptId",
        "Student ID": "studentId",
        "Student Name": "studentName",
        "Course": "course",
        "Batch": "batch",
        "Enrollment Month": "enrollmentMonth",
        "Enrollment Year": "enrollmentYear",
        "Payment Date": "paymentDate",
        "Fee Type": "feeType",
        "Amount Paid": "amountPaid",
        "Payment Mode": "paymentMode",
        "Previous Paid": "previousPaid",
        "Total Paid": "totalPaid",
        "Balance": "balance",
        "Created By": "createdBy",
        "Created At": "createdAt",
        "Remarks": "remarks"
      };

      return fieldNames[header]
        ? payment[fieldNames[header]]
        : "";
    }
  );

  const nextRow = Math.max(sheet.getLastRow() + 1, 2);

  sheet.getRange(
    nextRow, 1, 1, rowValues.length
  ).setValues([rowValues]);

  ["Receipt ID", "Student ID"].forEach(
    function(header) {
      sheet.getRange(
        nextRow,
        headerInfo.columns[header]
      ).setNumberFormat("@").setValue(
        payment[header === "Receipt ID" ? "receiptId" : "studentId"]
      );
    }
  );

  const response = {
    success: true,
    message: "Payment receipt created successfully.",
    receipt: {
      receiptId: payment.receiptId,
      studentId: payment.studentId,
      previousPaid: payment.previousPaid,
      totalPaid: payment.totalPaid,
      balance: payment.balance
    },
    sheet: {
      name: sheet.getName(),
      id: sheet.getParent().getId(),
      row: nextRow
    }
  };

  try {

    synchronizePaymentIndexes_(payment);

  } catch (error) {

    response.indexWarning = "Index synchronization failed: " + error.message;

  }

  return response;

}


function getNextReceiptId_(
  sheet,
  paymentDate,
  courseCode,
  batch
) {

  const prefix = [
    "LSA",
    String(paymentDate.getFullYear()).slice(-2),
    courseCode,
    normalizeBatch_(batch)
  ].join("-") + "-";

  return prefix + String(
    getNextReceiptSequence_(sheet, prefix)
  ).padStart(2, "0");

}


function getNextOtherProgramReceiptId_(
  sheet,
  paymentDate,
  programType
) {

  const prefix = [
    "LSA",
    String(paymentDate.getFullYear()).slice(-2),
    "00",
    normalizeText_(programType).toUpperCase().replace(/\s+/g, "-")
  ].join("-") + "-";

  return prefix + String(
    getNextReceiptSequence_(sheet, prefix)
  ).padStart(2, "0");

}


function getNextReceiptSequence_(
  sheet,
  prefix
) {

  const headerInfo = getPaymentHeaderInfo_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 1;
  }

  const values = sheet.getRange(
    2, headerInfo.columns["Receipt ID"], lastRow - 1, 1
  ).getDisplayValues();

  let highestSequence = 0;

  values.forEach(
    function(row) {
      const receiptId = String(row[0] || "").trim();
      if (receiptId.indexOf(prefix) !== 0) {
        return;
      }

      const sequence = Number(
        receiptId.substring(prefix.length)
      );

      if (Number.isInteger(sequence) && sequence > highestSequence) {
        highestSequence = sequence;
      }
    }
  );

  return highestSequence + 1;

}


function requireAllowedOption_(
  value,
  allowedValues,
  label
) {

  const normalized = normalizeText_(value);

  for (let index = 0; index < allowedValues.length; index++) {
    if (normalizeText_(allowedValues[index]) === normalized) {
      return allowedValues[index];
    }
  }

  throw new Error(
    label +
    " must be one of: " +
    allowedValues.join(", ") +
    "."
  );

}


function optionalAllowedOption_(
  value,
  allowedValues,
  label
) {

  if (!String(value || "").trim()) {
    return "";
  }

  return requireAllowedOption_(
    value,
    allowedValues,
    label
  );

}


function getCreatedBy_() {
  if (CURRENT_GATEWAY_IDENTITY_ && CURRENT_GATEWAY_IDENTITY_.email) return CURRENT_GATEWAY_IDENTITY_.email;
  return Session.getActiveUser().getEmail() || "Unknown";

}


function roundMoney_(
  value
) {

  return Math.round((value + Number.EPSILON) * 100) / 100;

}

function testAddStudent() {

  validateBatchTimes_("10:00", "12:00");

  const nextSequence =
    getNextStudentSequenceFromValues_(
      [["26040101"], ["26040103"], ["25040199"]],
      "04",
      "01",
      "26"
    );

  if (nextSequence !== 4) {

    throw new Error(
      "Student sequence validation failed."
    );

  }

  Logger.log(
    JSON.stringify({
      studentId: "26040101",
      enrollmentMonth: "September",
      enrollmentYear: "2026",
      finalFee: 9000,
      success: true
    })
  );

}