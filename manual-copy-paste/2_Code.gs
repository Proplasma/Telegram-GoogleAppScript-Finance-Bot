// 2_Code.gs //
// FILE GOP TOAN BO MA NGUON LOI CHO NGUOI KHONG CHUYEN CODE (CHI CAN COPY-PASTE VAO CODE.GS TREN GOOGLE APPS SCRIPT)


// ============================================================================
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


// ============================================================================
// main.js //
/**
 * ============================================================
 * SUPER FINANCE GAS BOT (@SuperFinanceGAS_bot) - WEBHOOK & UI ENTRY POINT
 * Phiên bản: 2.2.0 (Hybrid UI) | Kiến trúc SOLID
 * Lưu ý: Hàm ActivateBot(), setupEnvironment() và mục điền WEBAPP_URL
 * nằm tại file đầu tiên: F1ActivateBot.js
 * ============================================================
 */

/**
 * Điểm tiếp nhận GET Request:
 * - Mặc định: Phục vụ giao diện đồ họa 3 Tab "Open UI Mode" (uiWebApp.html)
 *   với dữ liệu thực tế từ Google Sheets được nhúng sẵn.
 * - Nếu truyền ?format=json: Trả về JSON kiểm tra trạng thái hệ thống & quyền Drive.
 */
function doGet(e) {
  var params = (e && e.parameter) || {};

  // Nếu gọi kiểm tra trạng thái kỹ thuật dạng JSON (?format=json)
  if (params.format === "json") {
    var driveStatus = checkDrivePermissionStatus();
    var statusPayload = {
      status: getProperty("EMERGENCY_STOP") === "true" ? "emergency_stopped" : "online",
      bot: "SuperFinanceGAS_bot",
      version: getAppVersion(),
      webapp_url: getProperty("WEBAPP_URL") || "",
      sheet_url: getProperty("SHEET_URL") || "",
      drive_authorized: driveStatus.authorized,
      drive_status: driveStatus.message,
      emergency_stop: getProperty("EMERGENCY_STOP") === "true",
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(statusPayload, null, 2)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  // Mặc định: Render giao diện đồ họa "Open UI Mode" (3 Tab) trên Google Apps Script
  if (typeof HtmlService !== "undefined" && HtmlService.createTemplateFromFile) {
    try {
      var uid = params.uid || getAdminChatId();
      var initData =
        typeof getWebAppInitialData === "function"
          ? getWebAppInitialData(uid)
          : { ok: true, version: getAppVersion() };

      var template = HtmlService.createTemplateFromFile("uiWebApp");
      template.INITIAL_STATE_JSON = JSON.stringify(initData);

      var htmlOut = template
        .evaluate()
        .setTitle("Open UI Mode - @SuperFinanceGAS_bot")
        .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");

      if (HtmlService.XFrameOptionsMode && HtmlService.XFrameOptionsMode.ALLOWALL) {
        htmlOut.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
      return htmlOut;
    } catch (uiErr) {
      Logger.log("[doGet UI Error] " + uiErr.message);
      return HtmlService.createHtmlOutput(
        "<h3>Đang khởi tạo giao diện Open UI Mode...</h3><p>" + escapeHtml(uiErr.message) + "</p>"
      );
    }
  }

  // Fallback trên môi trường Local Node.js
  return ContentService.createTextOutput(
    JSON.stringify({ status: "online", version: getAppVersion(), mode: "hybrid_ui" }, null, 2)
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 * ĐIỂM TIẾP NHẬN WEBHOOK TỪ TELEGRAM (DOPOST)
 * Luôn trả về HTTP 200 OK để ngăn Telegram retry gây Reply Storm!
 * ============================================================
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return finishResponse({ status: "ignored", reason: "no_post_data" });
    }

    var updateData = JSON.parse(e.postData.contents);

    // 1. KIỂM TRA AN TOÀN & CHỐNG REPLY STORM QUA SECURITY GUARD
    var safetyCheck = verifyWebhookSafety(updateData);
    if (!safetyCheck.allowed) {
      return finishResponse({
        status: "blocked_by_security_guard",
        reason: safetyCheck.reason
      });
    }

    // Tự động đồng bộ cấu hình môi trường nếu vừa nâng cấp phiên bản mới
    if (getProperty("APP_VERSION") !== CONFIG.APP_VERSION) {
      setupEnvironment();
    }

    // 2. ĐIỀU PHỐI XỬ LÝ SỰ KIỆN
    // Nhận tất cả updateData.message (cả text, caption, photo, document, web_app_data)
    if (updateData.message) {
      dispatchCommand(updateData.message);
    } else if (updateData.callback_query) {
      handleCallbackQuery(updateData.callback_query);
    }

    return finishResponse({ status: "ok" });
  } catch (err) {
    // QUAN TRỌNG: Bắt mọi ngoại lệ và vẫn trả về HTTP 200 OK cho Telegram
    // để Telegram KHÔNG gửi lặp lại bản tin gây lỗi (tránh Reply Storm tuyệt đối)
    Logger.log("[doPost Exception] " + err.message + "\n" + (err.stack || ""));
    return finishResponse({ status: "error_handled", message: err.message });
  }
}

/**
 * Đóng gói phản hồi cho Telegram Webhook.
 * LƯU Ý QUAN TRỌNG:
 * - Trên Google Apps Script, sử dụng HtmlService.createHtmlOutput("OK") để trả về trực tiếp HTTP 200 OK,
 *   tránh lỗi "Wrong response from the webhook: 302 Found" do ContentService redirect sang script.googleusercontent.com.
 * - Trên Local Node.js (không có HtmlService), trả về JSON qua ContentService để hiển thị log chi tiết.
 * @param {object} data
 */
function finishResponse(data) {
  if (typeof HtmlService !== "undefined" && HtmlService.createHtmlOutput) {
    return HtmlService.createHtmlOutput("OK");
  }
  return ContentService.createTextOutput(JSON.stringify(data || { status: "ok" })).setMimeType(
    ContentService.MimeType.JSON
  );
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.doGet = doGet;
  global.doPost = doPost;
  global.finishResponse = finishResponse;

  module.exports = {
    doGet: doGet,
    doPost: doPost,
    finishResponse: finishResponse
  };
}


// ============================================================================
// config.js //
/**
 * ============================================================
 * MODULE: CORE CONFIG (SRP - Single Responsibility Principle)
 * Chuyên trách quản lý biến môi trường, phiên bản và phân quyền
 * cho cả Google Apps Script (PropertiesService) & Local Node.js (.env)
 * ============================================================
 */

var CONFIG = {
  APP_VERSION: "2.2.0",
  BOT_USERNAME: "SuperFinanceGAS_bot",
  DEFAULT_BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  DEFAULT_ADMIN_CHAT_ID: "YOUR_ADMIN_CHAT_ID_HERE",
  // Danh sách các User ID được phép sử dụng Bot (cách nhau bởi dấu phẩy)
  DEFAULT_ALLOWED_USER_IDS: "YOUR_USER_ID_1, YOUR_USER_ID_2",
  // Ngưỡng tuổi tối đa của tin nhắn (giây) để chặn Reply Storm khi bot vừa bật lại
  MAX_MESSAGE_AGE_SECONDS: 180
};

/**
 * Lấy giá trị cấu hình theo key.
 * Ưu tiên lấy từ PropertiesService (Script Properties trên GAS hoặc mock trong local)
 * @param {string} key
 * @returns {string}
 */
function getProperty(key) {
  try {
    if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
      var val = PropertiesService.getScriptProperties().getProperty(key);
      if (val !== null && val !== undefined && val !== "") return val;
    }
  } catch (err) {
    // Bỏ qua nếu chạy ngoài GAS
  }

  // Fallback từ process.env (khi chạy local Node.js)
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }

  if (key === "APP_VERSION") return CONFIG.APP_VERSION;
  if (key === "TELEGRAM_BOT_TOKEN") return CONFIG.DEFAULT_BOT_TOKEN;
  if (key === "ADMIN_CHAT_ID") return CONFIG.DEFAULT_ADMIN_CHAT_ID;
  if (key === "ALLOWED_USER_IDS") return CONFIG.DEFAULT_ALLOWED_USER_IDS;

  return "";
}

/**
 * Lưu một thuộc tính vào ScriptProperties
 * @param {string} key
 * @param {string} value
 */
function setProperty(key, value) {
  try {
    if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
      PropertiesService.getScriptProperties().setProperty(key, String(value));
    }
  } catch (err) {
    Logger.log("[Config] Lỗi setProperty(" + key + "): " + err.message);
  }
}

/**
 * Lấy tên phiên bản hiện tại của Bot
 * @returns {string}
 */
function getAppVersion() {
  return CONFIG.APP_VERSION;
}

/**
 * Lấy nội dung phản hồi mặc định khi tài khoản không nằm trong danh sách cho phép
 * Ví dụ: "Bot 2.1.1 Loading..."
 * @returns {string}
 */
function getUnauthorizedMessage() {
  return "Bot " + getAppVersion() + " Loading...";
}

/**
 * Lấy Telegram Bot Token
 * @returns {string}
 */
function getBotToken() {
  var token = getProperty("TELEGRAM_BOT_TOKEN");
  if (!token) {
    Logger.log("[Config] CANH BAO: Chua cau hinh TELEGRAM_BOT_TOKEN.");
  }
  return token;
}

/**
 * Lấy Admin Chat ID chính
 * @returns {string}
 */
function getAdminChatId() {
  return getProperty("ADMIN_CHAT_ID") || CONFIG.DEFAULT_ADMIN_CHAT_ID;
}

/**
 * Lấy danh sách các User ID được phép truy cập Bot (kết hợp cả cấu hình cứng & ScriptProperties)
 * @returns {Array<string>}
 */
function getAllowedUserIds() {
  var combined =
    CONFIG.DEFAULT_ALLOWED_USER_IDS +
    "," +
    (getProperty("ALLOWED_USER_IDS") || "") +
    "," +
    (getProperty("ADMIN_IDS") || "");

  var list = String(combined)
    .split(",")
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);

  var unique = [];
  for (var i = 0; i < list.length; i++) {
    if (unique.indexOf(list[i]) === -1) {
      unique.push(list[i]);
    }
  }
  return unique;
}

/**
 * Kiểm tra xem User ID có nằm trong danh sách được phép sử dụng Bot hay không
 * @param {string|number} userId
 * @returns {boolean}
 */
function isAuthorizedUser(userId) {
  if (!userId) return false;
  var allowedList = getAllowedUserIds();
  return allowedList.indexOf(String(userId).trim()) > -1;
}

/**
 * Kiểm tra quyền Admin (tương đương isAuthorizedUser hoặc thuộc ADMIN_IDS)
 * @param {string|number} userId
 * @returns {boolean}
 */
function isAdmin(userId) {
  return isAuthorizedUser(userId);
}

/**
 * Lấy toàn bộ cấu hình hệ thống
 */
function getConfig() {
  return {
    appVersion: getAppVersion(),
    botUsername: CONFIG.BOT_USERNAME,
    token: getBotToken(),
    adminIds: getAllowedUserIds().join(", "),
    sheetId: getProperty("SHEET_ID") || "",
    sheetUrl: getProperty("SHEET_URL") || "",
    webAppUrl: getProperty("WEBAPP_URL") || "",
    emergencyStop: getProperty("EMERGENCY_STOP") === "true"
  };
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.CONFIG = CONFIG;
  global.getProperty = getProperty;
  global.setProperty = setProperty;
  global.getAppVersion = getAppVersion;
  global.getUnauthorizedMessage = getUnauthorizedMessage;
  global.getBotToken = getBotToken;
  global.getAdminChatId = getAdminChatId;
  global.getAllowedUserIds = getAllowedUserIds;
  global.isAuthorizedUser = isAuthorizedUser;
  global.isAdmin = isAdmin;
  global.getConfig = getConfig;

  module.exports = {
    CONFIG: CONFIG,
    getProperty: getProperty,
    setProperty: setProperty,
    getAppVersion: getAppVersion,
    getUnauthorizedMessage: getUnauthorizedMessage,
    getBotToken: getBotToken,
    getAdminChatId: getAdminChatId,
    getAllowedUserIds: getAllowedUserIds,
    isAuthorizedUser: isAuthorizedUser,
    isAdmin: isAdmin,
    getConfig: getConfig
  };
}


// ============================================================================
// securityGuard.js //
/**
 * ============================================================
 * MODULE: SECURITY GUARD & ANTI-REPLY-STORM (SRP)
 * Chuyên trách:
 * 1. Cầu chì dừng khẩn cấp (Emergency Stop / Circuit Breaker)
 * 2. Chống hiện tượng Telegram Bot Reply Storm (lặp lệnh/spam liên tục)
 *    bằng cơ chế 3 tầng:
 *    - Tầng 1: Kiểm tra cờ EMERGENCY_STOP
 *    - Tầng 2: Khử trùng lặp update_id (CacheService + ScriptProperties)
 *    - Tầng 3: Kiểm tra tuổi tin nhắn (Drop Stale Updates quá 180 giây)
 * ============================================================
 */

/**
 * Kiểm tra xem sự kiện Webhook từ Telegram có an toàn để xử lý hay không.
 * Trả về { allowed: true } nếu hợp lệ, hoặc { allowed: false, reason: "..." } nếu cần chặn.
 * @param {object} updateData - Payload JSON từ Telegram Webhook
 * @returns {{ allowed: boolean, reason: string }}
 */
function verifyWebhookSafety(updateData) {
  if (!updateData) {
    return { allowed: false, reason: "empty_update" };
  }

  // TẦNG 1: CẦU CHÌ DỪNG KHẨN CẤP (CIRCUIT BREAKER)
  if (getProperty("EMERGENCY_STOP") === "true") {
    Logger.log("🛑 [SecurityGuard] Bot đang ở trạng thái EMERGENCY_STOP. Bỏ qua Update.");
    return { allowed: false, reason: "emergency_stopped" };
  }

  // TẦNG 2: CHỐNG LẶP UPDATE_ID ĐA TẦNG (CACHE + SCRIPT PROPERTIES)
  if (updateData.update_id) {
    var updateId = Number(updateData.update_id);
    var cache = (typeof CacheService !== "undefined" && CacheService.getScriptCache)
      ? CacheService.getScriptCache()
      : null;
    var cacheKey = "tg_fin_update_" + updateId;

    // 2.1 Kiểm tra trong bộ nhớ đệm RAM (CacheService)
    if (cache && cache.get(cacheKey)) {
      Logger.log("⚡ [SecurityGuard - Cache] Chặn Update trùng lặp #" + updateId);
      return { allowed: false, reason: "duplicate_update_cache" };
    }

    // 2.2 Kiểm tra trong bộ nhớ bền vững (ScriptProperties)
    var scriptProps = (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties)
      ? PropertiesService.getScriptProperties()
      : null;

    if (scriptProps) {
      var lastUpdateId = Number(scriptProps.getProperty("LAST_PROCESSED_UPDATE_ID") || "0");
      if (updateId <= lastUpdateId) {
        Logger.log("⚡ [SecurityGuard - Persistent] Chặn Update cũ/trùng #" + updateId + " (Đã xử lý tới #" + lastUpdateId + ")");
        if (cache) cache.put(cacheKey, "1", 21600);
        return { allowed: false, reason: "duplicate_update_persistent" };
      }
      // Ghi nhận ngay lập tức trước khi thực thi logic để tránh retry storm khi hàm xử lý lâu
      scriptProps.setProperty("LAST_PROCESSED_UPDATE_ID", String(updateId));
    }

    if (cache) {
      cache.put(cacheKey, "1", 21600); // Lưu 6 giờ
    }
  }

  // TẦNG 3: CHẶN TIN NHẮN CŨ BỊ DỒN Ứ (STALE MESSAGE PROTECTION)
  var msgObj = updateData.message || (updateData.callback_query && updateData.callback_query.message);
  if (updateData.message && updateData.message.date) {
    var nowUnix = Math.floor(Date.now() / 1000);
    var msgAgeSeconds = nowUnix - Number(updateData.message.date);
    var maxAge = (typeof CONFIG !== "undefined" && CONFIG.MAX_MESSAGE_AGE_SECONDS) ? CONFIG.MAX_MESSAGE_AGE_SECONDS : 180;

    if (msgAgeSeconds > maxAge) {
      Logger.log("⚠️ [SecurityGuard - Stale] Bỏ qua tin nhắn cũ quá hạn (" + msgAgeSeconds + "s > " + maxAge + "s).");
      return { allowed: false, reason: "stale_message_dropped" };
    }
  }

  return { allowed: true, reason: "ok" };
}

/**
 * HÀM DỪNG KHẨN CẤP TRÊN GOOGLE APPS SCRIPT (EMERGENCY KILL SWITCH)
 * Có thể chạy trực tiếp từ trình soạn thảo GAS, từ lệnh Telegram /stop_emergency, hoặc từ CLI
 */
