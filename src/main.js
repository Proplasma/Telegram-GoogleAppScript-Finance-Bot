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
      var chatId = params.chatId || "";
      var initData =
        typeof getWebAppInitialData === "function"
          ? getWebAppInitialData(uid, chatId)
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
