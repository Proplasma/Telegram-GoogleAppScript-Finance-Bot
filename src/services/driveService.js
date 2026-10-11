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

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.extractPhotoFileIdFromMsg = extractPhotoFileIdFromMsg;
  global.savePendingPhotoFromMessage = savePendingPhotoFromMessage;
  global.consumePendingPhotoFileId = consumePendingPhotoFileId;
  global.resolveBillPhotoFileId = resolveBillPhotoFileId;
  global.getOrCreateBillFolder = getOrCreateBillFolder;
  global.checkDrivePermissionStatus = checkDrivePermissionStatus;
  global.uploadBillPhotoFromMessage = uploadBillPhotoFromMessage;

  module.exports = {
    extractPhotoFileIdFromMsg: extractPhotoFileIdFromMsg,
    savePendingPhotoFromMessage: savePendingPhotoFromMessage,
    consumePendingPhotoFileId: consumePendingPhotoFileId,
    resolveBillPhotoFileId: resolveBillPhotoFileId,
    getOrCreateBillFolder: getOrCreateBillFolder,
    checkDrivePermissionStatus: checkDrivePermissionStatus,
    uploadBillPhotoFromMessage: uploadBillPhotoFromMessage
  };
}