function EmergencyStop() {
  try {
    setProperty("EMERGENCY_STOP", "true");

    // Ngắt Webhook và xóa toàn bộ hàng đợi tin nhắn đang kẹt trên Telegram
    if (typeof deleteTelegramWebhook === "function") {
      deleteTelegramWebhook(true);
    }

    // Xóa tất cả các trigger tự động (nếu có) để tránh chạy ngầm
    if (typeof ScriptApp !== "undefined" && ScriptApp.getProjectTriggers) {
      var triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    Logger.log("\n🛑 ==========================================");
    Logger.log("🛑 ĐÃ KÍCH HOẠT DỪNG KHẨN CẤP (EMERGENCY STOP)!");
    Logger.log("1. Đã bật cờ khoá EMERGENCY_STOP = true.");
    Logger.log("2. Đã xóa Webhook và hủy toàn bộ hàng đợi tin nhắn (drop_pending_updates = true).");
    Logger.log("3. Đã hủy toàn bộ Time Triggers.");
    Logger.log("==========================================\n");
    return { ok: true, status: "EMERGENCY_STOPPED" };
  } catch (e) {
    Logger.log("❌ Lỗi khi thực thi EmergencyStop: " + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * HÀM KHÔI PHỤC HOẠT ĐỘNG BOT SAU KHI DỪNG KHẨN CẤP
 */
function ResumeBot() {
  try {
    setProperty("EMERGENCY_STOP", "false");
    var webAppUrl = getProperty("WEBAPP_URL");
    if (webAppUrl && typeof setTelegramWebhook === "function") {
      setTelegramWebhook(webAppUrl, true);
    }
    Logger.log("✅ ĐÃ MỞ KHOÁ EMERGENCY_STOP VÀ KHÔI PHỤC HOẠT ĐỘNG BOT!");
    return { ok: true, status: "RESUMED" };
  } catch (e) {
    Logger.log("❌ Lỗi khi thực thi ResumeBot: " + e.message);
    return { ok: false, error: e.message };
  }
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.verifyWebhookSafety = verifyWebhookSafety;
  global.EmergencyStop = EmergencyStop;
  global.ResumeBot = ResumeBot;

  module.exports = {
    verifyWebhookSafety: verifyWebhookSafety,
    EmergencyStop: EmergencyStop,
    ResumeBot: ResumeBot
  };
}


// ============================================================================
// financeParser.js //
/**
 * ============================================================
 * MODULE: FINANCE PARSER & FORMATTER (SRP)
 * Chuyên trách:
 * 1. Phân tích cú pháp lệnh /c, /lcb, /clcb, /limit
 *    - Hỗ trợ dạng chuẩn: /c <Ngân_Hàng> [#TAG] <Số_Tiền_Hoặc_Phép_Tính> [Ghi chú]
 *    - Hỗ trợ đầy đủ phép tính: Cộng (+), Trừ (-), Nhân (*, x, ×), Chia (/, ÷), Ngoặc đơn ( )
 *    - Quy tắc dấu: '+' hoặc không dấu -> THU (dương), '-' -> CHI (âm)
 *    - Mặc định Ngân hàng -> "Chung", mặc định Tag -> "#CHUNG"
 * 2. Định dạng tiền tệ VNĐ và kẻ khung bảng Unicode rõ nét
 * ============================================================
 */

/**
 * Chuyển đổi một hạng tử tiền tệ đơn lẻ không dấu (VD: "50k", "200.000", "1tr5", "1.5tr") sang số thực
 * @param {string} rawAtom
 * @returns {number|null}
 */
function parseUnsignedMoneyAtom(rawAtom) {
  if (!rawAtom) return null;
  var s = String(rawAtom).trim().toLowerCase();
  if (!s) return null;

  // Hỗ trợ dạng "1tr5" -> 1.5tr, "2k5" -> 2.5k
  var shorthandMatch = s.match(/^(\d+)(tr|m|k|ng)(\d+)$/);
  if (shorthandMatch) {
    var mainNum = parseInt(shorthandMatch[1], 10);
    var unit = shorthandMatch[2];
    var decStr = shorthandMatch[3];
    var decVal = parseInt(decStr, 10) / Math.pow(10, decStr.length);
    var mult = unit === "tr" || unit === "m" ? 1000000 : 1000;
    return (mainNum + decVal) * mult;
  }

  // Kiểm tra hậu tố đơn vị tiền tệ (k, ng, tr, m, đ, d, vnd)
  var multiplier = 1;
  if (/(tr|m)$/.test(s)) {
    multiplier = 1000000;
    s = s.replace(/(tr|m)$/, "");
  } else if (/(k|ng)$/.test(s)) {
    multiplier = 1000;
    s = s.replace(/(k|ng)$/, "");
  } else if (/(vnd|đ|d)$/.test(s)) {
    multiplier = 1;
    s = s.replace(/(vnd|đ|d)$/, "");
  }

  // Xử lý dấu chấm phân cách hàng nghìn (VD: "200.000" hoặc "1.500.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, "");
  } else {
    // Nếu là số thập phân kiểu "1,5" (kèm k/tr) -> đổi ',' thành '.'
    s = s.replace(/,/g, ".");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }

  var num = parseFloat(s);
  if (isNaN(num)) return null;

  return num * multiplier;
}

/**
 * Chuyển đổi một hạng tử tiền tệ có dấu đơn lẻ (VD: "50k", "-200.000", "+1tr5") sang số nguyên
 * @param {string} rawTerm
 * @returns {number|null}
 */
function parseSingleMoneyTerm(rawTerm) {
  if (!rawTerm) return null;
  var s = String(rawTerm).trim();
  if (!s) return null;

  var sign = 1;
  if (s.charAt(0) === "-") {
    sign = -1;
    s = s.substring(1).trim();
  } else if (s.charAt(0) === "+") {
    sign = 1;
    s = s.substring(1).trim();
  }

  var val = parseUnsignedMoneyAtom(s);
  if (val === null) return null;
  return Math.round(sign * val);
}

/**
 * Bộ tính toán biểu thức số học đệ quy (Recursive Descent Parser)
 * Hỗ trợ đầy đủ: Cộng (+), Trừ (-), Nhân (*, ×), Chia (/, ÷), Ngoặc đơn ( ), và các đơn vị tiền tệ (k, tr, 200.000)
 * Ví dụ:
 *   "-(35k*2+15k)"   -> -85000
 *   "-(120k+30k)/3"  -> -50000
 *   "35000*2+15000"  -> 85000
 *   "-50k"           -> -50000
 *
 * @param {string} exprStr
 * @returns {number|null}
 */
function parseAmountExpression(exprStr) {
  if (exprStr === null || exprStr === undefined) return null;
  var raw = String(exprStr)
    .trim()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");

  if (!raw) return null;

  // Tách chuỗi thành danh sách các Token: Toán tử (+, -, *, /, (, )) và Hạng tử tiền tệ
  var tokens = [];
  var i = 0;
  while (i < raw.length) {
    var ch = raw.charAt(i);
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
    } else {
      var start = i;
      while (
        i < raw.length &&
        raw.charAt(i) !== "+" &&
        raw.charAt(i) !== "-" &&
        raw.charAt(i) !== "*" &&
        raw.charAt(i) !== "/" &&
        raw.charAt(i) !== "(" &&
        raw.charAt(i) !== ")"
      ) {
        i++;
      }
      var atomStr = raw.substring(start, i);
      var numVal = parseUnsignedMoneyAtom(atomStr);
      if (numVal === null) {
        return null;
      }
      tokens.push(numVal);
    }
  }

  if (tokens.length === 0) return null;

  var pos = 0;
  var hasError = false;

  // Expr = Term { ('+' | '-') Term }
  function parseExpr() {
    var left = parseTerm();
    while (!hasError && pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      var op = tokens[pos++];
      var right = parseTerm();
      if (op === "+") {
        left += right;
      } else {
        left -= right;
      }
    }
    return left;
  }

  // Term = Factor { ('*' | '/') Factor }
  function parseTerm() {
    var left = parseFactor();
    while (!hasError && pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      var op = tokens[pos++];
      var right = parseFactor();
      if (op === "*") {
        left *= right;
      } else {
        if (right === 0) {
          hasError = true;
          return 0;
        }
        left /= right;
      }
    }
    return left;
  }

  // Factor = ('+' | '-') Factor | '(' Expr ')' | Number
  function parseFactor() {
    if (pos >= tokens.length) {
      hasError = true;
      return 0;
    }

    var tok = tokens[pos];
    if (tok === "+") {
      pos++;
      return parseFactor();
    }
    if (tok === "-") {
      pos++;
      return -parseFactor();
    }
    if (tok === "(") {
      pos++;
      var inside = parseExpr();
      if (pos >= tokens.length || tokens[pos] !== ")") {
        hasError = true;
        return 0;
      }
      pos++; // Bỏ qua dấu ')'
      return inside;
    }
    if (typeof tok === "number") {
      pos++;
      return tok;
    }

    hasError = true;
    return 0;
  }

  var finalVal = parseExpr();
  if (hasError || pos !== tokens.length || !isFinite(finalVal) || isNaN(finalVal)) {
    return null;
  }

  var rounded = Math.round(finalVal);
  if (rounded === 0 && !/^0([kKmM]|tr)?$/.test(raw)) {
    return null;
  }

  return rounded;
}

/**
 * Kiểm tra một từ (token) có phải là biểu thức số tiền hợp lệ hay không
 * @param {string} token
 * @returns {boolean}
 */
function isAmountToken(token) {
  if (!token) return false;
  if (String(token).charAt(0) === "#") return false;
  return parseAmountExpression(token) !== null;
}

/**
 * Chuẩn hóa #Tag (viết hoa, tự thêm dấu # ở đầu, thay ký tự lạ)
 * @param {string} rawTag
 * @returns {string}
 */
function normalizeTag(rawTag) {
  if (!rawTag) return "#CHUNG";
  var t = String(rawTag).trim().toUpperCase();
  if (!t) return "#CHUNG";
  if (t.charAt(0) !== "#") {
    t = "#" + t;
  }
  t = t.replace(/[^#A-Z0-9_ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, "");
  return t.length > 1 ? t : "#CHUNG";
}

/**
 * Phân tích cú pháp cho các lệnh /c, /lcb, /clcb
 * Cú pháp chuẩn:
 *   /c <Ngân_Hàng> [#TAG] <Số_Tiền_Hoặc_Phép_Tính> [Ghi chú]
 * Đồng thời hỗ trợ linh hoạt:
 *   - Không nhập <Ngân_Hàng> -> Mặc định là "Chung"
 *   - Không nhập [#TAG]      -> Mặc định là "#CHUNG"
 *   - [#TAG] đặt trước hoặc ngay sau <Số_Tiền> đều nhận diện được
 *
 * @param {string} argsText - Phần chuỗi sau tên lệnh (VD: "Techcombank #TRADA -(35k*2+15k) Mua trà đá")
 * @returns {object} { valid, error, bank, tag, amount, rawAmount, note }
 */
function parseTransactionArgs(argsText) {
  var raw = String(argsText || "").trim();
  if (!raw) {
    return {
      valid: false,
      error: "Thiếu thông tin giao dịch.\nVí dụ đúng: <code>/c Techcombank #TRADA -50k Mua trà đá</code>"
    };
  }

  var tokens = raw.split(/\s+/);
  var amountIndex = -1;
  var parsedAmount = null;

  // Tìm vị trí của token Số Tiền / Biểu thức tính toán đầu tiên
  for (var i = 0; i < tokens.length; i++) {
    if (isAmountToken(tokens[i])) {
      amountIndex = i;
      parsedAmount = parseAmountExpression(tokens[i]);
      break;
    }
  }

  if (amountIndex === -1 || parsedAmount === null || parsedAmount === 0) {
    return {
      valid: false,
      error:
        "Không tìm thấy số tiền hoặc phép tính hợp lệ.\n" +
        "- Thu tiền: <code>50k</code> hoặc <code>+50k</code>\n" +
        "- Chi tiền: <code>-50k</code> hoặc <code>-(35k*2+15k)</code>\n" +
        "- Ví dụ: <code>/c Techcombank #TRADA -50k</code>"
    };
  }

  var bankParts = [];
  var tag = "";

  // Duyệt các token đứng trước <Số_Tiền> để lấy <Ngân_Hàng> và [#TAG]
  for (var j = 0; j < amountIndex; j++) {
    var tok = tokens[j];
    if (tok.charAt(0) === "#") {
      if (!tag) tag = normalizeTag(tok);
    } else {
      bankParts.push(tok);
    }
  }

  // Kiểm tra các token đứng sau <Số_Tiền>:
  // Nếu chưa có #Tag trước số tiền và token ngay sau số tiền bắt đầu bằng '#', lấy đó làm #Tag
  var noteStartIndex = amountIndex + 1;
  if (!tag && noteStartIndex < tokens.length && tokens[noteStartIndex].charAt(0) === "#") {
    tag = normalizeTag(tokens[noteStartIndex]);
    noteStartIndex++;
  }

  var bank = bankParts.length > 0 ? bankParts.join(" ") : "Chung";
  if (!tag) {
    tag = "#CHUNG";
  }

  var noteTokens = tokens.slice(noteStartIndex);
  var note = noteTokens.length > 0 ? noteTokens.join(" ") : "Không có ghi chú";

  return {
    valid: true,
    bank: bank,
    tag: tag,
    amount: parsedAmount,
    rawAmount: tokens[amountIndex],
    note: note
  };
}

/**
 * Phân tích cú pháp lệnh /limit
 * Ví dụ: /limit #TRADA 200k hoặc /limit #TRADA 100k*3
 * @param {string} argsText
 * @returns {object} { valid, error, tag, limitAmount }
 */
function parseLimitArgs(argsText) {
  var raw = String(argsText || "").trim();
  if (!raw) {
    return {
      valid: false,
      error: "Thiếu thông tin hạn mức.\nVí dụ: <code>/limit #TRADA 200k</code> hoặc <code>/limit #TRADA 200.000</code>"
    };
  }

  var tokens = raw.split(/\s+/);
  if (tokens.length < 2) {
    return {
      valid: false,
      error: "Cú pháp đúng: <code>/limit #TAG Số_Tiền</code>\nVí dụ: <code>/limit #TRADA 200k</code>"
    };
  }

  var tag = normalizeTag(tokens[0]);
  var amountVal = parseAmountExpression(tokens[1]);
  if (amountVal === null || Math.abs(amountVal) <= 0) {
    return {
      valid: false,
      error: "Số tiền hạn mức không hợp lệ.\nVí dụ: <code>/limit #TRADA 200k</code> hoặc <code>/limit #TRADA 200.000</code>"
    };
  }

  return {
    valid: true,
    tag: tag,
    limitAmount: Math.abs(amountVal)
  };
}

/**
 * Định dạng số tiền sang chuẩn VNĐ (VD: 50.000 đ, +50.000 đ, -50.000 đ)
 * @param {number} amount
 * @param {boolean} [showPlusSign=false]
 * @returns {string}
 */
function formatCurrency(amount, showPlusSign) {
  var num = Number(amount) || 0;
  var absFormatted = Math.abs(Math.round(num))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (num < 0) {
    return "-" + absFormatted + " đ";
  }
  if (num > 0 && showPlusSign) {
    return "+" + absFormatted + " đ";
  }
  return absFormatted + " đ";
}

/**
 * Căn lề chuỗi độ rộng cố định để vẽ bảng đẹp trong thẻ <pre>
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function padRight(text, width) {
  var str = String(text || "");
  if (str.length >= width) {
    return str.substring(0, width);
  }
  var spaces = "";
  for (var i = str.length; i < width; i++) {
    spaces += " ";
  }
  return str + spaces;
}

/**
 * Vẽ bảng có khung viền Unicode rõ ràng, giãn dòng thoáng mắt
 * @param {Array<object|string>} rows - Mảng các dòng: { label, value } hoặc "SEPARATOR"
 * @param {number} [labelWidth=13]
 * @param {number} [valueWidth=22]
 * @returns {string}
 */
function renderBoxTable(rows, labelWidth, valueWidth) {
  var lWidth = labelWidth || 13;
  var vWidth = valueWidth || 22;
  var totalInnerWidth = lWidth + 3 + vWidth; // "label : value"

  var horizontalLine = "";
  for (var i = 0; i < totalInnerWidth + 2; i++) {
    horizontalLine += "─";
  }

  var topBorder = "┌" + horizontalLine + "┐";
  var midBorder = "├" + horizontalLine + "┤";
  var botBorder = "└" + horizontalLine + "┘";

  var out = [topBorder];

  for (var r = 0; r < rows.length; r++) {
    var item = rows[r];
    if (item === "SEPARATOR") {
      out.push(midBorder);
    } else if (item && typeof item === "object") {
      var lbl = padRight(item.label, lWidth);
      var val = padRight(item.value, vWidth);
      out.push("│ " + lbl + " : " + val + " │");
    }
  }

  out.push(botBorder);
  return out.join("\n");
}

/**
 * Escape ký tự HTML đặc biệt để không làm vỡ thẻ HTML của Telegram
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.parseUnsignedMoneyAtom = parseUnsignedMoneyAtom;
  global.parseSingleMoneyTerm = parseSingleMoneyTerm;
  global.parseAmountExpression = parseAmountExpression;
  global.isAmountToken = isAmountToken;
  global.normalizeTag = normalizeTag;
  global.parseTransactionArgs = parseTransactionArgs;
  global.parseLimitArgs = parseLimitArgs;
  global.formatCurrency = formatCurrency;
  global.padRight = padRight;
  global.renderBoxTable = renderBoxTable;
  global.escapeHtml = escapeHtml;

  module.exports = {
    parseUnsignedMoneyAtom: parseUnsignedMoneyAtom,
    parseSingleMoneyTerm: parseSingleMoneyTerm,
    parseAmountExpression: parseAmountExpression,
    isAmountToken: isAmountToken,
    normalizeTag: normalizeTag,
    parseTransactionArgs: parseTransactionArgs,
    parseLimitArgs: parseLimitArgs,
    formatCurrency: formatCurrency,
    padRight: padRight,
    renderBoxTable: renderBoxTable,
    escapeHtml: escapeHtml
  };
}


// ============================================================================
// telegramService.js //
/**
 * ============================================================
 * MODULE: TELEGRAM SERVICE (SRP - Single Responsibility Principle)
 * Chuyên trách giao tiếp với Telegram Bot API
 * Tương thích cả Google Apps Script (UrlFetchApp) và Local Dev
 * ============================================================
 */

/**
 * Gọi Telegram Bot API
 * @param {string} method - Tên phương thức API (sendMessage, setWebhook, deleteWebhook...)
 * @param {object} payload - Dữ liệu gửi đi
 * @returns {object}
 */
function callTelegramApi(method, payload) {
  var token = getBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN chưa được cấu hình!");
  }

  var url = "https://api.telegram.org/bot" + token + "/" + method;
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var contentText = response.getContentText();
    var json = JSON.parse(contentText);

    if (responseCode !== 200 || !json.ok) {
      Logger.log("⚠️ Lỗi Telegram API (" + method + "): " + contentText);
    }
    return json;
  } catch (err) {
    Logger.log("❌ Ngoại lệ khi gọi Telegram API (" + method + "): " + err.message);
    return { ok: false, description: err.message };
  }
}

/**
 * Gửi tin nhắn văn bản định dạng HTML
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [extraOptions]
 */
function sendMessage(chatId, text, extraOptions) {
  var payload = Object.assign(
    {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    },
    extraOptions || {}
  );
  return callTelegramApi("sendMessage", payload);
}

/**
 * Gửi tin nhắn an toàn (tự động chia nhỏ nếu vượt quá 3900 ký tự)
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [extraOptions]
 */
function safeSendMessage(chatId, text, extraOptions) {
  if (!text) return null;
  var str = String(text);
  var MAX_LEN = 3900;

  if (str.length <= MAX_LEN) {
    return sendMessage(chatId, str, extraOptions);
  }

  var chunks = [];
  var lines = str.split("\n");
  var currentChunk = "";

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if ((currentChunk + "\n" + line).length > MAX_LEN) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n" + line : line;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  var lastRes = null;
  for (var j = 0; j < chunks.length; j++) {
    lastRes = sendMessage(chatId, chunks[j], extraOptions);
    if (typeof Utilities !== "undefined" && Utilities.sleep) {
      Utilities.sleep(300);
    }
  }
  return lastRes;
}

/**
 * Trả lời trực tiếp một tin nhắn (Quote Reply)
 * @param {string|number} chatId
 * @param {number} messageId
 * @param {string} text
 * @param {object} [extraOptions]
 */
function replyToMessage(chatId, messageId, text, extraOptions) {
  return sendMessage(
    chatId,
    text,
    Object.assign(
      {
        reply_parameters: { message_id: messageId }
      },
      extraOptions || {}
    )
  );
}

/**
 * Gửi tin nhắn kèm bàn phím Inline Keyboard
 * @param {string|number} chatId
 * @param {string} text
 * @param {Array<Array<object>>} keyboard
 */
function sendInlineKeyboard(chatId, text, keyboard) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

/**
 * Thiết lập Webhook cho Telegram Bot (mặc định xóa sạch hàng đợi cũ để tránh Reply Storm)
 * @param {string} webhookUrl
 * @param {boolean} [dropPendingUpdates=true]
 */
function setTelegramWebhook(webhookUrl, dropPendingUpdates) {
  return callTelegramApi("setWebhook", {
    url: webhookUrl,
    drop_pending_updates: dropPendingUpdates !== undefined ? Boolean(dropPendingUpdates) : true
  });
}

/**
 * Xóa Webhook hiện tại của Telegram Bot
 * @param {boolean} [dropPendingUpdates=true]
 */
function deleteTelegramWebhook(dropPendingUpdates) {
  return callTelegramApi("deleteWebhook", {
    drop_pending_updates: dropPendingUpdates !== undefined ? Boolean(dropPendingUpdates) : true
  });
}

/**
 * Chỉnh sửa nội dung tin nhắn đã gửi (dùng cho In-Chat Wizard chuyển bước mượt mà)
 * @param {string|number} chatId
 * @param {number} messageId
 * @param {string} text
 * @param {object} [extraOptions]
 */
function editMessageText(chatId, messageId, text, extraOptions) {
  if (!messageId) {
    return safeSendMessage(chatId, text, extraOptions);
  }
  var payload = Object.assign(
    {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML"
    },
    extraOptions || {}
  );
  var res = callTelegramApi("editMessageText", payload);
  if (!res || !res.ok) {
    // Fallback nếu tin nhắn không sửa được
    return safeSendMessage(chatId, text, extraOptions);
  }
  return res;
}

/**
 * Lấy thông tin trạng thái Webhook hiện tại
 */
function getTelegramWebhookInfo() {
  return callTelegramApi("getWebhookInfo", {});
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.callTelegramApi = callTelegramApi;
  global.sendMessage = sendMessage;
  global.safeSendMessage = safeSendMessage;
  global.replyToMessage = replyToMessage;
  global.sendInlineKeyboard = sendInlineKeyboard;
  global.editMessageText = editMessageText;
  global.setTelegramWebhook = setTelegramWebhook;
  global.deleteTelegramWebhook = deleteTelegramWebhook;
  global.getTelegramWebhookInfo = getTelegramWebhookInfo;

  module.exports = {
    callTelegramApi: callTelegramApi,
    sendMessage: sendMessage,
    safeSendMessage: safeSendMessage,
    replyToMessage: replyToMessage,
    sendInlineKeyboard: sendInlineKeyboard,
    editMessageText: editMessageText,
    setTelegramWebhook: setTelegramWebhook,
    deleteTelegramWebhook: deleteTelegramWebhook,
    getTelegramWebhookInfo: getTelegramWebhookInfo
  };
}


// ============================================================================
// driveService.js //
/**
 * ============================================================
 * MODULE: GOOGLE DRIVE SERVICE (SRP)
 * Chuyên trách:
 * 1. Nhận diện ảnh hóa đơn (Bill) từ 3 nguồn:
 *    - Ảnh gửi kèm trực tiếp Caption lệnh (/c, /lcb, /clcb)
 *    - Lệnh Reply (trả lời) vào một tin nhắn ảnh trước đó
 *    - Ảnh gửi rời ngay trước khi gõ lệnh (lưu tạm trong 5 phút)
 * 2. Tải ảnh từ Telegram lên thư mục "SuperFinanceBot_Bills" trên Google Drive
 *    và trả về đường dẫn (Link) xem ảnh trực tiếp.
 * ============================================================
 */

var BILL_FOLDER_NAME = "SuperFinanceBot_Bills";

/**
 * Trích xuất file_id của ảnh từ một đối tượng message của Telegram
 * @param {object} msg
 * @returns {string}
 */
function extractPhotoFileIdFromMsg(msg) {
  if (!msg) return "";

  // 1. Nếu gửi dạng Photo nén chuẩn của Telegram (lấy phần tử cuối có độ phân giải cao nhất)
  if (msg.photo && msg.photo.length > 0) {
    return msg.photo[msg.photo.length - 1].file_id || "";
  }

  // 2. Nếu gửi dạng File gốc (Document có mime_type là image/*)
  if (
    msg.document &&
    msg.document.mime_type &&
    String(msg.document.mime_type).indexOf("image/") === 0
  ) {
    return msg.document.file_id || "";
  }

  return "";
}

/**
 * Lưu tạm file_id ảnh khi người dùng gửi ảnh trước rồi mới gõ lệnh /c ở tin nhắn kế tiếp
 * @param {object} message
 */
function savePendingPhotoFromMessage(message) {
  if (!message || !message.chat) return;
  var fileId = extractPhotoFileIdFromMsg(message);
  if (!fileId) return;

  var chatId = String(message.chat.id);
  var key = "PENDING_PHOTO_" + chatId;

  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      CacheService.getScriptCache().put(key, fileId, 300); // Lưu trong 5 phút (300s)
    }
  } catch (e) {}

  setProperty(key, fileId + "|" + Date.now());
  Logger.log("📸 [DriveService] Đã lưu tạm ảnh chờ gắn vào giao dịch tiếp theo cho chat " + chatId);
}

