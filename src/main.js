// main.js //
/**
 * ============================================================
 * SUPER FINANCE GAS BOT (@SuperFinanceGAS_bot) - WEBHOOK ENTRY POINT
 * Phiên bản: 2.1.1 | Kiến trúc SOLID
 * Lưu ý: Hàm ActivateBot(), setupEnvironment() và mục điền WEBAPP_URL
 * nằm tại file đầu tiên: F1ActivateBot.js
 * ============================================================
 */

/**
 * Điểm tiếp nhận GET Request (Kiểm tra trạng thái Web App & Quyền Drive trên trình duyệt)
 */
function doGet(e) {
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
    // Nhận tất cả updateData.message (cả text, caption, photo, document) để bắt cả ảnh gửi rời lẫn ảnh kèm lệnh
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
