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
    var errBox = renderBoxTable(
      [
        { label: "Lenh chuan", value: cmdName + " <Bank> [#TAG] <Tien> [Ghi chu]" },
        { label: "Thu (+)", value: cmdName + " Techcombank #LUONG 15tr" },
        { label: "Chi (-)", value: cmdName + " Techcombank #TRADA -50k" },
        { label: "Phep tinh", value: cmdName + " MB #ANUONG -(120k+30k)/3" },
        { label: "Mac dinh", value: "Khong ghi Bank -> Chung, Tag -> #CHUNG" }
      ],
      13,
      28
    );

    return safeSendMessage(
      chatId,
      "⚠️ <b>CÚ PHÁP LỆNH " +
        cmdName.toUpperCase() +
        " CHƯA ĐÚNG</b>\n\n" +
        parsedTx.error +
        "\n\n<pre>" +
        escapeHtml(errBox) +
        "</pre>"
    );
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
      var cmdTable = renderBoxTable(
        [
          { label: "Open UI Mode", value: "Bang dieu khien do hoa 3 Tab" },
          { label: "/ghi", value: "Chon nut tung buoc trong Chat" },
          "SEPARATOR",
          { label: "/c", value: "Ghi Thu/Chi Quy Ca Nhan" },
          { label: "/lcb", value: "Ghi Thu/Chi Quy Phu" },
          { label: "/clcb", value: "Ghi dong thoi ca 2 Quy" },
          "SEPARATOR",
          { label: "/sodu", value: "Xem so du (/balance)" },
          { label: "/ls", value: "5 GD gan nhat (/history)" },
          { label: "/limit", value: "Dat han muc #Tag" },
          { label: "/undo", value: "Hoan tac GD vua nhap" },
          { label: "/chotso", value: "Chot so giu du (/renew)" },
          { label: "/reset", value: "Luu so & Reset du ve 0" },
          "SEPARATOR",
          { label: "/status", value: "Trang thai Bot & Sheet" },
          { label: "/id", value: "Xem User ID & Chat ID" }
        ],
        12,
        25
      );

      var syntaxTable = renderBoxTable(
        [
          { label: "Cau truc", value: "/c <Bank> [#TAG] <Tien> [Note]" },
          { label: "Thu (+)", value: "/c Techcombank #LUONG 15tr" },
          { label: "Chi (-)", value: "/c Techcombank #TRADA -50k" },
          { label: "Phep tinh", value: "/c MB #ANUONG -(120k+30k)/3" },
          { label: "Quy phu", value: "/lcb MB #CHO -200k Di cho" },
          { label: "Ca 2 quy", value: "/clcb CASH #QUATANG -500k" },
          { label: "Han muc", value: "/limit #TRADA 200k" },
          { label: "Reset 0", value: "/reset (Luu su & ve 0 het)" }
        ],
        11,
        29
      );

      var helpMsg =
        "🚀 <b>SUPER FINANCE GAS BOT  |  v" +
        escapeHtml(getAppVersion()) +
        " (HYBRID UI)</b>\n" +
        "Xin chào <b>" +
        escapeHtml(firstName) +
        "</b>! Hệ thống hỗ trợ song song cả <b>📱 Giao diện Đồ họa (Open UI Mode)</b>, <b>➕ Nút chọn từng bước</b> và <b>⌨️ Dòng lệnh truyền thống</b>.\n\n" +
        "📋 <b>1. DANH MỤC TÍNH NĂNG & LỆNH:</b>\n" +
        "<pre>" +
        escapeHtml(cmdTable) +
        "</pre>\n\n" +
        "🧮 <b>2. VÍ DỤ CÚ PHÁP NHẬP NHANH (HỖ TRỢ + - * /):</b>\n" +
        "<pre>" +
        escapeHtml(syntaxTable) +
        "</pre>\n\n" +
        "📱 <b>Mở Giao Diện UI:</b> Bấm nút <b>📱 Open UI Mode</b> trên bàn phím cố định ở dưới đáy màn hình.";

      if (sheetUrl) {
        helpMsg += "\n\n📂 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở File Google Sheets của Bot</a>";
      }

      return safeSendMessage(chatId, helpMsg, {
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
        reply_markup: buildMainReplyKeyboard(userId)
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
        reply_markup: buildMainReplyKeyboard(userId)
      });

    case "/chotso":
    case "/renew":
      if (argsText && (argsText.toLowerCase() === "yes" || argsText.toLowerCase() === "confirm")) {
        var doneText = executeRenewPeriod(userLabel);
        return safeSendMessage(chatId, doneText, {
          reply_markup: buildMainReplyKeyboard(userId)
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
        "🏓 <b>Pong!</b> Bot <b>v" +
          escapeHtml(getAppVersion()) +
          "</b> đang hoạt động ổn định.\n<i>Chế độ Anti-Reply-Storm & Hybrid UI: Đang bật</i>",
        { reply_markup: buildMainReplyKeyboard(userId) }
      );

    case "/id":
      return safeSendMessage(
        chatId,
        "🆔 <b>THÔNG TIN ĐỊNH DANH CỦA BẠN:</b>\n\n" +
          "• <b>User ID:</b> <code>" +
          userId +
          "</code>\n" +
          "• <b>Chat ID:</b> <code>" +
          chatId +
          "</code>",
        { reply_markup: buildMainReplyKeyboard(userId) }
      );

    case "/status":
      var cfg = getConfig();
      var driveSt = checkDrivePermissionStatus();
      var stBox = renderBoxTable(
        [
          { label: "Phien ban", value: "v" + cfg.appVersion + " (Hybrid UI)" },
          { label: "Bot", value: "@" + cfg.botUsername },
          { label: "Allowed IDs", value: cfg.adminIds },
          { label: "Cau chi", value: cfg.emergencyStop ? "DANG KHOA" : "Hoat dong" },
          { label: "Database", value: cfg.sheetId ? "Da ket noi" : "Chua tao" },
          { label: "Google Drive", value: driveSt.authorized ? "Da cap quyen" : "Chua cap quyen" }
        ],
        13,
        24
      );
      var stMsg =
        "🛡️ <b>TRẠNG THÁI HỆ THỐNG BOT</b>\n\n" +
        "<pre>" +
        escapeHtml(stBox) +
        "</pre>";
      if (cfg.sheetUrl) {
        stMsg += "\n\n📂 <a href=\"" + escapeHtml(cfg.sheetUrl) + "\">Mở File Google Sheets</a>";
      }
      return safeSendMessage(chatId, stMsg, {
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
