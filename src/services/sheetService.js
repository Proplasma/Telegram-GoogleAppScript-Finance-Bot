// sheetService.js //
/**
 * ============================================================
 * MODULE: SHEET SERVICE (SRP - Single Responsibility Principle)
 * Chuyên trách tự động khởi tạo File Google Sheet mới gắn liền với
 * Google Apps Script và cung cấp các hàm truy xuất dữ liệu cho 5 bảng:
 * 1. Thu Chi (Quỹ Cá Nhân /c)
 * 2. Quỹ Phụ (/lcb)
 * 3. Hạn Mức (/limit)
 * 4. Lịch Sử Chốt Sổ (Lưu trữ liên thông toàn bộ giao dịch các kỳ/tháng cũ)
 * 5. Logs (Nhật ký hệ thống)
 * ============================================================
 */

var SHEET_NAMES = {
  PERSONAL: "Thu Chi",
  SUB_FUND: "Quỹ Phụ",
  LIMITS: "Hạn Mức",
  RENEW_HISTORY: "Lịch Sử Chốt Sổ",
  LOGS: "Logs"
};

var ARCHIVE_HEADERS = [
  "Kỳ Chốt / Reset",
  "Nguồn Quỹ",
  "Mã GD",
  "Thời Gian GD",
  "Người Nhập",
  "Ngân Hàng",
  "Tag",
  "Biểu Thức",
  "Số Tiền",
  "Ghi Chú",
  "Link Ảnh Bill"
];

/**
 * Lấy thời gian hiện tại định dạng chuẩn Việt Nam (dd/MM/yyyy HH:mm:ss)
 * @returns {string}
 */
function getNowFormatted() {
  if (typeof Utilities !== "undefined" && Utilities.formatDate) {
    return Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
  }
  return new Date().toLocaleString("vi-VN");
}

/**
 * Đảm bảo một bảng (Tab) tồn tại trong Spreadsheet với dòng tiêu đề chuẩn
 * @param {Spreadsheet} ss
 * @param {string} tabName
 * @param {Array<string>} headers
 * @returns {Sheet}
 */
function ensureTabWithHeaders(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    if (headerRange && headerRange.setFontWeight) {
      headerRange.setFontWeight("bold");
    }
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    if (range && range.setFontWeight) {
      range.setFontWeight("bold");
    }
  } else if (tabName === SHEET_NAMES.RENEW_HISTORY) {
    // Đảm bảo dòng tiêu đề của bảng Lịch Sử Chốt Sổ luôn đủ 11 cột chuẩn để lưu chi tiết từng giao dịch
    try {
      var firstRowVals = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (firstRowVals[2] !== "Mã GD") {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        if (sheet.getRange(1, 1, 1, headers.length).setFontWeight) {
          sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
        }
      }
    } catch (e) {}
  }
  return sheet;
}

/**
 * Lấy đối tượng Spreadsheet của Bot.
 * Nếu chưa có SHEET_ID hoặc file chưa tồn tại, tự động tạo mới 1 file Google Sheet
 * gắn liền với Google Apps Script đang chạy và lưu SHEET_ID vào ScriptProperties.
 * @returns {Spreadsheet|null}
 */
function getDatabaseSpreadsheet() {
  if (typeof SpreadsheetApp === "undefined") {
    return null;
  }

  var sheetId = getProperty("SHEET_ID");
  // Bỏ qua file Sheet cũ của bản V29 để tự động tạo 1 file Sheet mới tinh gắn với GAS v2.1.0
  if (sheetId === "1HMt89978lBGQuYa7kDXTjtLitgjjnsAhu5MZs4ivCOA") {
    sheetId = "";
  }
  var ss = null;

  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (err) {
      Logger.log("⚠️ [SheetService] Không mở được SHEET_ID cũ (" + sheetId + "), sẽ tạo file mới: " + err.message);
      ss = null;
    }
  }

  // Nếu chưa có file Google Sheet -> Tự động tạo mới gắn liền với Apps Script
  if (!ss) {
    try {
      var fileName = "SuperFinanceGAS_Database_v" + getAppVersion();
      ss = SpreadsheetApp.create(fileName);
      var newId = ss.getId();
      var newUrl = ss.getUrl();
      setProperty("SHEET_ID", newId);
      setProperty("SHEET_URL", newUrl);
      Logger.log("✅ [SheetService] Đã tự động tạo mới File Google Sheet: " + fileName);
      Logger.log("📌 SHEET_ID: " + newId);
      Logger.log("🔗 SHEET_URL: " + newUrl);
      setupAllTabs(ss);
    } catch (createErr) {
      Logger.log("❌ [SheetService] Lỗi khi tạo mới Google Sheet: " + createErr.message);
      return null;
    }
  }

  return ss;
}