/**
 * Lấy và xóa file_id ảnh đang chờ của chatId (nếu còn hạn trong vòng 5 phút)
 * @param {string|number} chatId
 * @returns {string}
 */
function consumePendingPhotoFileId(chatId) {
  var key = "PENDING_PHOTO_" + String(chatId);
  var fileId = "";

  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      var cached = CacheService.getScriptCache().get(key);
      if (cached) {
        CacheService.getScriptCache().remove(key);
        fileId = cached;
      }
    }
  } catch (e) {}

  var propVal = getProperty(key);
  if (propVal) {
    try {
      if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
        PropertiesService.getScriptProperties().deleteProperty(key);
      }
    } catch (e2) {}

    if (!fileId) {
      var parts = String(propVal).split("|");
      var savedFileId = parts[0];
      var savedTime = Number(parts[1]) || 0;
      if (savedFileId && Date.now() - savedTime <= 300000) {
        fileId = savedFileId;
      }
    }
  }

  return fileId;
}

/**
 * Tìm file_id ảnh từ tin nhắn hiện tại, tin nhắn được Reply, hoặc ảnh vừa gửi trước đó
 * @param {object} message
 * @returns {string}
 */
function resolveBillPhotoFileId(message) {
  if (!message) return "";

  // Cách 1: Ảnh đính kèm trực tiếp cùng caption lệnh
  var directId = extractPhotoFileIdFromMsg(message);
  if (directId) {
    // Xóa ảnh chờ cũ nếu có để không bị trùng
    consumePendingPhotoFileId(message.chat ? message.chat.id : "");
    return directId;
  }

  // Cách 2: Người dùng Reply lệnh /c vào một bức ảnh đã gửi trước đó
  if (message.reply_to_message) {
    var replyPhotoId = extractPhotoFileIdFromMsg(message.reply_to_message);
    if (replyPhotoId) {
      consumePendingPhotoFileId(message.chat ? message.chat.id : "");
      return replyPhotoId;
    }
  }

  // Cách 3: Người dùng vừa gửi ảnh ở tin nhắn ngay trước đó (trong vòng 5 phút) rồi mới gõ lệnh /c
  if (message.chat && message.chat.id) {
    var pendingId = consumePendingPhotoFileId(message.chat.id);
    if (pendingId) {
      return pendingId;
    }
  }

  return "";
}

/**
 * Lấy hoặc khởi tạo thư mục lưu trữ hóa đơn trên Google Drive
 * @returns {Folder|null}
 */
