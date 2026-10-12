// F1ActivateBot.js //
/**
 * ============================================================
 * FILE KICH HOAT & CAU HINH WEBAPP_URL TREN GOOGLE APPS SCRIPT
 * (Luon nam o vi tri dau tien tren GAS Editor de de dien WEBAPP_URL
 * va bam Run -> ActivateBot cap toan bo quyen 1 lan duy nhat)
 *
 * ============================================================
 * HUONG DAN THEM BOT VAO NHOM (GROUP TELEGRAM) & CHAT TRONG NHOM:
 * ============================================================
 * Buoc 1: Them Bot (@SuperFinanceGAS_bot) vao Nhom Telegram cua ban.
 * Buoc 2: Cap quyen QUAN TRI VIEN (Admin) cho Bot trong cai dat Nhom
 *         (giup Bot doc duoc cac nut bam ban phim day va anh Bill gui trong nhom).
 * Buoc 3: Cap phep ID Nhom cho Bot (Chon 1 trong 2 cach):
 *   - CACH 1 (Tu dong ngay tren Telegram - Khuyen dung):
 *     +Dung tai khoan Admin cua ban go lenh: /id  (hoac /setgroup) ngay trong Nhom.
 *     +Bot se hien ma Group ID (dang am, VD: -1001234567890) kem nut bam:
 *      [✅ Cap phep & Ghi de ID Nhom nay vao Bot].
 *     +Bam nut do -> Bot tu dong luu de ID Nhom vao he thong va bat ban phim 3 nut!
 *   - CACH 2 (Dien tay trong file nay):
 *     +Go /id trong nhom de xem Group ID (VD: -1001234567890).
 *     +Dan ma do vao muc 'ALLOWED_GROUP_IDS' ben duoi roi bam Run -> ActivateBot.
 *
 * Buoc 4: Cach chat & su dung Bot trong Nhom sau khi da cap phep:
 *   - Moi thanh vien trong nhom deu co the bam 3 nut o day man hinh:
 *     + [📱 Mo App Thu Chi (UI Mode)] -> Bot gui nut mo bang dieu khien do hoa 3 Tab.
 *     + [📊 So Du]                    -> Xem bao cao so du ngay trong nhom.
 *     + [📜 Lich su]                  -> Xem 5 giao dich gan nhat ngay trong nhom.
 *   - Hoac go truc tiep cac lenh thu chi trong nhom:
 *     + /c Techcombank #TRADA -50k Mua tra da
 *     + /lcb MB #CHO -200k Di cho
 *     + /clcb CASH #QUATANG -500k
 *     + /sodu, /ls, /limit, /undo, /chotso, /reset
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
  var existingGroupIds = props.getProperty("ALLOWED_GROUP_IDS") || "";
  if (existingSheetId === "OLD_DEPRECATED_SHEET_ID") {
    existingSheetId = "";
    existingSheetUrl = "";
    props.deleteProperty("SHEET_ID");
    props.deleteProperty("SHEET_URL");
  }

  var envData = {
    'APP_VERSION': '2.2.0',
    'BOT_TOKEN': 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
    'TELEGRAM_BOT_TOKEN': 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
    'ALLOWED_USER_IDS': 'YOUR_USER_ID_1, YOUR_USER_ID_2',
    'ADMIN_IDS': 'YOUR_USER_ID_1, YOUR_USER_ID_2',
    'ADMIN_CHAT_ID': 'YOUR_ADMIN_CHAT_ID_HERE',
    // DIEN ID NHOM TELEGRAM (VD: '-1001234567890') HOAC GO /id TRONG NHOM DE BAM NUT GHI DE TU DONG:
    'ALLOWED_GROUP_IDS': existingGroupIds || '',
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