/**
 * Thiết lập đầy đủ 5 bảng dữ liệu chuẩn trong Spreadsheet
 * @param {Spreadsheet} ss
 */
function setupAllTabs(ss) {
  if (!ss) return;

  var txHeaders = [
    "Mã GD",
    "Thời Gian",
    "Người Nhập",
    "Ngân Hàng",
    "Tag",
    "Biểu Thức",
    "Số Tiền",
    "Ghi Chú",
    "Link Ảnh Bill"
  ];

  // 1. Bảng Thu Chi (Quỹ Cá Nhân /c)
  ensureTabWithHeaders(ss, SHEET_NAMES.PERSONAL, txHeaders);

  // 2. Bảng Quỹ Phụ (/lcb)
  ensureTabWithHeaders(ss, SHEET_NAMES.SUB_FUND, txHeaders);

  // 3. Bảng Hạn Mức (/limit)
  ensureTabWithHeaders(ss, SHEET_NAMES.LIMITS, [
    "Tag",
    "Hạn Mức",
    "Cập Nhật Lúc",
    "Người Đặt"
  ]);

  // 4. Bảng Lịch Sử Chốt Sổ (Lưu liên thông toàn bộ các dòng giao dịch cũ qua các tháng/kỳ)
  ensureTabWithHeaders(ss, SHEET_NAMES.RENEW_HISTORY, ARCHIVE_HEADERS);

  // 5. Bảng Logs
  ensureTabWithHeaders(ss, SHEET_NAMES.LOGS, [
    "Thời Gian",
    "Người Dùng",
    "Lệnh / Sự Kiện",
    "Kết Quả"
  ]);

  // Xóa trang tính mặc định "Sheet1" / "Trang tính1" nếu có để file gọn sạch
  try {
    var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Trang tính1");
    if (defaultSheet && ss.getSheets && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (delErr) {
    // Bỏ qua nếu không xóa được trang mặc định
  }
}

/**
 * Khởi tạo cấu trúc các trang tính (Sheets) cho Finance Bot
 */
function initDatabaseSheet() {
  var ss = getDatabaseSpreadsheet();
  if (!ss) {
    Logger.log("ℹ️ [SheetService] Chưa khởi tạo được SpreadsheetApp.");
    return null;
  }
  setupAllTabs(ss);
  if (ss.getUrl) {
    setProperty("SHEET_URL", ss.getUrl());
  }
  Logger.log("✅ [SheetService] Đã kiểm tra/khởi tạo thành công toàn bộ 5 bảng dữ liệu.");
  return ss;
}

/**
 * Lấy đối tượng Sheet theo tên (tự động tạo nếu chưa tồn tại)
 * @param {string} tabName
 * @returns {Sheet|null}
 */
function getSheetByNameSafe(tabName) {
  var ss = getDatabaseSpreadsheet();
  if (!ss) return null;
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    setupAllTabs(ss);
    sheet = ss.getSheetByName(tabName);
  }
  return sheet;
}

/**
 * Ghi thêm 1 dòng giao dịch vào bảng Thu Chi hoặc Quỹ Phụ
 * @param {string} tabName
 * @param {object} txObj - { txId, time, user, bank, tag, rawAmount, amount, note, billUrl }
 */
function appendTransactionRow(tabName, txObj) {
  var sheet = getSheetByNameSafe(tabName);
  if (!sheet) {
    throw new Error("Không thể kết nối tới bảng " + tabName);
  }
  sheet.appendRow([
    txObj.txId,
    txObj.time || getNowFormatted(),
    txObj.user || "",
    txObj.bank || "Chung",
    txObj.tag || "#CHUNG",
    "'" + String(txObj.rawAmount || txObj.amount),
    Number(txObj.amount) || 0,
    txObj.note || "",
    txObj.billUrl || ""
  ]);
}

/**
 * Đọc toàn bộ danh sách giao dịch từ một bảng (bỏ qua dòng tiêu đề 1)
 * @param {string} tabName
 * @returns {Array<object>}
 */
function getAllTransactionRows(tabName) {
  var sheet = getSheetByNameSafe(tabName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var amountVal = Number(r[6]);
    if (isNaN(amountVal)) amountVal = 0;

    list.push({
      rowNumber: i + 2,
      txId: String(r[0] || ""),
      time: String(r[1] || ""),
      user: String(r[2] || ""),
      bank: String(r[3] || "Chung").trim() || "Chung",
      tag: normalizeTag(r[4] || "#CHUNG"),
      rawAmount: String(r[5] || ""),
      amount: amountVal,
      note: String(r[7] || ""),
      billUrl: String(r[8] || "")
    });
  }
  return list;
}

/**
 * Xóa một giao dịch theo Mã GD (txId) trong bảng chỉ định
 * @param {string} tabName
 * @param {string} txId
 * @returns {object|null} Thông tin dòng vừa xóa hoặc null nếu không tìm thấy
 */
function deleteTransactionByTxId(tabName, txId) {
  var sheet = getSheetByNameSafe(tabName);
  if (!sheet || !txId) return null;

  var rows = getAllTransactionRows(tabName);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].txId === String(txId)) {
      var deletedItem = rows[i];
      sheet.deleteRow(deletedItem.rowNumber);
      return deletedItem;
    }
  }
  return null;
}