function getOrCreateBillFolder() {
  if (typeof DriveApp === "undefined") {
    return null;
  }
  var folders = DriveApp.getFoldersByName(BILL_FOLDER_NAME);
  if (folders && folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(BILL_FOLDER_NAME);
}

/**
 * Kiểm tra trạng thái cấp quyền DriveApp trên Google Apps Script
 * @returns {object} { authorized, message }
 */
function checkDrivePermissionStatus() {
  if (typeof DriveApp === "undefined") {
    return { authorized: true, message: "local_simulated" };
  }
  try {
    var rootName = DriveApp.getRootFolder().getName();
    return { authorized: true, message: "OK (" + rootName + ")" };
  } catch (err) {
    return { authorized: false, message: err.message };
  }
}

/**
 * Tải ảnh Bill từ tin nhắn Telegram và lưu lên Google Drive
 * @param {object} message - Đối tượng message từ Telegram
 * @param {string} bank - Tên ngân hàng giao dịch
 * @param {string} tag - Tag giao dịch
 * @returns {object} { hasPhoto: boolean, billUrl: string, error: string }
 */
function uploadBillPhotoFromMessage(message, bank, tag) {
  var fileId = resolveBillPhotoFileId(message);
  if (!fileId) {
    return { hasPhoto: false, billUrl: "", error: "" };
  }

  var token = getBotToken();
  var fileInfoRes = callTelegramApi("getFile", { file_id: fileId });
  if (!fileInfoRes || !fileInfoRes.ok || !fileInfoRes.result || !fileInfoRes.result.file_path) {
    var tgErr = (fileInfoRes && fileInfoRes.description) || "Không lấy được file_path từ Telegram";
    Logger.log("⚠️ [DriveService] Lỗi getFile: " + tgErr);
    return { hasPhoto: true, billUrl: "", error: tgErr };
  }

  var filePath = fileInfoRes.result.file_path;
  var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;

  var timeStamp =
    typeof Utilities !== "undefined" && Utilities.formatDate
      ? Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss")
      : String(Date.now());
  var cleanTag = String(tag || "CHUNG").replace(/[^A-Z0-9_]/gi, "");
  var cleanBank = String(bank || "Chung").replace(/[^A-Z0-9_]/gi, "");
  var fileName = "BILL_" + timeStamp + "_" + cleanBank + "_" + cleanTag + ".jpg";

  // Nếu chạy trên môi trường Local Dev không có DriveApp thật
  if (typeof DriveApp === "undefined") {
    Logger.log("ℹ️ [DriveService - Local] Giả lập tải ảnh Bill lên Drive: " + fileName);
    return {
      hasPhoto: true,
      billUrl: "https://drive.google.com/file/d/LOCAL_SIMULATED_BILL_" + timeStamp + "/view",
      error: ""
    };
  }

  try {
    var imgResponse = UrlFetchApp.fetch(downloadUrl, { muteHttpExceptions: true });
    if (imgResponse.getResponseCode() !== 200) {
      return {
        hasPhoto: true,
        billUrl: downloadUrl,
        error: "Không tải được ảnh từ Telegram (HTTP " + imgResponse.getResponseCode() + ")"
      };
    }

    var blob = imgResponse.getBlob().setName(fileName);
    var folder = getOrCreateBillFolder();
    var createdFile = folder ? folder.createFile(blob) : DriveApp.createFile(blob);

    try {
      createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("ℹ️ [DriveService] Giữ quyền xem mặc định cho chủ Drive: " + shareErr.message);
    }

    var fileUrl = createdFile.getUrl();
    Logger.log("✅ [DriveService] Đã lưu ảnh Bill lên Drive: " + fileUrl);
    return {
      hasPhoto: true,
      billUrl: fileUrl,
      error: ""
    };
  } catch (err) {
    Logger.log("❌ [DriveService] Lỗi lưu ảnh lên Google Drive: " + err.message);
    logToSheet("DriveService", "Upload Bill Error", err.message);
    // Fallback trả về link ảnh trực tiếp và báo nguyên nhân lỗi quyền Drive (nếu có)
    return {
      hasPhoto: true,
      billUrl: downloadUrl,
      error: err.message
    };
  }
}

/**
 * Tải ảnh Bill định dạng Base64 từ giao diện Web App ("Open UI Mode") lên Google Drive
 * @param {string} base64Data - Chuỗi Base64 (có thể kèm prefix data:image/...;base64, hoặc không)
 * @param {string} mimeType - Kiểu MIME (VD: "image/jpeg" hoặc "image/png")
 * @param {string} bank - Tên ngân hàng giao dịch
 * @param {string} tag - Tag giao dịch
 * @returns {object} { hasPhoto: boolean, billUrl: string, error: string }
 */
function uploadBase64BillToDrive(base64Data, mimeType, bank, tag) {
  if (!base64Data) {
    return { hasPhoto: false, billUrl: "", error: "" };
  }

  var rawBase64 = String(base64Data).trim();
  var commaIdx = rawBase64.indexOf(",");
  if (commaIdx > -1) {
    rawBase64 = rawBase64.substring(commaIdx + 1);
  }

  var timeStamp =
    typeof Utilities !== "undefined" && Utilities.formatDate
      ? Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss")
      : String(Date.now());
  var cleanTag = String(tag || "CHUNG").replace(/[^A-Z0-9_]/gi, "");
  var cleanBank = String(bank || "Chung").replace(/[^A-Z0-9_]/gi, "");
  var ext = mimeType && String(mimeType).indexOf("png") > -1 ? ".png" : ".jpg";
  var fileName = "BILL_UI_" + timeStamp + "_" + cleanBank + "_" + cleanTag + ext;

  // Nếu chạy trên môi trường Local Dev không có DriveApp thật
  if (typeof DriveApp === "undefined" || typeof Utilities === "undefined" || !Utilities.base64Decode) {
    Logger.log("[DriveService - Local] Giả lập lưu ảnh Base64 từ UI lên Drive: " + fileName);
    return {
      hasPhoto: true,
      billUrl: "https://drive.google.com/file/d/LOCAL_UI_BILL_" + timeStamp + "/view",
      error: ""
    };
  }

  try {
    var decodedBytes = Utilities.base64Decode(rawBase64);
    var finalMime = mimeType || "image/jpeg";
    var blob = Utilities.newBlob(decodedBytes, finalMime, fileName);
    var folder = getOrCreateBillFolder();
    var createdFile = folder ? folder.createFile(blob) : DriveApp.createFile(blob);

    try {
      createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("[DriveService] Giữ quyền xem mặc định cho chủ Drive: " + shareErr.message);
    }

    var fileUrl = createdFile.getUrl();
    Logger.log("[DriveService] Đã lưu ảnh Bill từ Open UI Mode lên Drive: " + fileUrl);
    return {
      hasPhoto: true,
      billUrl: fileUrl,
      error: ""
    };
  } catch (err) {
    Logger.log("[DriveService] Lỗi lưu ảnh Base64 lên Google Drive: " + err.message);
    logToSheet("DriveService", "Upload UI Bill Error", err.message);
    return {
      hasPhoto: true,
      billUrl: "",
      error: err.message
    };
  }
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.extractPhotoFileIdFromMsg = extractPhotoFileIdFromMsg;
  global.savePendingPhotoFromMessage = savePendingPhotoFromMessage;
  global.consumePendingPhotoFileId = consumePendingPhotoFileId;
  global.resolveBillPhotoFileId = resolveBillPhotoFileId;
  global.getOrCreateBillFolder = getOrCreateBillFolder;
  global.checkDrivePermissionStatus = checkDrivePermissionStatus;
  global.uploadBillPhotoFromMessage = uploadBillPhotoFromMessage;
  global.uploadBase64BillToDrive = uploadBase64BillToDrive;

  module.exports = {
    extractPhotoFileIdFromMsg: extractPhotoFileIdFromMsg,
    savePendingPhotoFromMessage: savePendingPhotoFromMessage,
    consumePendingPhotoFileId: consumePendingPhotoFileId,
    resolveBillPhotoFileId: resolveBillPhotoFileId,
    getOrCreateBillFolder: getOrCreateBillFolder,
    checkDrivePermissionStatus: checkDrivePermissionStatus,
    uploadBillPhotoFromMessage: uploadBillPhotoFromMessage,
    uploadBase64BillToDrive: uploadBase64BillToDrive
  };
}


// ============================================================================
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


// ============================================================================
// financeService.js //
/**
 * ============================================================
 * MODULE: FINANCE SERVICE (SRP)
 * Chuyên trách toàn bộ nghiệp vụ Quản lý Thu Chi:
 * - /c (Quỹ Cá Nhân), /lcb (Quỹ Phụ), /clcb (Đồng thời cả 2 quỹ)
 * - /undo (Hoàn tác giao dịch bằng lệnh hoặc nút Inline)
 * - /sodu, /balance (Bảng cân đối theo Ngân hàng & #Tag)
 * - /ls, /history (Lịch sử 5 giao dịch gần nhất kèm link Bill)
 * - /limit (Đặt & kiểm tra hạn mức chi tiêu theo #Tag)
 * - /chotso, /renew (Chốt sổ cuối kỳ sang bảng Lịch Sử, giữ số dư đầu kỳ)
 * - /reset (Chuyển toàn bộ giao dịch về bảng Lịch Sử Chốt Sổ, đưa số dư về 0)
 * ============================================================
 */

/**
 * Sinh mã giao dịch duy nhất (VD: TX849201)
 * @returns {string}
 */
function generateTxId() {
  var rand = Math.floor(100000 + Math.random() * 900000);
  return "TX" + rand;
}

/**
 * Tính toán thống kê tổng hợp từ danh sách dòng giao dịch của một bảng
 * @param {Array<object>} rows
 * @returns {object} { totalBalance, byBank, byTag, spentByTag }
 */
function calculateSheetStats(rows) {
  var totalBalance = 0;
  var byBank = {};
  var byTag = {};
  var spentByTag = {}; // Tổng số tiền đã CHI (số dương) của từng #Tag để so với Hạn mức

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var amt = Number(r.amount) || 0;
    var bankKey = String(r.bank || "Chung").trim();
    var tagKey = normalizeTag(r.tag || "#CHUNG");

    totalBalance += amt;
    byBank[bankKey] = (byBank[bankKey] || 0) + amt;
    byTag[tagKey] = (byTag[tagKey] || 0) + amt;

    if (amt < 0 && r.note !== "Số dư đầu kỳ") {
      spentByTag[tagKey] = (spentByTag[tagKey] || 0) + Math.abs(amt);
    }
  }

  return {
    totalBalance: totalBalance,
    byBank: byBank,
    byTag: byTag,
    spentByTag: spentByTag
  };
}

/**
 * Tạo dòng thông báo kiểm tra Hạn mức (/limit) cho một #Tag (Tối giản, dịu mắt cho Z Fold)
 * @param {string} tag
 * @param {number} spentAmount
 * @returns {string}
 */
function buildLimitAlertText(tag, spentAmount) {
  var limitsMap = getAllTagLimits();
  var normTag = normalizeTag(tag);
  var limitVal = limitsMap[normTag];
  if (!limitVal || limitVal <= 0) {
    return "";
  }

  var spent = Number(spentAmount) || 0;
  var percent = Math.round((spent / limitVal) * 100);
  var remain = limitVal - spent;

  var statusLabel = "An toàn";
  if (percent >= 100) {
    statusLabel = "Vượt hạn mức";
  } else if (percent >= 80) {
    statusLabel = "Sắp chạm trần";
  }

  return (
    "<blockquote>" +
    "🎯 <b>Hạn mức <code>" +
    escapeHtml(normTag) +
    "</code>:</b> " +
    escapeHtml(formatCurrency(limitVal, false)) +
    "\n\n" +
    "• Đã chi: " +
    escapeHtml(formatCurrency(spent, false)) +
    " (" +
    percent +
    "%)\n\n" +
    "• Còn lại: <b>" +
    escapeHtml(formatCurrency(remain, false)) +
    "</b> <i>(" +
    statusLabel +
    ")</i>" +
    "</blockquote>"
  );
}

/**
 * Ghi nhận giao dịch mới cho /c, /lcb hoặc /clcb
 * Giao diện tối ưu cho màn hình hẹp Samsung Galaxy Z Fold (cách 1 dòng trắng giữa mỗi dòng)
 * @param {string} mode - "c" | "lcb" | "clcb"
 * @param {object} parsedTx - Kết quả từ parseTransactionArgs()
 * @param {string} userLabel - Tên & ID người nhập
 * @param {object|string} billInfo - { hasPhoto, billUrl, error } hoặc chuỗi billUrl
 * @returns {object} { text, replyMarkup }
 */
function executeFinanceTransaction(mode, parsedTx, userLabel, billInfo) {
  var txId = generateTxId();
  var nowStr = getNowFormatted();

  var billUrl = "";
  var billError = "";
  var hasPhoto = false;

  if (typeof billInfo === "string") {
    billUrl = billInfo;
    hasPhoto = Boolean(billInfo);
  } else if (billInfo && typeof billInfo === "object") {
    billUrl = billInfo.billUrl || "";
    billError = billInfo.error || "";
    hasPhoto = Boolean(billInfo.hasPhoto);
  }

  var txRecord = {
    txId: txId,
    time: nowStr,
    user: userLabel,
    bank: parsedTx.bank,
    tag: parsedTx.tag,
    rawAmount: parsedTx.rawAmount,
    amount: parsedTx.amount,
    note: parsedTx.note,
    billUrl: billUrl
  };

  var isIncome = parsedTx.amount >= 0;
  var amountFormatted = formatCurrency(parsedTx.amount, true);
  var flowLine = isIncome
    ? "🟢 <b>Thu vào:</b> <code>" + escapeHtml(amountFormatted) + "</code>"
    : "🔴 <b>Chi ra:</b> <code>" + escapeHtml(amountFormatted) + "</code>";

  var titleHeader = "";
  var balanceQuote = "";
  var limitSection = "";

  if (mode === "c") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));

    titleHeader = "✅ <b>GHI NHẬN GIAO DỊCH (/c)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code>: <b>" +
      escapeHtml(formatCurrency(cStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư " +
      escapeHtml(parsedTx.bank) +
      ": <b>" +
      escapeHtml(formatCurrency(cStats.byBank[parsedTx.bank] || 0, false)) +
      "</b>\n\n" +
      "💎 <b>Tổng Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(cStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, cStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "lcb") {
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);
    var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "✅ <b>GHI NHẬN GIAO DỊCH (/lcb)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code>: <b>" +
      escapeHtml(formatCurrency(lcbStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư " +
      escapeHtml(parsedTx.bank) +
      ": <b>" +
      escapeHtml(formatCurrency(lcbStats.byBank[parsedTx.bank] || 0, false)) +
      "</b>\n\n" +
      "💎 <b>Tổng Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(lcbStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, lcbStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "clcb") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);

    var bothPersonalStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
    var bothSubStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "✅ <b>GHI ĐỒNG THỜI 2 QUỸ (/clcb)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code> (/c): <b>" +
      escapeHtml(formatCurrency(bothPersonalStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code> (/lcb): <b>" +
      escapeHtml(formatCurrency(bothSubStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "📘 <b>Tổng Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(bothPersonalStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Tổng Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(bothSubStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, bothPersonalStats.spentByTag[parsedTx.tag] || 0);
  }

  // Mỗi dòng phản hồi cách nhau 1 dòng trắng (\n\n) để thoáng mắt trên Samsung Z Fold
  var messageBlocks = [
    titleHeader,
    flowLine,
    "🧮 <b>Phép tính:</b> <code>" + escapeHtml(String(parsedTx.rawAmount || parsedTx.amount)) + "</code>",
    "🏦 <b>Ngân hàng:</b> " + escapeHtml(parsedTx.bank),
    "🏷️ <b>Phân loại:</b> <code>" + escapeHtml(parsedTx.tag) + "</code>",
    "📝 <b>Ghi chú:</b> " + escapeHtml(parsedTx.note),
    "🆔 <b>Mã GD:</b> <code>" + escapeHtml(txId) + "</code>",
    balanceQuote
  ];

  if (limitSection) {
    messageBlocks.push(limitSection);
  }

  // Tách riêng mục Ảnh Hóa Đơn (Bill) và Mở bảng Google Sheets cách nhau 1 dòng trắng
  if (billUrl) {
    var linkLabel =
      billUrl.indexOf("drive.google.com") > -1
        ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
        : "🖼 Mở xem file ảnh hóa đơn (Bill)";
    messageBlocks.push(
      "📸 <b>ẢNH HÓA ĐƠN (BILL):</b>\n<a href=\"" + escapeHtml(billUrl) + "\">" + linkLabel + "</a>"
    );
  }

  if (hasPhoto && billError) {
    messageBlocks.push(
      "⚠️ <i>Lưu ý Google Drive: " +
        escapeHtml(billError) +
        " (Mở GAS Editor -> Chọn hàm ActivateBot hoặc GrantAllPermissions -> Bấm Run để cấp quyền Drive).</i>"
    );
  }

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    messageBlocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  var replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "↩️ Hoàn tác giao dịch (" + txId + ")",
          callback_data: "undo_tx:" + mode + ":" + txId
        }
      ]
    ]
  };

  return {
    text: messageBlocks.join("\n\n"),
    replyMarkup: replyMarkup
  };
}

/**
 * Hoàn tác (Undo) giao dịch gần nhất hoặc theo Mã GD cụ thể
 * @param {string} [targetMode] - "c" | "lcb" | "clcb"
 * @param {string} [specificTxId] - Mã GD cụ thể khi bấm nút Inline
 * @returns {string} Nội dung thông báo kết quả
 */
function executeUndoTransaction(targetMode, specificTxId) {
  var mode = String(targetMode || "c").trim().toLowerCase();
  var deletedPersonal = null;
  var deletedSub = null;

  if (specificTxId) {
    if (mode === "c" || mode === "clcb") {
      deletedPersonal = deleteTransactionByTxId(SHEET_NAMES.PERSONAL, specificTxId);
    }
    if (mode === "lcb" || mode === "clcb") {
      deletedSub = deleteTransactionByTxId(SHEET_NAMES.SUB_FUND, specificTxId);
    }
  } else {
    if (mode === "lcb") {
      deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
    } else if (mode === "clcb") {
      deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
      deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
    } else {
      var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
      var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);
      var lastP = pRows.length > 0 ? pRows[pRows.length - 1] : null;
      var lastS = sRows.length > 0 ? sRows[sRows.length - 1] : null;

      if (lastP && lastS && lastP.txId && lastP.txId === lastS.txId) {
        deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
        deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
        mode = "clcb";
      } else if (lastP) {
        deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
        mode = "c";
      } else if (lastS) {
        deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
        mode = "lcb";
      }
    }
  }

  var sample = deletedPersonal || deletedSub;
  if (!sample) {
    return "⚠️ <b>KHÔNG TÌM THẤY GIAO DỊCH ĐỂ HOÀN TÁC</b>\n\nGiao dịch này đã được xóa trước đó hoặc bảng đang trống.";
  }

  var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

  var scopeName =
    deletedPersonal && deletedSub
      ? "Cả 2 Quỹ (/clcb)"
      : deletedPersonal
      ? "Quỹ Cá Nhân (/c)"
      : "Quỹ Phụ (/lcb)";

  var blocks = [
    "↩️ <b>ĐÃ HOÀN TÁC GIAO DỊCH</b>",
    "🆔 <b>Mã GD xóa:</b> <code>" + escapeHtml(sample.txId || "N/A") + "</code>",
    "📂 <b>Phạm vi:</b> " + escapeHtml(scopeName),
    "🏦 <b>Ngân hàng:</b> " + escapeHtml(sample.bank) + "  •  <code>" + escapeHtml(sample.tag) + "</code>",
    "💰 <b>Số tiền xóa:</b> <code>" + escapeHtml(formatCurrency(sample.amount, true)) + "</code>",
    "📝 <b>Ghi chú:</b> " + escapeHtml(sample.note),
    "<blockquote>" +
      "💎 <b>SỐ DƯ CẬP NHẬT</b>\n\n" +
      "📘 <b>Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(cStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(lcbStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Tạo báo cáo Số dư tổng hợp (/sodu hoặc /balance)
 * Tối ưu hiển thị thoáng dòng cho Samsung Galaxy Z Fold
 * @returns {string}
 */
function buildBalanceReport() {
  var personalRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var subRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(personalRows);
  var sStats = calculateSheetStats(subRows);
  var limitsMap = getAllTagLimits();

  var overviewBlock =
    "<blockquote>" +
    "💰 <b>1. TỔNG QUAN HAI QUỸ</b>\n\n" +
    "📘 <b>Quỹ Cá Nhân (/c):</b> <code>" +
    escapeHtml(formatCurrency(pStats.totalBalance, false)) +
    "</code>\n\n" +
    "📙 <b>Quỹ Phụ (/lcb):</b> <code>" +
    escapeHtml(formatCurrency(sStats.totalBalance, false)) +
    "</code>" +
    "</blockquote>";

  var bankLines = ["🏦 <b>2. THEO NGÂN HÀNG (QUỸ CÁ NHÂN)</b>"];
  var bankKeys = Object.keys(pStats.byBank);
  if (bankKeys.length === 0) {
    bankLines.push("• <b>Mặc định:</b> 0 đ");
  } else {
    for (var i = 0; i < bankKeys.length; i++) {
      var bName = bankKeys[i];
      bankLines.push(
        "• <b>" +
          escapeHtml(bName) +
          ":</b> " +
          escapeHtml(formatCurrency(pStats.byBank[bName], false))
      );
    }
  }
  var bankBlock = "<blockquote>" + bankLines.join("\n\n") + "</blockquote>";

  var tagLines = ["🏷️ <b>3. THEO PHÂN LOẠI (#TAG)</b>"];
  var tagKeys = Object.keys(pStats.byTag);
  if (tagKeys.length === 0) {
    tagLines.push("• <b>Mặc định:</b> 0 đ");
  } else {
    for (var j = 0; j < tagKeys.length; j++) {
      var tName = tagKeys[j];
      var tBal = formatCurrency(pStats.byTag[tName], false);
      var lineStr = "• <code>" + escapeHtml(tName) + "</code>: <b>" + escapeHtml(tBal) + "</b>";
      if (limitsMap[tName]) {
        var spent = pStats.spentByTag[tName] || 0;
        var remain = limitsMap[tName] - spent;
        lineStr +=
          "\n  <i>(Hạn mức còn: " + escapeHtml(formatCurrency(remain, false)) + ")</i>";
      }
      tagLines.push(lineStr);
    }
  }
  var tagBlock = "<blockquote>" + tagLines.join("\n\n") + "</blockquote>";

  var parts = [
    "📊 <b>BÁO CÁO SỐ DƯ TÀI CHÍNH</b>",
    overviewBlock,
    bankBlock,
    tagBlock
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    parts.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return parts.join("\n\n");
}

/**
 * Xem lại 5 giao dịch gần nhất (/ls hoặc /history)
 * Tối ưu hiển thị thoáng dòng cho Samsung Galaxy Z Fold
 * @param {number} [limitCount=5]
 * @returns {string}
 */
function buildRecentHistoryReport(limitCount) {
  var count = limitCount || 5;
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var recentP = pRows.slice(-count).reverse();
  var recentS = sRows.slice(-count).reverse();

  var parts = ["📜 <b>" + count + " GIAO DỊCH GẦN NHẤT</b>"];

  parts.push("📘 <b>1. QUỸ CÁ NHÂN (/c)</b>");
  if (recentP.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var i = 0; i < recentP.length; i++) {
      var item = recentP[i];
      var iconP = Number(item.amount) >= 0 ? "🟢" : "🔴";
      var linesP = [
        iconP +
          " <b><code>" +
          escapeHtml(formatCurrency(item.amount, true)) +
          "</code></b>  •  <code>" +
          escapeHtml(item.tag) +
          "</code>",
        "🏦 " + escapeHtml(item.bank) + "  •  🕒 " + escapeHtml(item.time),
        "📝 " + escapeHtml(item.note)
      ];
      if (item.billUrl) {
        var billLabelP =
          item.billUrl.indexOf("drive.google.com") > -1
            ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
            : "🖼 Mở xem ảnh hóa đơn (Bill)";
        linesP.push("<a href=\"" + escapeHtml(item.billUrl) + "\">" + billLabelP + "</a>");
      }
      parts.push("<blockquote>" + linesP.join("\n\n") + "</blockquote>");
    }
  }

  parts.push("📙 <b>2. QUỸ PHỤ (/lcb)</b>");
  if (recentS.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var j = 0; j < recentS.length; j++) {
      var sItem = recentS[j];
      var iconS = Number(sItem.amount) >= 0 ? "🟢" : "🔴";
      var linesS = [
        iconS +
          " <b><code>" +
          escapeHtml(formatCurrency(sItem.amount, true)) +
          "</code></b>  •  <code>" +
          escapeHtml(sItem.tag) +
          "</code>",
        "🏦 " + escapeHtml(sItem.bank) + "  •  🕒 " + escapeHtml(sItem.time),
        "📝 " + escapeHtml(sItem.note)
      ];
      if (sItem.billUrl) {
        var billLabelS =
          sItem.billUrl.indexOf("drive.google.com") > -1
            ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
            : "🖼 Mở xem ảnh hóa đơn (Bill)";
        linesS.push("<a href=\"" + escapeHtml(sItem.billUrl) + "\">" + billLabelS + "</a>");
      }
      parts.push("<blockquote>" + linesS.join("\n\n") + "</blockquote>");
    }
  }

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    parts.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return parts.join("\n\n");
}

/**
 * Xử lý đặt hạn mức chi tiêu cho một #Tag (/limit #TRADA 200k)
 * @param {string} argsText
 * @param {string} userLabel
 * @returns {string}
 */
function handleSetLimitCommand(argsText, userLabel) {
  var parsed = parseLimitArgs(argsText);
  if (!parsed.valid) {
    return "⚠️ <b>CÚ PHÁP HẠN MỨC CHƯA ĐÚNG</b>\n\n" + parsed.error;
  }

  upsertTagLimit(parsed.tag, parsed.limitAmount, userLabel);

  var pStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var currentSpent = pStats.spentByTag[parsed.tag] || 0;
  var percent = Math.round((currentSpent / parsed.limitAmount) * 100);
  var remain = parsed.limitAmount - currentSpent;

  var blocks = [
    "🎯 <b>ĐÃ CẬP NHẬT HẠN MỨC CHI TIÊU (/limit)</b>",
    "🏷️ <b>Phân loại:</b> <code>" + escapeHtml(parsed.tag) + "</code>",
    "💰 <b>Hạn mức mới:</b> <code>" + escapeHtml(formatCurrency(parsed.limitAmount, false)) + "</code>",
    "<blockquote>" +
      "• Đã chi kỳ này: " +
      escapeHtml(formatCurrency(currentSpent, false)) +
      " (" +
      percent +
      "%)\n\n" +
      "• Còn lại: <b>" +
      escapeHtml(formatCurrency(remain, false)) +
      "</b>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Tạo bản xem trước khi bấm /chotso hoặc /renew (kèm nút Inline xác nhận 2 bước)
 * @returns {object} { text, replyMarkup }
 */
function buildRenewPreview() {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var text = [
    "📅 <b>XÁC NHẬN CHỐT SỔ CUỐI KỲ (/chotso)</b>",
    "<blockquote>" +
      "📘 <b>Quỹ Cá Nhân (/c):</b> " +
      pRows.length +
      " giao dịch\n\n" +
      "👉 Số dư: <b><code>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</code></b>\n\n" +
      "📙 <b>Quỹ Phụ (/lcb):</b> " +
      sRows.length +
      " giao dịch\n\n" +
      "👉 Số dư: <b><code>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</code></b>" +
      "</blockquote>",
    "1️⃣ Toàn bộ các dòng giao dịch kỳ này sẽ được chuyển sang bảng <b>Lịch Sử Chốt Sổ</b>.",
    "2️⃣ Các dòng giao dịch lẻ được gom gọn thành dòng <b>Số dư đầu kỳ</b> mới cho từng Ngân hàng & #Tag.",
    "<i>(Nếu muốn lưu sổ và đưa toàn bộ số dư về 0, hãy dùng lệnh /reset)</i>"
  ].join("\n\n");

  var replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Xác nhận Chốt Sổ", callback_data: "confirm_renew:yes" },
        { text: "❌ Hủy bỏ", callback_data: "confirm_renew:no" }
      ]
    ]
  };

  return { text: text, replyMarkup: replyMarkup };
}

