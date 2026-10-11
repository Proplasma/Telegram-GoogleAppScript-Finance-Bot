// F1ActivateBot.js //
/**
 * ============================================================
 * FILE KICH HOAT & CAU HINH WEBAPP_URL TREN GOOGLE APPS SCRIPT
 * (Luon nam o vi tri dau tien tren GAS Editor de de dien WEBAPP_URL
 * va bam Run -> ActivateBot cap toan bo quyen 1 lan duy nhat)
 * ============================================================
 */

function ActivateBot() {
  setupEnvironment();
  Logger.log("[ActivateBot] Cap nhat bien moi truong thanh cong.");

  // Tu dong kich hoat toan bo quyen (Sheets, Drive, UrlFetch, Triggers, HtmlService) 1 lan duy nhat
  GrantAllPermissions();

  ResumeBot();
  setWebhook();
  Logger.log("[ActivateBot] Thiet lap Webhook thanh cong.");
}

// Bi danh tuong thich nguoc
function ActivedBot() {
  return ActivateBot();
}

function setupEnvironment() {
  var props = PropertiesService.getScriptProperties();
  var existingSheetId = props.getProperty("SHEET_ID") || "";
  var existingSheetUrl = props.getProperty("SHEET_URL") || "";

  var envData = {
    'APP_VERSION': '2.2.0',
    'BOT_TOKEN': 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
    'TELEGRAM_BOT_TOKEN': 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
    'ALLOWED_USER_IDS': 'YOUR_USER_ID_1, YOUR_USER_ID_2',
    'ADMIN_IDS': 'YOUR_USER_ID_1, YOUR_USER_ID_2',
    'ADMIN_CHAT_ID': 'YOUR_ADMIN_CHAT_ID_HERE',
    // DIEN WEBAPP_URL MOI SAU KHI DEPLOY TAI DAY:
    'WEBAPP_URL': 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
    'EMERGENCY_STOP': 'false'
  };

  if (existingSheetId) {
    envData['SHEET_ID'] = existingSheetId;
  }
  if (existingSheetUrl) {
    envData['SHEET_URL'] = existingSheetUrl;
  }

  props.setProperties(envData);
}

function setWebhook() {
  var webAppUrl = getProperty("WEBAPP_URL");
  var res = setTelegramWebhook(webAppUrl, true);
  Logger.log("[setWebhook] Ket qua: " + JSON.stringify(res));
}

// Export cho moi truong Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.ActivateBot = ActivateBot;
  global.ActivedBot = ActivedBot;
  global.setupEnvironment = setupEnvironment;
  global.setWebhook = setWebhook;

  module.exports = {
    ActivateBot: ActivateBot,
    ActivedBot: ActivedBot,
    setupEnvironment: setupEnvironment,
    setWebhook: setWebhook
  };
}