/**
 * Xóa dòng giao dịch cuối cùng trong bảng chỉ định
 * @param {string} tabName
 * @returns {object|null} Thông tin dòng vừa xóa hoặc null nếu bảng trống
 */
function deleteLastTransactionRow(tabName) {
  var sheet = getSheetByNameSafe(tabName);
  if (!sheet) return null;

  var rows = getAllTransactionRows(tabName);
  if (rows.length === 0) return null;

  var lastItem = rows[rows.length - 1];
  sheet.deleteRow(lastItem.rowNumber);
  return lastItem;
}

/**
 * Đặt hoặc cập nhật hạn mức chi tiêu cho một #Tag trong bảng "Hạn Mức"
 * @param {string} tag
 * @param {number} limitAmount
 * @param {string} userStr
 */
function upsertTagLimit(tag, limitAmount, userStr) {
  var sheet = getSheetByNameSafe(SHEET_NAMES.LIMITS);
  if (!sheet) {
    throw new Error("Không thể kết nối bảng Hạn Mức");
  }

  var normTag = normalizeTag(tag);
  var nowStr = getNowFormatted();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < data.length; i++) {
      if (normalizeTag(data[i][0]) === normTag) {
        var rowIndex = i + 2;
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[normTag, Number(limitAmount), nowStr, userStr]]);
        return;
      }
    }
  }

  sheet.appendRow([normTag, Number(limitAmount), nowStr, userStr]);
}

/**
 * Lấy toàn bộ danh sách Hạn Mức theo từng #Tag (trả về object map { "#TRADA": 200000 })
 * @returns {object}
 */
function getAllTagLimits() {
  var sheet = getSheetByNameSafe(SHEET_NAMES.LIMITS);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};

  var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var map = {};
  for (var i = 0; i < data.length; i++) {
    var t = normalizeTag(data[i][0]);
    var lim = Number(data[i][1]);
    if (t && !isNaN(lim) && lim > 0) {
      map[t] = lim;
    }
  }
  return map;
}

/**
 * Làm mới bảng giao dịch khi Chốt sổ (/chotso, /renew) hoặc /reset
 * @param {string} tabName
 * @param {Array<object>} openingRows
 */
function resetSheetWithOpeningBalances(tabName, openingRows) {
  var sheet = getSheetByNameSafe(tabName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  for (var i = 0; i < openingRows.length; i++) {
    appendTransactionRow(tabName, openingRows[i]);
  }
}

/**
 * Di chuyển toàn bộ các dòng giao dịch chi tiết của cả 2 bảng ("Thu Chi" và "Quỹ Phụ")
 * nối tiếp vào bảng "Lịch Sử Chốt Sổ" để lưu trữ liên thông xuyên suốt tất cả các tháng/kỳ.
 * Đảm bảo không một giao dịch hay link ảnh Bill nào bị mất đi!
 *
 * @param {string} actionLabel - Nhãn kỳ chốt (VD: "RESET 11/10/2026 08:06" hoặc "CHỐT SỔ 11/10/2026 08:06")
 * @param {string} userLabel - Người thực hiện
 * @param {Array<object>} personalRows - Toàn bộ dòng giao dịch bảng Thu Chi
 * @param {Array<object>} subRows - Toàn bộ dòng giao dịch bảng Quỹ Phụ
 * @param {number} totalPersonal - Tổng số dư Quỹ Cá Nhân trước khi chốt/reset
 * @param {number} totalSub - Tổng số dư Quỹ Phụ trước khi chốt/reset
 * @returns {number} Tổng số dòng giao dịch đã chuyển sang bảng Lịch Sử Chốt Sổ
 */
function archiveTransactionsToHistorySheet(
  actionLabel,
  userLabel,
  personalRows,
  subRows,
  totalPersonal,
  totalSub
) {
  var sheet = getSheetByNameSafe(SHEET_NAMES.RENEW_HISTORY);
  if (!sheet) return 0;

  // Đảm bảo tiêu đề 11 cột chuẩn
  ensureTabWithHeaders(getDatabaseSpreadsheet(), SHEET_NAMES.RENEW_HISTORY, ARCHIVE_HEADERS);

  var nowStr = getNowFormatted();
  var archiveMatrix = [];

  // 1. Đưa toàn bộ từng dòng giao dịch của Quỹ Cá Nhân (/c) vào danh sách nối tiếp
  for (var i = 0; i < personalRows.length; i++) {
    var p = personalRows[i];
    archiveMatrix.push([
      actionLabel,
      "Quỹ Cá Nhân (/c)",
      p.txId,
      p.time,
      p.user,
      p.bank,
      p.tag,
      "'" + String(p.rawAmount || p.amount),
      Number(p.amount) || 0,
      p.note,
      p.billUrl || ""
    ]);
  }

  // 2. Đưa toàn bộ từng dòng giao dịch của Quỹ Phụ (/lcb) vào danh sách nối tiếp
  for (var j = 0; j < subRows.length; j++) {
    var s = subRows[j];
    archiveMatrix.push([
      actionLabel,
      "Quỹ Phụ (/lcb)",
      s.txId,
      s.time,
      s.user,
      s.bank,
      s.tag,
      "'" + String(s.rawAmount || s.amount),
      Number(s.amount) || 0,
      s.note,
      s.billUrl || ""
    ]);
  }

  // 3. Thêm 1 dòng Tổng kết cuối kỳ ngay bên dưới cụm giao dịch vừa chuyển để dễ tra cứu theo tháng
  archiveMatrix.push([
    actionLabel,
    "TONG KET KY",
    "SUMMARY",
    nowStr,
    userLabel,
    "Tong " + (personalRows.length + subRows.length) + " GD",
    "#TONGKET",
    "Du /c: " + formatCurrency(totalPersonal, false) + " | Du /lcb: " + formatCurrency(totalSub, false),
    Number(totalPersonal) || 0,
    "Da luu so lien thong (" + personalRows.length + " GD /c + " + subRows.length + " GD /lcb)",
    ""
  ]);

  // Ghi hàng loạt (Batch Write) nối tiếp vào cuối bảng Lịch Sử Chốt Sổ
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, archiveMatrix.length, ARCHIVE_HEADERS.length).setValues(archiveMatrix);

  return personalRows.length + subRows.length;
}