/**
 * Gom nhóm số dư theo cặp (Ngân hàng + #Tag) để tạo các dòng "Số dư đầu kỳ" mới sau khi chốt sổ
 * @param {Array<object>} rows
 * @param {string} userLabel
 * @returns {Array<object>}
 */
function buildOpeningBalanceRows(rows, userLabel) {
  var pairMap = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var bank = String(r.bank || "Chung").trim();
    var tag = normalizeTag(r.tag || "#CHUNG");
    var key = bank + "|||" + tag;
    pairMap[key] = (pairMap[key] || 0) + (Number(r.amount) || 0);
  }

  var nowStr = getNowFormatted();
  var openingList = [];
  var keys = Object.keys(pairMap);

  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    var bal = pairMap[k];
    if (bal !== 0) {
      var splitParts = k.split("|||");
      openingList.push({
        txId: generateTxId(),
        time: nowStr,
        user: userLabel,
        bank: splitParts[0],
        tag: splitParts[1],
        rawAmount: String(bal),
        amount: bal,
        note: "Số dư đầu kỳ",
        billUrl: ""
      });
    }
  }

  return openingList;
}

/**
 * Thực thi Chốt sổ cuối kỳ (/chotso, /renew) - Chuyển toàn bộ giao dịch cũ sang Lịch Sử Chốt Sổ và giữ lại Số dư đầu kỳ
 * @param {string} userLabel
 * @returns {string}
 */
