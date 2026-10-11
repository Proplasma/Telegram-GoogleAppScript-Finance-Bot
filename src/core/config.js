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
