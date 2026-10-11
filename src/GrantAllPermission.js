// GrantAllPermission.js //
/**
 * ============================================================
 * MODULE: GRANT ALL PERMISSIONS (CAP TOAN BO QUYEN 1 LAN)
 * Chuyen trach:
 * - Goi toan bo cac dich vu cua Google Apps Script trong 1 ham duy nhat
 *   de Google bat hop thoai xin cap DAY DU QUYEN ngay tu lan chay dau tien.
 * - Tu lan sau tro di, khi nang cap them tinh nang moi (Drive, Sheet, Trigger,
 *   Web App, Dich thuat...), khong can phai cap quyen le te nua.
 * ============================================================
 */

/**
 * Ham chay 1 lan de cap toan bo quyen cho Bot tren Google Apps Script
 */
function GrantAllPermissions() {
  Logger.log("==================================================");
  Logger.log("DANG KIEM TRA VA KICH HOAT TOAN BO QUYEN HE THONG...");
  Logger.log("==================================================");

  // 1. Quyen PropertiesService & CacheService (Luu cau hinh & Chong Reply Storm)
  var props = PropertiesService.getScriptProperties();
  props.getProperties();
  var cache = CacheService.getScriptCache();
  cache.get("PERMISSION_CHECK");
  Logger.log("[1/7] PropertiesService & CacheService: DA CAP QUYEN");

  // 2. Quyen Google Drive Toan Phan (Doc/Ghi/Tao thu muc/Tao file/Chia se anh Bill)
  if (typeof DriveApp !== "undefined") {
    var rootFolder = DriveApp.getRootFolder();
    var billFolder = getOrCreateBillFolder();
    Logger.log(
      "[2/7] Google Drive (DriveApp - Root: " +
        rootFolder.getName() +
        ", Folder: " +
        (billFolder ? billFolder.getName() : "OK") +
        "): DA CAP QUYEN"
    );
  }

  // 3. Quyen Google Sheets Toan Phan (Tao file/Doc/Ghi/Xoa dong bang tinh)
  if (typeof SpreadsheetApp !== "undefined") {
    var ss = initDatabaseSheet();
    Logger.log(
      "[3/7] Google Sheets (SpreadsheetApp - " +
        (ss && ss.getName ? ss.getName() : "OK") +
        "): DA CAP QUYEN"
    );
  }

  // 4. Quyen Ket noi Mang ben ngoai (UrlFetchApp - Giao tiep Telegram API)
  if (typeof UrlFetchApp !== "undefined") {
    var botInfo = callTelegramApi("getMe", {});
    Logger.log(
      "[4/7] External Network (UrlFetchApp - Bot @" +
        (botInfo && botInfo.result ? botInfo.result.username : "OK") +
        "): DA CAP QUYEN"
    );
  }

  // 5. Quyen Quan ly Triggers tu dong (ScriptApp - Chay ngam / Hen gio)
  if (typeof ScriptApp !== "undefined" && ScriptApp.getProjectTriggers) {
    var triggers = ScriptApp.getProjectTriggers();
    Logger.log("[5/7] Script Triggers (ScriptApp - " + triggers.length + " triggers): DA CAP QUYEN");
  }

  // 6. Quyen Giao dien Web App (HtmlService & ContentService)
  if (typeof HtmlService !== "undefined" && HtmlService.createHtmlOutput) {
    HtmlService.createHtmlOutput("OK");
  }
  if (typeof ContentService !== "undefined" && ContentService.createTextOutput) {
    ContentService.createTextOutput("OK");
  }
  Logger.log("[6/7] Web App Output (HtmlService & ContentService): DA CAP QUYEN");

  // 7. Quyen Dich thuat Google (LanguageApp - Du phong cho cac tinh nang mo rong)
  if (typeof LanguageApp !== "undefined" && LanguageApp.translate) {
    LanguageApp.translate("Hello", "en", "vi");
    Logger.log("[7/7] Google Translate (LanguageApp): DA CAP QUYEN");
  }

  Logger.log("==================================================");
  Logger.log("HOAN TAT: TOAN BO QUYEN CUA BOT DA DUOC CAP DAY DU.");
  Logger.log("==================================================");

  return true;
}

function grantAllPermission() {
  return GrantAllPermissions();
}

// Export cho moi truong Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.GrantAllPermissions = GrantAllPermissions;
  global.grantAllPermission = grantAllPermission;

  module.exports = {
    GrantAllPermissions: GrantAllPermissions,
    grantAllPermission: grantAllPermission
  };
}