function executeRenewPeriod(userLabel) {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var nowStr = getNowFormatted();
  var archivedCount = archiveTransactionsToHistorySheet(
    "CHOT SO " + nowStr,
    userLabel,
    pRows,
    sRows,
    pStats.totalBalance,
    sStats.totalBalance
  );

  var newPersonalOpening = buildOpeningBalanceRows(pRows, userLabel);
  var newSubOpening = buildOpeningBalanceRows(sRows, userLabel);

  resetSheetWithOpeningBalances(SHEET_NAMES.PERSONAL, newPersonalOpening);
  resetSheetWithOpeningBalances(SHEET_NAMES.SUB_FUND, newSubOpening);

  var blocks = [
    "✅ <b>ĐÃ CHỐT SỔ SANG KỲ MỚI THÀNH CÔNG</b>",
    "🕒 <b>Thời gian:</b> " + escapeHtml(nowStr),
    "📦 <b>Đã chuyển sổ:</b> <b>" + archivedCount + " dòng giao dịch</b> sang bảng <b>Lịch Sử Chốt Sổ</b>",
    "<blockquote>" +
      "🌱 <b>SỐ DƯ ĐẦU KỲ MỚI</b>\n\n" +
      "📘 <b>Quỹ Cá Nhân (/c):</b> <code>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Quỹ Phụ (/lcb):</b> <code>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Thực thi lệnh /reset:
 * - Di chuyển nguyên vẹn toàn bộ từng dòng giao dịch hiện tại của cả 2 bảng ("Thu Chi" và "Quỹ Phụ")
 *   sang nối tiếp tại bảng "Lịch Sử Chốt Sổ" (liên thông tất cả các tháng cũ với nhau, không mất bất kỳ giao dịch nào).
 * - Làm trống bảng hiện tại để đưa số dư của tất cả các mục về 0 đ bắt đầu kỳ mới.
 * @param {string} userLabel
 * @returns {string}
 */
function executeResetAllToZero(userLabel) {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var nowStr = getNowFormatted();
  var archivedCount = archiveTransactionsToHistorySheet(
    "RESET " + nowStr,
    userLabel,
    pRows,
    sRows,
    pStats.totalBalance,
    sStats.totalBalance
  );

  resetSheetWithOpeningBalances(SHEET_NAMES.PERSONAL, []);
  resetSheetWithOpeningBalances(SHEET_NAMES.SUB_FUND, []);

  var blocks = [
    "🧹 <b>ĐÃ LƯU SỔ LIÊN THÔNG & RESET SỐ DƯ VỀ 0 (/reset)</b>",
    "🕒 <b>Thời gian:</b> " + escapeHtml(nowStr),
    "📦 <b>Giao dịch lưu trữ:</b> <b>" +
      archivedCount +
      " dòng</b> (" +
      pRows.length +
      " /c, " +
      sRows.length +
      " /lcb)",
    "<blockquote>" +
      "📂 <b>SỐ DƯ CŨ ĐÃ LƯU LỊCH SỬ</b>\n\n" +
      "• Dư cũ (/c): <b>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</b>\n\n" +
      "• Dư cũ (/lcb): <b>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</b>\n\n" +
      "✨ <b>SỐ DƯ KỲ MỚI HIỆN TẠI</b>\n\n" +
      "• Tất cả Ngân hàng & #Tag: <code>0 đ</code>\n\n" +
      "• Quỹ Cá Nhân & Quỹ Phụ: <code>0 đ</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.generateTxId = generateTxId;
  global.calculateSheetStats = calculateSheetStats;
  global.buildLimitAlertText = buildLimitAlertText;
  global.executeFinanceTransaction = executeFinanceTransaction;
  global.executeUndoTransaction = executeUndoTransaction;
  global.buildBalanceReport = buildBalanceReport;
  global.buildRecentHistoryReport = buildRecentHistoryReport;
  global.handleSetLimitCommand = handleSetLimitCommand;
  global.buildRenewPreview = buildRenewPreview;
  global.executeRenewPeriod = executeRenewPeriod;
  global.executeResetAllToZero = executeResetAllToZero;

  module.exports = {
    generateTxId: generateTxId,
    calculateSheetStats: calculateSheetStats,
    buildLimitAlertText: buildLimitAlertText,
    executeFinanceTransaction: executeFinanceTransaction,
    executeUndoTransaction: executeUndoTransaction,
    buildBalanceReport: buildBalanceReport,
    buildRecentHistoryReport: buildRecentHistoryReport,
    handleSetLimitCommand: handleSetLimitCommand,
    buildRenewPreview: buildRenewPreview,
    executeRenewPeriod: executeRenewPeriod,
    executeResetAllToZero: executeResetAllToZero
  };
}


// ============================================================================
// uiController.js //
/**
 * ============================================================
 * MODULE: UI CONTROLLER (SRP / OCP)
 * Chuyên trách toàn bộ Giao diện Tương tác Đa tầng (Hybrid UI):
 * 1. Bàn phím cố định dưới đáy màn hình (Persistent Reply Keyboard)
 *    với nút "📱 Open UI Mode" mở trực tiếp Web App trong Telegram.
 * 2. Luồng chọn nút từng bước ngay trong Chat (In-Chat 4-Step Wizard)
 *    cho Ghi Thu/Chi, Đặt Hạn Mức và Chốt Sổ / Reset.
 * 3. Backend API phục vụ giao diện đồ họa "Open UI Mode" (3 Tab):
 *    - Đồng bộ danh sách Ngân hàng, #Tag, Số dư, Hạn mức, Lịch sử từ Google Sheets.
 *    - Nhận giao dịch kèm phép tính (+, -, *, /, ngoặc đơn) và Ảnh Bill Base64
 *      tải thẳng lên Google Drive ("SuperFinanceBot_Bills"), đồng thời gửi biên lai về Chat.
 * ============================================================
 */

var DEFAULT_UI_BANKS = ["Techcombank", "MB", "CASH", "Chung"];
var DEFAULT_UI_TAGS = ["#TRADA", "#ANUONG", "#LUONG", "#DIADIEM", "#CHUNG"];

/**
 * Xây dựng URL mở giao diện "Open UI Mode" kèm định danh người dùng
 * @param {string|number} userId
 * @returns {string}
 */
function getWebAppUiUrl(userId) {
  var baseUrl = String(getProperty("WEBAPP_URL") || "").trim();
  if (!baseUrl || baseUrl.indexOf("https://") !== 0) {
    return "";
  }
  var sep = baseUrl.indexOf("?") > -1 ? "&" : "?";
  return baseUrl + sep + "ui=1&uid=" + encodeURIComponent(String(userId || getAdminChatId()));
}

/**
 * Tạo cấu trúc Bàn phím cố định dưới đáy màn hình (Persistent Reply Keyboard)
 * Tối giản 3 nút cho màn hình Samsung Galaxy Z Fold:
 * 1. "📱 Mở App Thu Chi (UI Mode)" (Mở trực tiếp Telegram Mini App / Web App)
 * 2. "📊 Số Dư"
 * 3. "📜 Lịch sử" (Gọi 5 giao dịch gần nhất)
 * @param {string|number} userId
 * @returns {object} reply_markup
 */
function buildMainReplyKeyboard(userId) {
  var uiUrl = getWebAppUiUrl(userId);
  var openUiButton = uiUrl
    ? { text: "📱 Mở App Thu Chi (UI Mode)", web_app: { url: uiUrl } }
    : { text: "📱 Mở App Thu Chi (UI Mode)" };

  return {
    keyboard: [
      [openUiButton],
      [{ text: "📊 Số Dư" }, { text: "📜 Lịch sử" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

/**
 * Lưu trạng thái Wizard của từng người dùng trong 15 phút
 * @param {string|number} chatId
 * @param {object|null} stateObj
 */
function setWizardState(chatId, stateObj) {
  var key = "WIZARD_STATE_" + String(chatId);
  if (!stateObj) {
    try {
      if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
        CacheService.getScriptCache().remove(key);
      }
      if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
        PropertiesService.getScriptProperties().deleteProperty(key);
      }
    } catch (e) {}
    return;
  }

  var jsonStr = JSON.stringify(stateObj);
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      CacheService.getScriptCache().put(key, jsonStr, 900);
    }
  } catch (e2) {}
  setProperty(key, jsonStr);
}

/**
 * Đọc trạng thái Wizard hiện tại của người dùng
 * @param {string|number} chatId
 * @returns {object|null}
 */
function getWizardState(chatId) {
  var key = "WIZARD_STATE_" + String(chatId);
  var raw = "";
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      raw = CacheService.getScriptCache().get(key) || "";
    }
  } catch (e) {}

  if (!raw) {
    raw = getProperty(key) || "";
  }
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Lấy danh sách Ngân hàng và #Tag động từ Google Sheets + danh mục tùy chỉnh đã lưu
 * @returns {object} { banks: Array<string>, tags: Array<string> }
 */
function getDynamicBanksAndTags() {
  var banks = DEFAULT_UI_BANKS.slice();
  var tags = DEFAULT_UI_TAGS.slice();

  function addBankUnique(b) {
    var clean = String(b || "").trim();
    if (clean && banks.indexOf(clean) === -1) {
      banks.push(clean);
    }
  }

  function addTagUnique(t) {
    var clean = normalizeTag(t);
    if (clean && tags.indexOf(clean) === -1) {
      tags.push(clean);
    }
  }

  // Đọc từ ScriptProperties nếu người dùng từng thêm Ngân hàng / #Tag mới trên UI
  var savedBanks = String(getProperty("CUSTOM_UI_BANKS") || "").split(",");
  for (var sb = 0; sb < savedBanks.length; sb++) {
    if (savedBanks[sb].trim()) addBankUnique(savedBanks[sb].trim());
  }

  var savedTags = String(getProperty("CUSTOM_UI_TAGS") || "").split(",");
  for (var st = 0; st < savedTags.length; st++) {
    if (savedTags[st].trim()) addTagUnique(savedTags[st].trim());
  }

  // Đọc từ các giao dịch thực tế trong Google Sheets
  try {
    var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
    var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);
    var allRows = pRows.concat(sRows);
    for (var i = 0; i < allRows.length; i++) {
      addBankUnique(allRows[i].bank);
      addTagUnique(allRows[i].tag);
    }

    var limitsMap = getAllTagLimits();
    var limitKeys = Object.keys(limitsMap);
    for (var k = 0; k < limitKeys.length; k++) {
      addTagUnique(limitKeys[k]);
    }
  } catch (e) {}

  return {
    banks: banks,
    tags: tags
  };
}

/**
 * Lưu thêm Ngân hàng tùy chỉnh mới
 * @param {string} bankName
 */
function registerCustomBank(bankName) {
  var clean = String(bankName || "").trim().replace(/\s+/g, "_");
  if (!clean) return "Chung";
  var existing = String(getProperty("CUSTOM_UI_BANKS") || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (existing.indexOf(clean) === -1) {
    existing.push(clean);
    setProperty("CUSTOM_UI_BANKS", existing.join(","));
  }
  return clean;
}

/**
 * Lưu thêm #Tag tùy chỉnh mới
 * @param {string} tagName
 */
function registerCustomTag(tagName) {
  var clean = normalizeTag(tagName);
  var existing = String(getProperty("CUSTOM_UI_TAGS") || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (existing.indexOf(clean) === -1) {
    existing.push(clean);
    setProperty("CUSTOM_UI_TAGS", existing.join(","));
  }
  return clean;
}

/**
 * ============================================================
 * IN-CHAT 4-STEP WIZARD (CHỌN NÚT TỪNG BƯỚC TRONG CHAT)
 * ============================================================
 */

/**
 * BƯỚC 1: Chọn Quỹ và Chiều giao dịch (CHI / THU)
 * @param {string|number} chatId
 * @param {number} [messageId] - Nếu truyền vào sẽ sửa tin nhắn hiện tại thay vì gửi mới
 */
function sendWizardStep1(chatId, messageId) {
  setWizardState(chatId, {
    type: "tx",
    step: 1,
    fund: "c",
    sign: "-",
    bank: "Techcombank",
    tag: "#TRADA"
  });

  var text =
    "🧭 <b>GHI THU / CHI TỪNG BƯỚC (BƯỚC 1/4)</b>\n\n" +
    "Hãy chọn <b>Quỹ</b> và <b>Chiều giao dịch</b> bạn muốn ghi nhận:";

  var inlineKeyboard = [
    [
      { text: "🔴 CHI Quỹ Chung (/c -)", callback_data: "wiz_s1:c:-" },
      { text: "🟢 THU Quỹ Chung (/c +)", callback_data: "wiz_s1:c:+" }
    ],
    [
      { text: "🔴 CHI Quỹ Phụ (/lcb -)", callback_data: "wiz_s1:lcb:-" },
      { text: "🟢 THU Quỹ Phụ (/lcb +)", callback_data: "wiz_s1:lcb:+" }
    ],
    [
      { text: "🔴 CHI Cả 2 Quỹ (/clcb -)", callback_data: "wiz_s1:clcb:-" },
      { text: "🟢 THU Cả 2 Quỹ (/clcb +)", callback_data: "wiz_s1:clcb:+" }
    ],
    [{ text: "❌ Hủy thao tác", callback_data: "wiz_cancel" }]
  ];

  if (messageId) {
    return editMessageText(chatId, messageId, text, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }
  return safeSendMessage(chatId, text, {
    reply_markup: { inline_keyboard: inlineKeyboard }
  });
}

/**
 * BƯỚC 2: Chọn Ngân hàng / Nguồn tiền
 */
function sendWizardStep2(chatId, messageId, fund, sign) {
  var state = {
    type: "tx",
    step: 2,
    fund: fund || "c",
    sign: sign || "-",
    bank: "Chung",
    tag: "#CHUNG"
  };
  setWizardState(chatId, state);

  var meta = getDynamicBanksAndTags();
  var rows = [];
  var currentPair = [];

  for (var i = 0; i < meta.banks.length; i++) {
    var bName = meta.banks[i];
    var icon = bName.toUpperCase() === "CASH" ? "💵 " : "🏦 ";
    currentPair.push({
      text: icon + bName,
      callback_data: "wiz_s2:" + bName
    });
    if (currentPair.length === 2) {
      rows.push(currentPair);
      currentPair = [];
    }
  }
  if (currentPair.length > 0) {
    rows.push(currentPair);
  }

  rows.push([
    { text: "➕ Ngân hàng mới", callback_data: "wiz_new_bank" },
    { text: "⬅️ Quay lại Bước 1", callback_data: "wiz_back_1" }
  ]);
  rows.push([{ text: "❌ Hủy thao tác", callback_data: "wiz_cancel" }]);

  var dirLabel = state.sign === "-" ? "🔴 CHI RA (-)" : "🟢 THU VÀO (+)";
  var text =
    "🏦 <b>GHI THU / CHI TỪNG BƯỚC (BƯỚC 2/4)</b>\n\n" +
    "• Quỹ đã chọn: <code>/" +
    escapeHtml(state.fund) +
    "</code> (" +
    dirLabel +
    ")\n\n" +
    "Hãy chọn <b>Ngân hàng / Nguồn tiền</b>:";

  return editMessageText(chatId, messageId, text, {
    reply_markup: { inline_keyboard: rows }
  });
}

/**
 * BƯỚC 3: Chọn Phân loại (#Tag)
 */
function sendWizardStep3(chatId, messageId, bank) {
  var state = getWizardState(chatId) || {
    type: "tx",
    step: 3,
    fund: "c",
    sign: "-",
    bank: bank || "Chung",
    tag: "#CHUNG"
  };
  state.step = 3;
  state.bank = bank || state.bank || "Chung";
  setWizardState(chatId, state);

  var meta = getDynamicBanksAndTags();
  var rows = [];
  var currentPair = [];

  for (var i = 0; i < meta.tags.length; i++) {
    var tName = meta.tags[i];
    currentPair.push({
      text: "🏷️ " + tName,
      callback_data: "wiz_s3:" + tName
    });
    if (currentPair.length === 2) {
      rows.push(currentPair);
      currentPair = [];
    }
  }
  if (currentPair.length > 0) {
    rows.push(currentPair);
  }

  rows.push([
    { text: "➕ #Tag mới", callback_data: "wiz_new_tag" },
    { text: "⬅️ Quay lại Bước 2", callback_data: "wiz_s1:" + state.fund + ":" + state.sign }
  ]);
  rows.push([{ text: "❌ Hủy thao tác", callback_data: "wiz_cancel" }]);

  var dirLabel = state.sign === "-" ? "🔴 CHI RA (-)" : "🟢 THU VÀO (+)";
  var text =
    "🏷️ <b>GHI THU / CHI TỪNG BƯỚC (BƯỚC 3/4)</b>\n\n" +
    "• Quỹ: <code>/" +
    escapeHtml(state.fund) +
    "</code> (" +
    dirLabel +
    ")\n" +
    "• Ngân hàng: <b>🏦 " +
    escapeHtml(state.bank) +
    "</b>\n\n" +
    "Hãy chọn <b>Phân loại (#Tag)</b>:";

  return editMessageText(chatId, messageId, text, {
    reply_markup: { inline_keyboard: rows }
  });
}

/**
 * BƯỚC 4: Nhập Số tiền (hoặc phép tính + - * /) và Ghi chú / Ảnh Bill
 */
function sendWizardStep4(chatId, messageId, tag) {
  var state = getWizardState(chatId) || {
    type: "tx",
    step: 4,
    fund: "c",
    sign: "-",
    bank: "Chung",
    tag: tag || "#CHUNG"
  };
  state.step = 4;
  state.tag = normalizeTag(tag || state.tag || "#CHUNG");
  setWizardState(chatId, state);

  var dirLabel = state.sign === "-" ? "🔴 CHI RA (-)" : "🟢 THU VÀO (+)";
  var text = [
    "🧮 <b>GHI THU / CHI TỪNG BƯỚC (BƯỚC 4/4)</b>",
    "<blockquote>" +
      "• <b>Quỹ ghi chép:</b> <code>/" +
      escapeHtml(state.fund) +
      "</code> (" +
      dirLabel +
      ")\n\n" +
      "• <b>Ngân hàng:</b> " +
      escapeHtml(state.bank) +
      "\n\n" +
      "• <b>Phân loại:</b> <code>" +
      escapeHtml(state.tag) +
      "</code>" +
      "</blockquote>",
    "✍️ <b>Hãy gõ vào ô chat:</b> <code>&lt;Số tiền hoặc Phép tính&gt; [Ghi chú]</code>",
    "• Ví dụ 1: <code>55k mua trà đào</code>",
    "• Ví dụ 2 (Nhân/Chia/Cộng/Trừ): <code>(120k+30k)/3 ăn trưa chia 3</code>",
    "• 📸 Hoặc gửi <b>Ảnh Bill</b> kèm chú thích số tiền."
  ].join("\n\n");

  var rows = [
    [
      { text: "⬅️ Quay lại Bước 3", callback_data: "wiz_s2:" + state.bank },
      { text: "❌ Hủy thao tác", callback_data: "wiz_cancel" }
    ]
  ];

  return editMessageText(chatId, messageId, text, {
    reply_markup: { inline_keyboard: rows }
  });
}

/**
 * Mở bảng chọn #Tag để cài đặt Hạn mức nhanh trong Chat
 */
function sendLimitWizardMenu(chatId, messageId) {
  var meta = getDynamicBanksAndTags();
  var limitsMap = getAllTagLimits();
  var rows = [];
  var pair = [];

  for (var i = 0; i < meta.tags.length; i++) {
    var t = meta.tags[i];
    var limStr = limitsMap[t] ? " (" + Math.round(limitsMap[t] / 1000) + "k)" : "";
    pair.push({
      text: "🎯 " + t + limStr,
      callback_data: "wiz_lim_tag:" + t
    });
    if (pair.length === 2) {
      rows.push(pair);
      pair = [];
    }
  }
  if (pair.length > 0) rows.push(pair);
  rows.push([{ text: "❌ Hủy thao tác", callback_data: "wiz_cancel" }]);

  var text =
    "🎯 <b>CÀI ĐẶT HẠN MỨC CHI TIÊU (/limit)</b>\n\n" +
    "Chọn <b>#Tag</b> bạn muốn đặt hoặc cập nhật hạn mức chi tiêu tháng:";

  if (messageId) {
    return editMessageText(chatId, messageId, text, {
      reply_markup: { inline_keyboard: rows }
    });
  }
  return safeSendMessage(chatId, text, {
    reply_markup: { inline_keyboard: rows }
  });
}

/**
 * Mở bảng chọn Chốt Sổ (/chotso) hoặc Reset Về 0 (/reset) có xác nhận 2 bước
 */
function sendClosingMenu(chatId) {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);
  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var text = [
    "📅 <b>QUẢN TRỊ SỔ CUỐI KỲ (/chotso & /reset)</b>",
    "<blockquote>" +
      "📘 <b>Quỹ Cá Nhân (/c):</b> " +
      pRows.length +
      " dòng (<code>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</code>)\n\n" +
      "📙 <b>Quỹ Phụ (/lcb):</b> " +
      sRows.length +
      " dòng (<code>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</code>)" +
      "</blockquote>",
    "1️⃣ <b>Chốt Sổ Tháng Mới (/chotso):</b> Chuyển toàn bộ giao dịch hiện tại vào bảng <i>Lịch Sử Chốt Sổ</i>, giữ nguyên số dư hiện tại làm Số dư đầu kỳ mới.",
    "2️⃣ <b>Reset Về 0 (/reset):</b> Chuyển toàn bộ giao dịch hiện tại vào bảng <i>Lịch Sử Chốt Sổ</i> (bảo toàn 100% lịch sử) và đưa số dư hiện tại về 0 đ."
  ].join("\n\n");

  return safeSendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📅 Xác nhận Chốt Sổ Giữ Dư (/chotso)", callback_data: "confirm_renew:yes" }],
        [{ text: "🧹 Xác nhận Lưu Sổ & Reset Về 0 (/reset)", callback_data: "confirm_reset:yes" }],
        [{ text: "❌ Hủy bỏ", callback_data: "confirm_renew:no" }]
      ]
    }
  });
}

/**
 * Xử lý các nút bấm trên Bàn phím cố định dưới đáy màn hình hoặc dữ liệu gửi về từ WebApp
 * @param {object} message
 * @param {string} rawText
 * @param {string|number} chatId
 * @param {string|number} userId
 * @param {string} userLabel
 * @returns {boolean} true nếu đã xử lý xong, false nếu chuyển tiếp cho bộ xử lý lệnh "/"
 */
