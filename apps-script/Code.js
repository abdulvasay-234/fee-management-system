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

  ADMISSION_SHEET_IDS: {
    "python programming": "1rTp-0i6I-_K0QzLLwoZnOgsQ6qiBkeL9OKcO2EYin8U",
    "data science": "1JL202KADTPv5iGkYeiazeKtWDk_0hxlOiIuJgjBSuA0",
    "full stack java": "1gBqAdF3qyYf3s3p4iTL0zmic8AkT1KQmJsvpff6akN0",
    "devops": "1Ke6YqhBYHV2YJDOa5yn8sKRiXM3IIVHMC5nfZe0NEzw",
    "cyber security": "1z3aYiMFnz9vGZDKin6w6qmyvdPu8oCJ5V2VhiWBe0tM"
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
    "Remarks", "Created At"
  ],

  PAYMENT_HEADERS: [
    "Receipt ID", "Student ID", "Student Name", "Course", "Batch",
    "Enrollment Month", "Enrollment Year", "Payment Date", "Fee Type",
    "Amount Paid", "Payment Mode", "Previous Paid", "Total Paid",
    "Balance", "Created By", "Created At", "Remarks"
  ],

  STUDENTS_INDEX_HEADERS: [
    "Student ID", "Full Name", "Father's Name", "Mother's Name", "Date of Birth", "Gender", "Mobile Number", "Email", "Address", "City", "State", "Pincode", "Course", "Batch", "Start Time", "End Time", "Enrollment Month", "Enrollment Year", "Admission Date", "Course Duration", "Total Course Fee", "Discount", "Final Fee", "Total Paid", "Balance", "Latest Payment Date", "Latest Receipt ID", "Payment Count", "Remarks", "Created At"
  ],

  PAYMENT_MODES: ["Cash", "UPI", "Bank Transfer", "Card", "Other"],
  FEE_TYPES: ["Admission Fee", "Installment", "Full Payment", "Other"],
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


// ============================================================
// GET REQUEST
// ============================================================

function doGet(e) {
  try {

    const action =
      e && e.parameter
        ? e.parameter.action
        : "";

    // --------------------------------------------------------
    // COURSE CODES
    // --------------------------------------------------------

    if (action === "course-codes") {

      return jsonResponse_({
        success: true,
        data: getCourseCodes_()
      });

    }

    if (action === "students") {

      return jsonResponse_({
        success: true,
        data: getStudents_(e.parameter)
      });

    }

    if (action === "student") {

      return jsonResponse_({
        success: true,
        data: getStudentDetails_(e.parameter)
      });

    }

    if (action === "payments") {

      return jsonResponse_({
        success: true,
        data: getPayments_(e.parameter)
      });

    }

    if (action === "dashboard") {

      return jsonResponse_({
        success: true,
        data: getDashboardData_()
      });

    }

    if (action === "rebuild-indexes") {

      if (e.parameter.confirm !== "REBUILD_INDEXES") {
        throw new Error("Index rebuild requires explicit confirmation.");
      }

      return jsonResponse_({
        success: true,
        data: rebuildIndexes_()
      });

    }


    // --------------------------------------------------------
    // HEALTH
    // --------------------------------------------------------

    if (action === "health") {

      return jsonResponse_({
        success: true,
        message: "LSA Admin API is running",
        timestamp: new Date().toISOString()
      });

    }


    // --------------------------------------------------------
    // TEST DRIVE
    // --------------------------------------------------------

    if (action === "test-drive") {

      return jsonResponse_(
        testDriveConnection_()
      );

    }


    // --------------------------------------------------------
    // DEFAULT
    // --------------------------------------------------------

    return jsonResponse_({
      success: true,
      message: "LSA Admin API is running",

      availableActions: [
        "health",
        "test-drive",
        "course-codes",
        "students",
        "student",
        "payments",
        "dashboard"
      ]
    });


  } catch (error) {

    return jsonResponse_({
      success: false,
      error: error.message
    });

  }
}


// ============================================================
// POST REQUEST
// ============================================================

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return jsonResponse_({
        success: false,
        error: "Empty POST request body"
      });

    }


    const body =
      JSON.parse(
        e.postData.contents || "{}"
      );


    const action =
      String(body.action || "").trim();


    // --------------------------------------------------------
    // ADD COURSE
    // --------------------------------------------------------

    if (action === "add-course") {

      return jsonResponse_(
        addCourseCode_(body)
      );

    }


    // --------------------------------------------------------
    // UPDATE COURSE
    // --------------------------------------------------------

    if (action === "update-course") {

      return jsonResponse_(
        updateCourseCode_(body)
      );

    }


    // --------------------------------------------------------
    // DELETE COURSE
    // --------------------------------------------------------

    if (action === "delete-course") {

      return jsonResponse_(
        deleteCourseCode_(body)
      );

    }
// --------------------------------------------------------
// ADD STUDENT / NEW ADMISSION
// --------------------------------------------------------

if (action === "add-student") {

  return jsonResponse_(
    addStudent_(body)
  );

}

    if (action === "add-payment") {

      return jsonResponse_(
        addPayment_(body)
      );

    }

    // --------------------------------------------------------
    // UNKNOWN ACTION
    // --------------------------------------------------------

    return jsonResponse_({
      success: false,
      error: "Unknown POST action",
      action: action
    });


  } catch (error) {

    return jsonResponse_({
      success: false,
      error: error.message
    });

  }
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

function addStudent_(payload) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(15000);

  try {

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
      String(
        payload.remarks || ""
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

    if (courseCode === "00") {

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
        sheet
      );


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
            createdAt
        }
      );


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

    return response;


  } finally {

    lock.releaseLock();

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
  sheet
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
// PAYMENTS API - ADD PAYMENT
// ============================================================

function addPayment_(payload) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(15000);

  try {

    const course =
      String(payload.course || "").trim();

    const studentId =
      String(payload.studentId || "").trim();

    const paymentDate =
      parseDateOnly_(
        payload.paymentDate
      );

    const feeType =
      requireAllowedOption_(
        payload.feeType,
        CONFIG.FEE_TYPES,
        "Fee Type"
      );

    const paymentMode =
      requireAllowedOption_(
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

      return addOtherProgramPayment_(
        payload,
        courseInfo,
        paymentDate,
        feeType,
        paymentMode,
        amountPaid
      );

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

    const previousPaid =
      getPreviousPaid_(
        paymentInfo.sheet,
        studentId
      );

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

    return appendPayment_(
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
        createdBy: getCreatedBy_(),
        createdAt: new Date(),
        remarks: String(payload.remarks || "").trim()
      }
    );

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

  return roundMoney_(
    values.reduce(
      function(total, row) {
        if (
          String(
            row[headerInfo.columns["Student ID"] - 1] || ""
          ).trim() !== studentId
        ) {
          return total;
        }

        const paid = normalizeOptionalMoney_(
          row[headerInfo.columns["Amount Paid"] - 1]
        );

        return total + (paid === null ? 0 : paid);
      },
      0
    )
  );

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


function getCreatedBy_() {

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