/**
 * Ghi nhật ký hoạt động vào Sheet 'Logs'
 * @param {string} user - Tên hoặc ID người dùng
 * @param {string} action - Lệnh hoặc hành động
 * @param {string} result - Kết quả xử lý
 */
function logToSheet(user, action, result) {
  var timeStr = getNowFormatted();
  Logger.log("📝 [Log] " + user + " | " + action + " -> " + result);

  if (typeof SpreadsheetApp === "undefined") {
    return;
  }

  try {
    var logSheet = getSheetByNameSafe(SHEET_NAMES.LOGS);
    if (logSheet) {
      logSheet.appendRow([timeStr, user, action, result]);
    }
  } catch (err) {
    Logger.log("⚠️ [SheetService] Không thể ghi log vào Sheet: " + err.message);
  }
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.SHEET_NAMES = SHEET_NAMES;
  global.ARCHIVE_HEADERS = ARCHIVE_HEADERS;
  global.getNowFormatted = getNowFormatted;
  global.getDatabaseSpreadsheet = getDatabaseSpreadsheet;
  global.initDatabaseSheet = initDatabaseSheet;
  global.getSheetByNameSafe = getSheetByNameSafe;
  global.appendTransactionRow = appendTransactionRow;
  global.getAllTransactionRows = getAllTransactionRows;
  global.deleteTransactionByTxId = deleteTransactionByTxId;
  global.deleteLastTransactionRow = deleteLastTransactionRow;
  global.upsertTagLimit = upsertTagLimit;
  global.getAllTagLimits = getAllTagLimits;
  global.resetSheetWithOpeningBalances = resetSheetWithOpeningBalances;
  global.archiveTransactionsToHistorySheet = archiveTransactionsToHistorySheet;
  global.logToSheet = logToSheet;

  module.exports = {
    SHEET_NAMES: SHEET_NAMES,
    ARCHIVE_HEADERS: ARCHIVE_HEADERS,
    getNowFormatted: getNowFormatted,
    getDatabaseSpreadsheet: getDatabaseSpreadsheet,
    initDatabaseSheet: initDatabaseSheet,
    getSheetByNameSafe: getSheetByNameSafe,
    appendTransactionRow: appendTransactionRow,
    getAllTransactionRows: getAllTransactionRows,
    deleteTransactionByTxId: deleteTransactionByTxId,
    deleteLastTransactionRow: deleteLastTransactionRow,
    upsertTagLimit: upsertTagLimit,
    getAllTagLimits: getAllTagLimits,
    resetSheetWithOpeningBalances: resetSheetWithOpeningBalances,
    archiveTransactionsToHistorySheet: archiveTransactionsToHistorySheet,
    logToSheet: logToSheet
  };
}