function handleUiReplyKeyboardOrWizard(message, rawText, chatId, userId, userLabel) {
  // 1. Nếu có dữ liệu gửi từ Telegram.WebApp.sendData()
  if (message && message.web_app_data && message.web_app_data.data) {
    try {
      var webData = JSON.parse(message.web_app_data.data);
      webData.uid = userId;
      webData.chatId = chatId;
      handleWebAppAction(webData);
    } catch (err) {
      Logger.log("[UI WebAppData Error] " + err.message);
    }
    return true;
  }

  var clean = String(rawText || "").trim();

  // 2. Xử lý 3 nút bấm cố định trên Reply Keyboard dưới đáy màn hình (kèm tương thích ngược với nhãn nút cũ)
  if (
    clean === "📱 Mở App Thu Chi (UI Mode)" ||
    clean === "Mở App Thu Chi (UI Mode)" ||
    clean === "📱 Open UI Mode" ||
    clean === "Open UI Mode" ||
    clean === "/ui" ||
    clean === "/menu"
  ) {
    setWizardState(chatId, null);
    var uiUrl = getWebAppUiUrl(userId);
    var msgText =
      "📱 <b>BẢNG ĐIỀU KHIỂN ĐỒ HỌA (UI MODE)</b>\n\n" +
      "Bấm nút <b>📱 Mở App Thu Chi (UI Mode)</b> ở bàn phím dưới đáy màn hình hoặc nút bên dưới để mở giao diện 3 Tab (tích hợp Máy tính <code>+ - × ÷</code> và tải Ảnh Bill lên Google Drive).";

    if (uiUrl) {
      safeSendMessage(chatId, msgText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 Mở App Thu Chi (UI Mode)", web_app: { url: uiUrl } }]
          ]
        }
      });
    }
    return safeSendMessage(
      chatId,
      "✅ Đã cập nhật bàn phím 3 nút điều khiển nhanh dưới đáy màn hình.",
      { reply_markup: buildMainReplyKeyboard(userId) }
    );
  }

  if (
    clean === "➕ Ghi Thu / Chi" ||
    clean === "+ Ghi Thu / Chi" ||
    clean === "/ghi" ||
    clean === "/wizard"
  ) {
    return sendWizardStep1(chatId, null);
  }

  if (
    clean === "📊 Số Dư" ||
    clean === "Số Dư" ||
    clean === "📊 Xem Số Dư" ||
    clean === "Xem Số Dư"
  ) {
    setWizardState(chatId, null);
    var balReport = buildBalanceReport();
    return safeSendMessage(chatId, balReport, {
      reply_markup: buildMainReplyKeyboard(userId),
      disable_web_page_preview: true
    });
  }

  if (
    clean === "📜 Lịch sử" ||
    clean === "Lịch sử" ||
    clean === "📜 Lịch Sử" ||
    clean === "Lịch Sử" ||
    clean === "📜 5 GD Gần Nhất" ||
    clean === "5 GD Gần Nhất"
  ) {
    setWizardState(chatId, null);
    var hisReport = buildRecentHistoryReport(5);
    return safeSendMessage(chatId, hisReport, {
      reply_markup: buildMainReplyKeyboard(userId),
      disable_web_page_preview: true
    });
  }

  if (clean === "↩️ Hoàn Tác (Undo)" || clean === "Hoàn Tác (Undo)") {
    setWizardState(chatId, null);
    var undoText = executeUndoTransaction("", null);
    return safeSendMessage(chatId, undoText, {
      reply_markup: buildMainReplyKeyboard(userId)
    });
  }

  if (clean === "🎯 Đặt Hạn Mức" || clean === "Đặt Hạn Mức") {
    setWizardState(chatId, null);
    return sendLimitWizardMenu(chatId, null);
  }

  if (clean === "📅 Chốt Sổ / Reset" || clean === "Chốt Sổ / Reset") {
    setWizardState(chatId, null);
    return sendClosingMenu(chatId);
  }

  // 3. Nếu người dùng gõ câu lệnh bắt đầu bằng "/", hủy trạng thái Wizard cũ và nhường cho CLI xử lý
  if (clean.charAt(0) === "/") {
    setWizardState(chatId, null);
    return false;
  }

  // 4. Kiểm tra xem người dùng có đang ở trong bước nhập liệu của In-Chat Wizard hay không
  var wiz = getWizardState(chatId);
  if (!wiz) {
    return false;
  }

  // Bước nhập tên Ngân hàng mới
  if (wiz.type === "tx" && wiz.step === "custom_bank") {
    var newBank = registerCustomBank(clean);
    wiz.bank = newBank;
    wiz.step = 3;
    setWizardState(chatId, wiz);
    return sendWizardStep3(chatId, null, newBank);
  }

  // Bước nhập tên #Tag mới
  if (wiz.type === "tx" && wiz.step === "custom_tag") {
    var newTag = registerCustomTag(clean);
    wiz.tag = newTag;
    wiz.step = 4;
    setWizardState(chatId, wiz);
    return sendWizardStep4(chatId, null, newTag);
  }

  // Bước nhập Số tiền hạn mức cho #Tag
  if (wiz.type === "limit" && wiz.step === 2 && wiz.tag) {
    var limAmt = parseAmountExpression(clean.split(/\s+/)[0]);
    if (limAmt === null || Math.abs(limAmt) <= 0) {
      return safeSendMessage(
        chatId,
        "⚠️ Số tiền hạn mức chưa hợp lệ. Hãy nhập lại số tiền cho <b>" +
          escapeHtml(wiz.tag) +
          "</b> (Ví dụ: <code>300k</code> hoặc <code>100k*5</code>):"
      );
    }
    setWizardState(chatId, null);
    var limitMsg = handleSetLimitCommand(wiz.tag + " " + Math.abs(limAmt), userLabel);
    return safeSendMessage(chatId, limitMsg, {
      reply_markup: buildMainReplyKeyboard(userId)
    });
  }

  // Bước 4 của Wizard Ghi Thu/Chi: Nhận <Số tiền hoặc Phép tính> [Ghi chú] (kèm Ảnh Bill nếu có)
  if (wiz.type === "tx" && wiz.step === 4) {
    if (!clean) {
      // Nếu chỉ gửi ảnh mà chưa ghi số tiền -> lưu ảnh vào bộ nhớ đệm và nhắc nhập số tiền
      if (extractPhotoFileIdFromMsg(message)) {
        savePendingPhotoFromMessage(message);
        return safeSendMessage(
          chatId,
          "📸 Đã nhận Ảnh Bill. Bây giờ hãy gõ <b>Số tiền (hoặc phép tính) + Ghi chú</b> để hoàn tất giao dịch (Ví dụ: <code>55k mua trà đào</code>):"
        );
      }
      return true;
    }

    var tokenParts = clean.split(/\s+/);
    var exprToken = tokenParts[0];
    var noteStr = tokenParts.slice(1).join(" ") || (wiz.sign === "-" ? "Chi tiêu" : "Thu tiền");
    var evalVal = parseAmountExpression(exprToken);

    if (evalVal === null || evalVal === 0) {
      return safeSendMessage(
        chatId,
        "⚠️ Số tiền hoặc phép tính <code>" +
          escapeHtml(exprToken) +
          "</code> chưa hợp lệ.\nHãy nhập lại (Ví dụ: <code>55k mua trà đào</code> hoặc <code>(120k+30k)/3 ăn trưa</code>):"
      );
    }

    var finalAmount = wiz.sign === "-" ? -Math.abs(evalVal) : Math.abs(evalVal);
    var cleanExprDisplay = exprToken.replace(/^[+-]/, "");
    var rawAmountFormatted =
      /[+\-*/()]/.test(cleanExprDisplay)
        ? wiz.sign + "(" + cleanExprDisplay + ")"
        : wiz.sign + cleanExprDisplay;

    setWizardState(chatId, null);

    var parsedTx = {
      valid: true,
      bank: wiz.bank || "Chung",
      tag: normalizeTag(wiz.tag || "#CHUNG"),
      amount: finalAmount,
      rawAmount: rawAmountFormatted,
      note: noteStr
    };

    var billInfo = uploadBillPhotoFromMessage(message, parsedTx.bank, parsedTx.tag);
    var result = executeFinanceTransaction(wiz.fund || "c", parsedTx, userLabel, billInfo);
    return safeSendMessage(chatId, result.text, {
      reply_markup: result.replyMarkup,
      disable_web_page_preview: true
    });
  }

  return false;
}

/**
 * Xử lý các Callback Query của hệ thống Wizard ("wiz_..." và "confirm_reset:...")
 * @param {object} callbackQuery
 * @param {string} data
 * @param {string|number} chatId
 * @param {string|number} userId
 * @param {string} userLabel
 * @returns {boolean} true nếu đã xử lý
 */
function handleUiWizardCallback(callbackQuery, data, chatId, userId, userLabel) {
  var msgId =
    callbackQuery.message && callbackQuery.message.message_id
      ? callbackQuery.message.message_id
      : null;

  if (data === "wiz_cancel") {
    setWizardState(chatId, null);
    callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Đã hủy thao tác"
    });
    return editMessageText(chatId, msgId, "❌ <b>Đã hủy thao tác chọn nút.</b>");
  }

  if (data === "wiz_back_1") {
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return sendWizardStep1(chatId, msgId);
  }

  if (data.indexOf("wiz_s1:") === 0) {
    var p1 = data.split(":");
    var fund = p1[1] || "c";
    var sign = p1[2] || "-";
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return sendWizardStep2(chatId, msgId, fund, sign);
  }

  if (data.indexOf("wiz_s2:") === 0) {
    var bank = data.substring("wiz_s2:".length);
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return sendWizardStep3(chatId, msgId, bank);
  }

  if (data.indexOf("wiz_s3:") === 0) {
    var tag = data.substring("wiz_s3:".length);
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return sendWizardStep4(chatId, msgId, tag);
  }

  if (data === "wiz_new_bank") {
    var stBank = getWizardState(chatId) || { type: "tx", fund: "c", sign: "-" };
    stBank.step = "custom_bank";
    setWizardState(chatId, stBank);
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return editMessageText(
      chatId,
      msgId,
      "🏦 <b>THÊM NGÂN HÀNG / NGUỒN TIỀN MỚI</b>\n\nHãy gõ tên Ngân hàng hoặc Ví bạn muốn thêm vào ô chat (Ví dụ: <code>Vietcombank</code>, <code>Momo</code>):"
    );
  }

  if (data === "wiz_new_tag") {
    var stTag = getWizardState(chatId) || { type: "tx", fund: "c", sign: "-", bank: "Chung" };
    stTag.step = "custom_tag";
    setWizardState(chatId, stTag);
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return editMessageText(
      chatId,
      msgId,
      "🏷️ <b>THÊM PHÂN LOẠI (#TAG) MỚI</b>\n\nHãy gõ tên #Tag bạn muốn thêm vào ô chat (Ví dụ: <code>#XANGXE</code>, <code>#TIENNHA</code>):"
    );
  }

  if (data.indexOf("wiz_lim_tag:") === 0) {
    var limTag = normalizeTag(data.substring("wiz_lim_tag:".length));
    setWizardState(chatId, {
      type: "limit",
      step: 2,
      tag: limTag
    });
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    return editMessageText(
      chatId,
      msgId,
      "🎯 <b>ĐẶT HẠN MỨC CHO " +
        escapeHtml(limTag) +
        "</b>\n\nHãy gõ số tiền hạn mức tháng vào ô chat (Ví dụ: <code>300k</code>, <code>2tr</code> hoặc phép tính <code>100k*30</code>):"
    );
  }

  if (data.indexOf("confirm_reset:") === 0) {
    var act = data.split(":")[1];
    callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
    if (act === "yes") {
      var resetMsg = executeResetAllToZero(userLabel);
      return safeSendMessage(chatId, resetMsg, { disable_web_page_preview: true });
    }
    return safeSendMessage(chatId, "❌ <b>Đã hủy thao tác Reset.</b> Số dư hiện tại được giữ nguyên.");
  }

  return false;
}

/**
 * ============================================================
 * BACKEND API PHỤC VỤ GIAO DIỆN WEB APP ("OPEN UI MODE")
 * ============================================================
 */

/**
 * Lấy toàn bộ dữ liệu thực tế từ Google Sheets để hiển thị lên giao diện 3 Tab "Open UI Mode"
 * @param {string|number} [uid]
 * @returns {object}
 */
function getWebAppInitialData(uid) {
  var checkId = String(uid || getAdminChatId()).trim();
  if (!isAuthorizedUser(checkId)) {
    return {
      ok: false,
      unauthorized: true,
      message: getUnauthorizedMessage()
    };
  }

  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);
  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);
  var limitsMap = getAllTagLimits();
  var meta = getDynamicBanksAndTags();

  // Đảm bảo mọi ngân hàng có trong danh sách đều có key số dư
  var balancesC = {};
  var balancesLCB = {};
  for (var i = 0; i < meta.banks.length; i++) {
    var b = meta.banks[i];
    balancesC[b] = pStats.byBank[b] || 0;
    balancesLCB[b] = sStats.byBank[b] || 0;
  }

  // Lấy 8 giao dịch mới nhất của cả 2 quỹ để hiển thị trên Tab 3
  var recentC = pRows.slice(-5).map(function (r) {
    return {
      id: r.txId,
      time: r.time,
      fund: "/c",
      bank: r.bank,
      tag: r.tag,
      expr: r.rawAmount || String(r.amount),
      amount: r.amount,
      note: r.note,
      billUrl: r.billUrl || ""
    };
  });

  var recentLCB = sRows.slice(-5).map(function (r) {
    return {
      id: r.txId,
      time: r.time,
      fund: "/lcb",
      bank: r.bank,
      tag: r.tag,
      expr: r.rawAmount || String(r.amount),
      amount: r.amount,
      note: r.note,
      billUrl: r.billUrl || ""
    };
  });

  var combinedRecent = recentC.concat(recentLCB).slice(-8);

  return {
    ok: true,
    version: getAppVersion(),
    botUsername: CONFIG.BOT_USERNAME,
    uid: checkId,
    sheetUrl: getProperty("SHEET_URL") || "",
    banks: meta.banks,
    tags: meta.tags,
    totalC: pStats.totalBalance,
    totalLCB: sStats.totalBalance,
    balances: {
      c: balancesC,
      lcb: balancesLCB
    },
    tagTotals: {
      c: pStats.byTag,
      lcb: sStats.byTag
    },
    spentByTag: pStats.spentByTag,
    limits: limitsMap,
    transactions: combinedRecent
  };
}

/**
 * Xử lý mọi thao tác gửi từ giao diện Web App ("Open UI Mode"):
 * - Ghi nhận giao dịch (kèm phép tính + - * / và Ảnh Bill Base64 tải lên Google Drive)
 * - Cập nhật hạn mức (/limit)
 * - Hoàn tác (/undo)
 * - Chốt sổ (/chotso) và Reset về 0 (/reset)
 * - Thêm Ngân hàng / #Tag mới
 *
 * @param {object} payload
 * @returns {object}
 */
function handleWebAppAction(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Dữ liệu yêu cầu không hợp lệ." };
  }

  var uid = String(payload.uid || getAdminChatId()).trim();
  var chatId = String(payload.chatId || uid || getAdminChatId()).trim();

  if (!isAuthorizedUser(uid)) {
    return {
      ok: false,
      unauthorized: true,
      message: getUnauthorizedMessage()
    };
  }

  var userLabel = (payload.userName || "UI User") + " (" + uid + ")";
  var action = String(payload.action || "").trim();

  try {
    if (action === "get_state") {
      return getWebAppInitialData(uid);
    }

    if (action === "add_bank") {
      var addedBank = registerCustomBank(payload.bankName || "");
      return {
        ok: true,
        addedBank: addedBank,
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "add_tag") {
      var addedTag = registerCustomTag(payload.tagName || "");
      return {
        ok: true,
        addedTag: addedTag,
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "record_tx") {
      var mode = String(payload.fund || "c").toLowerCase();
      if (mode !== "c" && mode !== "lcb" && mode !== "clcb") mode = "c";

      var sign = payload.sign === "+" ? "+" : "-";
      var bank = String(payload.bank || "Chung").trim() || "Chung";
      var tag = normalizeTag(payload.tag || "#CHUNG");
      var rawExpr = String(payload.calcExpr || payload.amount || "").trim();
      var evalAmt = parseAmountExpression(rawExpr);

      if (evalAmt === null || Math.abs(evalAmt) <= 0) {
        return {
          ok: false,
          error: "Biểu thức số tiền không hợp lệ hoặc bằng 0."
        };
      }

      var finalAmount = sign === "-" ? -Math.abs(evalAmt) : Math.abs(evalAmt);
      var cleanExpr = rawExpr.replace(/^[+-]/, "").replace(/\s+/g, "");
      var rawAmountDisplay =
        /[+\-*/()]/.test(cleanExpr) ? sign + "(" + cleanExpr + ")" : sign + Math.abs(evalAmt);
      var note = String(payload.note || "").trim() || (sign === "-" ? "Chi tiêu (UI)" : "Thu tiền (UI)");

      // Nếu người dùng đính kèm Ảnh Bill trên giao diện Open UI Mode -> Tải lên Google Drive
      var billInfo = { hasPhoto: false, billUrl: "", error: "" };
      if (payload.billBase64 && payload.billBase64.data) {
        billInfo = uploadBase64BillToDrive(
          payload.billBase64.data,
          payload.billBase64.mimeType || "image/jpeg",
          bank,
          tag
        );
      }

      var parsedTx = {
        valid: true,
        bank: bank,
        tag: tag,
        amount: finalAmount,
        rawAmount: rawAmountDisplay,
        note: note
      };

      var txRes = executeFinanceTransaction(mode, parsedTx, userLabel, billInfo);
      logToSheet(userLabel, "[Open UI Mode] /" + mode + " " + bank + " " + tag + " " + rawAmountDisplay, "Đã ghi GD");

      // Gửi biên lai đóng khung về khung chat Telegram của người dùng
      safeSendMessage(chatId, txRes.text, {
        reply_markup: txRes.replyMarkup,
        disable_web_page_preview: true
      });

      return {
        ok: true,
        message: "Đã lưu giao dịch thành công!",
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "set_limit") {
      var limTag = normalizeTag(payload.tag || "#CHUNG");
      var limRaw = String(payload.limitAmount || "").trim();
      var limMsg = handleSetLimitCommand(limTag + " " + limRaw, userLabel);
      safeSendMessage(chatId, limMsg);
      return {
        ok: true,
        message: "Đã cập nhật hạn mức cho " + limTag,
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "undo_tx") {
      var undoMsg = executeUndoTransaction("", null);
      safeSendMessage(chatId, undoMsg);
      return {
        ok: true,
        message: "Đã hoàn tác giao dịch gần nhất.",
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "chotso") {
      var renewMsg = executeRenewPeriod(userLabel);
      safeSendMessage(chatId, renewMsg, { disable_web_page_preview: true });
      return {
        ok: true,
        message: "Đã chốt sổ sang kỳ mới thành công.",
        state: getWebAppInitialData(uid)
      };
    }

    if (action === "reset") {
      var resetMsg = executeResetAllToZero(userLabel);
      safeSendMessage(chatId, resetMsg, { disable_web_page_preview: true });
      return {
        ok: true,
        message: "Đã lưu lịch sử chốt sổ và reset số dư về 0 đ.",
        state: getWebAppInitialData(uid)
      };
    }

    return { ok: false, error: "Hành động không được hỗ trợ: " + action };
  } catch (err) {
    Logger.log("[handleWebAppAction Error] " + err.message);
    return { ok: false, error: err.message };
  }
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.getWebAppUiUrl = getWebAppUiUrl;
  global.buildMainReplyKeyboard = buildMainReplyKeyboard;
  global.setWizardState = setWizardState;
  global.getWizardState = getWizardState;
  global.getDynamicBanksAndTags = getDynamicBanksAndTags;
  global.registerCustomBank = registerCustomBank;
  global.registerCustomTag = registerCustomTag;
  global.sendWizardStep1 = sendWizardStep1;
  global.sendWizardStep2 = sendWizardStep2;
  global.sendWizardStep3 = sendWizardStep3;
  global.sendWizardStep4 = sendWizardStep4;
  global.sendLimitWizardMenu = sendLimitWizardMenu;
  global.sendClosingMenu = sendClosingMenu;
  global.handleUiReplyKeyboardOrWizard = handleUiReplyKeyboardOrWizard;
  global.handleUiWizardCallback = handleUiWizardCallback;
  global.getWebAppInitialData = getWebAppInitialData;
  global.handleWebAppAction = handleWebAppAction;

  module.exports = {
    getWebAppUiUrl: getWebAppUiUrl,
    buildMainReplyKeyboard: buildMainReplyKeyboard,
    setWizardState: setWizardState,
    getWizardState: getWizardState,
    getDynamicBanksAndTags: getDynamicBanksAndTags,
    registerCustomBank: registerCustomBank,
    registerCustomTag: registerCustomTag,
    sendWizardStep1: sendWizardStep1,
    sendWizardStep2: sendWizardStep2,
    sendWizardStep3: sendWizardStep3,
    sendWizardStep4: sendWizardStep4,
    sendLimitWizardMenu: sendLimitWizardMenu,
    sendClosingMenu: sendClosingMenu,
    handleUiReplyKeyboardOrWizard: handleUiReplyKeyboardOrWizard,
    handleUiWizardCallback: handleUiWizardCallback,
    getWebAppInitialData: getWebAppInitialData,
    handleWebAppAction: handleWebAppAction
  };
}


// ============================================================================
// commandController.js //
/**
 * ============================================================
 * MODULE: COMMAND CONTROLLER (OCP - Open/Closed Principle)
 * Chuyên trách:
 * 1. Kiểm tra phân quyền Multi-Account Whitelist (ALLOWED_USER_IDS)
 *    - Nếu tài khoản không được phép -> Trả về "Bot 2.2.0 Loading..."
 * 2. Phối hợp song song giữa Giao diện UI (Reply Keyboard, In-Chat Wizard,
 *    Web App "Open UI Mode") và toàn bộ tập lệnh bắt đầu bằng dấu "/"
 *    (/c, /lcb, /clcb, /undo, /sodu, /balance, /ls, /history, /limit, /chotso, /renew, /reset)
 * 3. Xử lý ảnh Bill đính kèm (cả ảnh kèm Caption, Reply vào ảnh, hoặc gửi ảnh trước rồi gõ lệnh)
 * ============================================================
 */

/**
 * Xử lý chung cho 3 lệnh ghi chép thu chi: /c, /lcb, /clcb
 * @param {string} mode - "c" | "lcb" | "clcb"
 * @param {string} argsText - Chuỗi tham số sau lệnh
 * @param {object} message - Đối tượng message từ Telegram (có thể kèm photo)
 * @param {string|number} chatId
 * @param {string} userLabel
 */
function handleTransactionCommand(mode, argsText, message, chatId, userLabel) {
  var parsedTx = parseTransactionArgs(argsText);
  if (!parsedTx.valid) {
    var cmdName = "/" + mode;
    var errMsg = [
      "⚠️ <b>CÚ PHÁP LỆNH " + cmdName.toUpperCase() + " CHƯA ĐÚNG</b>",
      parsedTx.error,
      "<blockquote>" +
        "• <b>Cấu trúc:</b> <code>" + cmdName + " &lt;Bank&gt; [#TAG] &lt;Tiền&gt; [Ghi chú]</code>\n\n" +
        "• <b>Thu (+):</b> <code>" + cmdName + " Techcombank #LUONG 15tr</code>\n\n" +
        "• <b>Chi (-):</b> <code>" + cmdName + " Techcombank #TRADA -50k</code>\n\n" +
        "• <b>Phép tính:</b> <code>" + cmdName + " MB #ANUONG -(120k+30k)/3</code>\n\n" +
        "• <b>Mặc định:</b> Không ghi Bank -> Chung, Tag -> <code>#CHUNG</code>" +
        "</blockquote>"
    ].join("\n\n");

    return safeSendMessage(chatId, errMsg);
  }

  // Tự động kiểm tra ảnh Bill từ: (1) Ảnh kèm caption, (2) Reply vào ảnh, hoặc (3) Ảnh vừa gửi trước đó
  var billInfo = uploadBillPhotoFromMessage(message, parsedTx.bank, parsedTx.tag);

  var result = executeFinanceTransaction(mode, parsedTx, userLabel, billInfo);
  return safeSendMessage(chatId, result.text, {
    reply_markup: result.replyMarkup,
    disable_web_page_preview: true
  });
}

/**
 * Điều phối tin nhắn văn bản, ảnh, nút bấm bàn phím đáy hoặc chú thích ảnh (Caption) từ người dùng
 * @param {object} message - Đối tượng message từ Telegram Update
 */
function dispatchCommand(message) {
  if (!message || !message.chat) return null;

  var chatId = message.chat.id;
  var userId = message.from ? message.from.id : chatId;
  var firstName = message.from ? message.from.first_name || "User" : "User";
  var userLabel = firstName + " (" + userId + ")";

  // 1. KIỂM TRA PHÂN QUYỀN TÀI KHOẢN (MULTI-USER WHITELIST)
  // Nếu không thuộc danh sách ALLOWED_USER_IDS -> Trả về "Bot <Tên Phiên bản> Loading..."
  if (!isAuthorizedUser(userId)) {
    Logger.log("[Auth] Chan truy cap tu tai khoan khong duoc phep: " + userLabel);
    return sendMessage(chatId, getUnauthorizedMessage());
  }

  // Hỗ trợ đọc lệnh từ cả tin nhắn chữ (message.text) và chú thích ảnh Bill (message.caption)
  var rawText = String(message.text || message.caption || "").trim();

  // 2. KIỂM TRA CÁC NÚT BẤM TRÊN BÀN PHÍM ĐÁY MÀN HÌNH HOẶC LUỒNG WIZARD 4 BƯỚC
  if (typeof handleUiReplyKeyboardOrWizard === "function") {
    var handledByUi = handleUiReplyKeyboardOrWizard(message, rawText, chatId, userId, userLabel);
    if (handledByUi) {
      return null;
    }
  }

  // Nếu người dùng gửi 1 bức ảnh (không kèm lệnh / ở caption) -> Lưu tạm file_id ảnh đó trong 5 phút
  // để khi họ gõ lệnh /c, /lcb, /clcb hoặc dùng Wizard ngay câu tiếp theo thì Bot tự động đính kèm ảnh đó luôn
  if (!rawText || rawText.charAt(0) !== "/") {
    if (extractPhotoFileIdFromMsg(message)) {
      savePendingPhotoFromMessage(message);
    }
    return null;
  }

  var parts = rawText.split(/\s+/);
  var command = parts[0].split("@")[0].toLowerCase();
  var argsText = rawText.substring(parts[0].length).trim();

  // Ghi log lệnh ngắn gọn vào Sheet Logs
  var preview = rawText.length > 80 ? rawText.substring(0, 80) + "..." : rawText;
  logToSheet(userLabel, preview, "Đã nhận lệnh");

  switch (command) {
    case "/start":
    case "/help":
      var sheetUrl = getProperty("SHEET_URL");
      var helpBlocks = [
        "🚀 <b>SUPER FINANCE BOT • v" + escapeHtml(getAppVersion()) + "</b>",
        "Xin chào <b>" +
          escapeHtml(firstName) +
          "</b>! Bạn có thể dùng <b>3 nút bấm bên dưới</b> (<i>Mở App Thu Chi</i>, <i>Số Dư</i>, <i>Lịch sử</i>) hoặc gõ lệnh trực tiếp:",
        "<blockquote>" +
          "💼 <b>1. GHI THU / CHI</b>\n\n" +
          "• <code>/c</code> : Ghi Quỹ Cá Nhân\n\n" +
          "• <code>/lcb</code> : Ghi Quỹ Phụ\n\n" +
          "• <code>/clcb</code> : Ghi đồng thời cả 2 Quỹ\n\n" +
          "• <code>/ghi</code> : Chọn nút từng bước trong Chat" +
          "</blockquote>",
        "<blockquote>" +
          "📊 <b>2. TRA CỨU & QUẢN LÝ SỔ</b>\n\n" +
          "• <code>/sodu</code> : Xem báo cáo số dư (/balance)\n\n" +
          "• <code>/ls</code> : Xem 5 giao dịch gần nhất (/history)\n\n" +
          "• <code>/limit</code> : Đặt hạn mức #Tag\n\n" +
          "• <code>/undo</code> : Hoàn tác GD vừa nhập\n\n" +
          "• <code>/chotso</code> • <code>/reset</code> : Chốt sổ / Reset về 0" +
          "</blockquote>",
        "<blockquote>" +
          "🧮 <b>3. VÍ DỤ CÚ PHÁP NHẬP NHANH (HỖ TRỢ + - * /)</b>\n\n" +
          "• <b>Cấu trúc:</b> <code>/c &lt;Bank&gt; [#TAG] &lt;Tiền&gt; [Note]</code>\n\n" +
          "• <b>Thu (+):</b> <code>/c Techcombank #LUONG 15tr</code>\n\n" +
          "• <b>Chi (-):</b> <code>/c Techcombank #TRADA -50k</code>\n\n" +
          "• <b>Phép tính:</b> <code>/c MB #ANUONG -(120k+30k)/3</code>" +
          "</blockquote>"
      ];

      if (sheetUrl) {
        helpBlocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
      }

      return safeSendMessage(chatId, helpBlocks.join("\n\n"), {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/c":
      return handleTransactionCommand("c", argsText, message, chatId, userLabel);

    case "/lcb":
      return handleTransactionCommand("lcb", argsText, message, chatId, userLabel);

    case "/clcb":
      return handleTransactionCommand("clcb", argsText, message, chatId, userLabel);

    case "/undo":
      var undoText = executeUndoTransaction(argsText, null);
      return safeSendMessage(chatId, undoText, {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/sodu":
    case "/balance":
      var balReport = buildBalanceReport();
      return safeSendMessage(chatId, balReport, {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/ls":
    case "/history":
      var hisReport = buildRecentHistoryReport(5);
      return safeSendMessage(chatId, hisReport, {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/limit":
      var limitRes = handleSetLimitCommand(argsText, userLabel);
      return safeSendMessage(chatId, limitRes, {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/chotso":
    case "/renew":
      if (argsText && (argsText.toLowerCase() === "yes" || argsText.toLowerCase() === "confirm")) {
        var doneText = executeRenewPeriod(userLabel);
        return safeSendMessage(chatId, doneText, {
          reply_markup: buildMainReplyKeyboard(userId),
          disable_web_page_preview: true
        });
      }
      var previewObj = buildRenewPreview();
      return safeSendMessage(chatId, previewObj.text, {
        reply_markup: previewObj.replyMarkup
      });

    case "/reset":
      var resetResultText = executeResetAllToZero(userLabel);
      return safeSendMessage(chatId, resetResultText, {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/ping":
      return safeSendMessage(
        chatId,
        "🏓 <b>Pong!</b>\n\nBot <b>v" +
          escapeHtml(getAppVersion()) +
          "</b> đang hoạt động ổn định.\n\n<i>Chế độ Anti-Reply-Storm & Z Fold UI: Đang bật</i>",
        { reply_markup: buildMainReplyKeyboard(userId) }
      );

    case "/id":
      return safeSendMessage(
        chatId,
        "🆔 <b>THÔNG TIN ĐỊNH DANH CỦA BẠN:</b>\n\n" +
          "• <b>User ID:</b> <code>" +
          userId +
          "</code>\n\n" +
          "• <b>Chat ID:</b> <code>" +
          chatId +
          "</code>",
        { reply_markup: buildMainReplyKeyboard(userId) }
      );

    case "/status":
      var cfg = getConfig();
      var driveSt = checkDrivePermissionStatus();
      var stBlocks = [
        "🛡️ <b>TRẠNG THÁI HỆ THỐNG BOT</b>",
        "<blockquote>" +
          "• <b>Phiên bản:</b> v" + escapeHtml(cfg.appVersion) + " (Z Fold UI)\n\n" +
          "• <b>Bot:</b> @" + escapeHtml(cfg.botUsername) + "\n\n" +
          "• <b>Allowed IDs:</b> <code>" + escapeHtml(cfg.adminIds) + "</code>\n\n" +
          "• <b>Cầu chì:</b> " + (cfg.emergencyStop ? "🔴 ĐANG KHÓA" : "🟢 Hoạt động") + "\n\n" +
          "• <b>Database:</b> " + (cfg.sheetId ? "Đã kết nối" : "Chưa tạo") + "\n\n" +
          "• <b>Google Drive:</b> " + (driveSt.authorized ? "Đã cấp quyền" : "Chưa cấp quyền") +
          "</blockquote>"
      ];
      if (cfg.sheetUrl) {
        stBlocks.push("📊 <a href=\"" + escapeHtml(cfg.sheetUrl) + "\">Mở bảng Google Sheets</a>");
      }
      return safeSendMessage(chatId, stBlocks.join("\n\n"), {
        reply_markup: buildMainReplyKeyboard(userId),
        disable_web_page_preview: true
      });

    case "/stop_emergency":
      safeSendMessage(
        chatId,
        "🛑 <b>ĐANG KÍCH HOẠT CẦU CHÌ DỪNG KHẨN CẤP...</b>\n" +
          "Bot sẽ ngắt Webhook và xả toàn bộ hàng đợi tin nhắn ngay lập tức."
      );
      return EmergencyStop();

    default:
      return safeSendMessage(
        chatId,
        "⚠️ Lệnh <code>" +
          escapeHtml(command) +
          "</code> chưa được hỗ trợ.\nGõ /help hoặc bấm các nút dưới đáy màn hình để thao tác.",
        { reply_markup: buildMainReplyKeyboard(userId) }
      );
  }
}

/**
 * Xử lý sự kiện bấm nút Inline Keyboard (Hoàn tác giao dịch / Xác nhận chốt sổ / Wizard 4 bước)
 * @param {object} callbackQuery
 */
function handleCallbackQuery(callbackQuery) {
  if (!callbackQuery || !callbackQuery.id) return null;

  var fromUser = callbackQuery.from || {};
  var userId = fromUser.id;
  var firstName = fromUser.first_name || "User";
  var userLabel = firstName + " (" + userId + ")";
  var chatId =
    callbackQuery.message && callbackQuery.message.chat
      ? callbackQuery.message.chat.id
      : userId;

  // Kiểm tra quyền truy cập
  if (!isAuthorizedUser(userId)) {
    callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: getUnauthorizedMessage(),
      show_alert: true
    });
    return null;
  }

  var data = String(callbackQuery.data || "");

  // 0. Chuyển tiếp các sự kiện thuộc In-Chat Wizard hoặc xác nhận Reset
  if (typeof handleUiWizardCallback === "function") {
    var wizHandled = handleUiWizardCallback(callbackQuery, data, chatId, userId, userLabel);
    if (wizHandled) {
      return null;
    }
  }

  // 1. Nút Hoàn tác giao dịch: "undo_tx:<mode>:<txId>"
  if (data.indexOf("undo_tx:") === 0) {
    var parts = data.split(":");
    var mode = parts[1] || "c";
    var txId = parts[2] || "";

    callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "↩️ Đang hoàn tác giao dịch " + txId + "..."
    });

    var undoMsg = executeUndoTransaction(mode, txId);
    return safeSendMessage(chatId, undoMsg);
  }

  // 2. Nút Xác nhận Chốt sổ: "confirm_renew:yes" hoặc "confirm_renew:no"
  if (data.indexOf("confirm_renew:") === 0) {
    var action = data.split(":")[1];
    callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackQuery.id
    });

    if (action === "yes") {
      var renewMsg = executeRenewPeriod(userLabel);
      return safeSendMessage(chatId, renewMsg);
    } else {
      return safeSendMessage(chatId, "❌ <b>Đã hủy thao tác.</b> Dữ liệu hiện tại được giữ nguyên.");
    }
  }

  callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQuery.id
  });
  return null;
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.handleTransactionCommand = handleTransactionCommand;
  global.dispatchCommand = dispatchCommand;
  global.handleCallbackQuery = handleCallbackQuery;

  module.exports = {
    handleTransactionCommand: handleTransactionCommand,
    dispatchCommand: dispatchCommand,
    handleCallbackQuery: handleCallbackQuery
  };
}

