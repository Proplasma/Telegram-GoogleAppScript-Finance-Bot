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
  var isGroupChat = Number(chatId) < 0;
  var groupTitle = message.chat.title || "Nhóm Telegram";
  var userId = message.from ? message.from.id : chatId;
  var firstName = message.from ? message.from.first_name || "User" : "User";
  var userLabel = firstName + " (" + userId + ")";

  // Hỗ trợ đọc lệnh từ cả tin nhắn chữ (message.text) và chú thích ảnh Bill (message.caption)
  var rawText = String(message.text || message.caption || "").trim();
  var firstToken = rawText ? rawText.split(/\s+/)[0].split("@")[0].toLowerCase() : "";

  // 1. KIỂM TRA PHÂN QUYỀN TÀI KHOẢN & NHÓM (MULTI-USER & ALLOWED_GROUP_IDS)
  // Đặc quyền: Tài khoản Admin (trong ALLOWED_USER_IDS) luôn được phép gõ /id hoặc /setgroup ở bất kỳ Nhóm nào
  // để lấy ID Nhóm và bấm nút ghi đè vào thiết lập Bot ngay trên Telegram.
  var isAdminCaller = isAuthorizedUser(userId);
  var isGroupSetupCmd = isGroupChat && isAdminCaller && (firstToken === "/id" || firstToken === "/setgroup");

  if (!isGroupSetupCmd && !isAuthorizedAccess(userId, chatId)) {
    // Nếu ở trong Nhóm chưa cấp phép và chỉ là tin nhắn tán gẫu bình thường -> bỏ qua im lặng
    if (isGroupChat && (!rawText || rawText.charAt(0) !== "/")) {
      return null;
    }
    Logger.log("[Auth] Chan truy cap tu chat/user khong duoc phep: " + userLabel + " | chatId=" + chatId);
    return sendMessage(chatId, getUnauthorizedMessage());
  }

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
          "• <code>/chotso</code> • <code>/reset</code> : Chốt sổ / Reset về 0\n\n" +
          "• <code>/id</code> • <code>/setgroup</code> : Lấy ID & Cấp phép Nhóm" +
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
        reply_markup: buildMainReplyKeyboard(userId, chatId),
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
        reply_markup: buildMainReplyKeyboard(userId, chatId),
        disable_web_page_preview: true
      });

    case "/sodu":
    case "/balance":
      var balReport = buildBalanceReport();
      return safeSendMessage(chatId, balReport, {
        reply_markup: buildMainReplyKeyboard(userId, chatId),
        disable_web_page_preview: true
      });

    case "/ls":
    case "/history":
      var hisReport = buildRecentHistoryReport(5);
      return safeSendMessage(chatId, hisReport, {
        reply_markup: buildMainReplyKeyboard(userId, chatId),
        disable_web_page_preview: true
      });

    case "/limit":
      var limitRes = handleSetLimitCommand(argsText, userLabel);
      return safeSendMessage(chatId, limitRes, {
        reply_markup: buildMainReplyKeyboard(userId, chatId),
        disable_web_page_preview: true
      });

    case "/chotso":
    case "/renew":
      if (argsText && (argsText.toLowerCase() === "yes" || argsText.toLowerCase() === "confirm")) {
        var doneText = executeRenewPeriod(userLabel);
        return safeSendMessage(chatId, doneText, {
          reply_markup: buildMainReplyKeyboard(userId, chatId),
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
        reply_markup: buildMainReplyKeyboard(userId, chatId),
        disable_web_page_preview: true
      });

    case "/ping":
      return safeSendMessage(
        chatId,
        "🏓 <b>Pong!</b>\n\nBot <b>v" +
          escapeHtml(getAppVersion()) +
          "</b> đang hoạt động ổn định.\n\n<i>Chế độ Anti-Reply-Storm & Z Fold UI: Đang bật</i>",
        { reply_markup: buildMainReplyKeyboard(userId, chatId) }
      );

    case "/setgroup":
      if (!isGroupChat) {
        return safeSendMessage(
          chatId,
          "⚠️ Lệnh <code>/setgroup</code> chỉ dùng ở trong <b>Nhóm Telegram</b> để ghi đè ID Nhóm vào thiết lập Bot.\n\nHãy thêm Bot vào Nhóm, cấp quyền Admin rồi gõ <code>/setgroup</code> hoặc <code>/id</code> tại Nhóm đó.",
          { reply_markup: buildMainReplyKeyboard(userId, chatId) }
        );
      }
      if (!isAdminCaller) {
        return safeSendMessage(chatId, getUnauthorizedMessage());
      }
      setAllowedGroupId(chatId);
      return safeSendMessage(
        chatId,
        [
          "✅ <b>ĐÃ CẤP PHÉP & GHI ĐÈ ID NHÓM VÀO BOT</b>",
          "<blockquote>" +
            "• <b>Tên Nhóm:</b> " + escapeHtml(groupTitle) + "\n\n" +
            "• <b>Group ID:</b> <code>" + chatId + "</code>\n\n" +
            "• <b>Trạng thái:</b> 🟢 Đã kích hoạt cho toàn bộ thành viên trong Nhóm" +
            "</blockquote>",
          "👇 Bàn phím 3 nút điều khiển nhanh dưới đáy màn hình đã sẵn sàng!"
        ].join("\n\n"),
        { reply_markup: buildMainReplyKeyboard(userId, chatId) }
      );

    case "/id":
      if (isGroupChat) {
        var groupAuthorized = isAuthorizedGroup(chatId);
        var idGroupBlocks = [
          "🆔 <b>THÔNG TIN ĐỊNH DANH & NHÓM</b>",
          "<blockquote>" +
            "• <b>Tên Nhóm:</b> " + escapeHtml(groupTitle) + "\n\n" +
            "• <b>Group ID (Chat ID):</b> <code>" + chatId + "</code>\n\n" +
            "• <b>User ID của bạn:</b> <code>" + userId + "</code>\n\n" +
            "• <b>Trạng thái Nhóm:</b> " +
            (groupAuthorized ? "🟢 Đã được cấp phép" : "🔴 Chưa cấp phép") +
            "</blockquote>"
        ];

        if (isAdminCaller) {
          idGroupBlocks.push(
            "💡 <i>Bấm nút bên dưới để ghi đè mã Group ID này vào thiết lập Bot ngay lập tức:</i>"
          );
          return safeSendMessage(chatId, idGroupBlocks.join("\n\n"), {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Cấp phép & Ghi đè ID Nhóm này vào Bot",
                    callback_data: "group_auth:set:" + chatId
                  }
                ],
                [
                  {
                    text: "🚫 Gỡ quyền Nhóm này",
                    callback_data: "group_auth:remove:" + chatId
                  }
                ]
              ]
            }
          });
        }

        return safeSendMessage(chatId, idGroupBlocks.join("\n\n"), {
          reply_markup: buildMainReplyKeyboard(userId, chatId)
        });
      }

      return safeSendMessage(
        chatId,
        "🆔 <b>THÔNG TIN ĐỊNH DANH CỦA BẠN:</b>\n\n" +
          "• <b>User ID:</b> <code>" +
          userId +
          "</code>\n\n" +
          "• <b>Chat ID:</b> <code>" +
          chatId +
          "</code>\n\n" +
          "• <b>Group ID đã cấp phép:</b> <code>" +
          escapeHtml(getConfig().allowedGroupIds) +
          "</code>",
        { reply_markup: buildMainReplyKeyboard(userId, chatId) }
      );

    case "/status":
      var cfg = getConfig();
      var driveSt = checkDrivePermissionStatus();
      var stBlocks = [
        "🛡️ <b>TRẠNG THÁI HỆ THỐNG BOT</b>",
        "<blockquote>" +
          "• <b>Phiên bản:</b> v" + escapeHtml(cfg.appVersion) + " (Z Fold UI)\n\n" +
          "• <b>Bot:</b> @" + escapeHtml(cfg.botUsername) + "\n\n" +
          "• <b>Allowed Users:</b> <code>" + escapeHtml(cfg.adminIds) + "</code>\n\n" +
          "• <b>Allowed Groups:</b> <code>" + escapeHtml(cfg.allowedGroupIds) + "</code>\n\n" +
          "• <b>Cầu chì:</b> " + (cfg.emergencyStop ? "🔴 ĐANG KHÓA" : "🟢 Hoạt động") + "\n\n" +
          "• <b>Database:</b> " + (cfg.sheetId ? "Đã kết nối" : "Chưa tạo") + "\n\n" +
          "• <b>Google Drive:</b> " + (driveSt.authorized ? "Đã cấp quyền" : "Chưa cấp quyền") +
          "</blockquote>"
      ];
      if (cfg.sheetUrl) {
        stBlocks.push("📊 <a href=\"" + escapeHtml(cfg.sheetUrl) + "\">Mở bảng Google Sheets</a>");
      }
      return safeSendMessage(chatId, stBlocks.join("\n\n"), {
        reply_markup: buildMainReplyKeyboard(userId, chatId),
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
          "</code> chưa được hỗ trợ.\n\nGõ /help hoặc bấm các nút dưới đáy màn hình để thao tác.",
        { reply_markup: buildMainReplyKeyboard(userId, chatId) }
      );
  }
}

/**
 * Xử lý sự kiện bấm nút Inline Keyboard (Hoàn tác giao dịch / Xác nhận chốt sổ / Cấp phép Nhóm / Wizard 4 bước)
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

  var data = String(callbackQuery.data || "");

  // Xử lý nút Cấp phép / Gỡ quyền Nhóm ("group_auth:set:<groupId>" | "group_auth:remove:<groupId>")
  // Chỉ tài khoản Admin trong ALLOWED_USER_IDS mới được bấm nút này
  if (data.indexOf("group_auth:") === 0) {
    if (!isAuthorizedUser(userId)) {
      callTelegramApi("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "⚠️ Chỉ Admin mới có quyền cấp phép Nhóm!",
        show_alert: true
      });
      return null;
    }

    var gParts = data.split(":");
    var gAction = gParts[1] || "";
    var targetGroupId = gParts[2] || String(chatId);

    if (gAction === "set") {
      setAllowedGroupId(targetGroupId);
      callTelegramApi("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "✅ Đã lưu đè ID Nhóm (" + targetGroupId + ") vào thiết lập Bot!"
      });
      return safeSendMessage(
        chatId,
        [
          "✅ <b>ĐÃ CẤP PHÉP & GHI ĐÈ ID NHÓM VÀO BOT</b>",
          "<blockquote>" +
            "• <b>Group ID đã lưu:</b> <code>" + escapeHtml(targetGroupId) + "</code>\n\n" +
            "• <b>Trạng thái:</b> 🟢 Nhóm đã được kích hoạt toàn quyền" +
            "</blockquote>",
          "👇 Bây giờ mọi thành viên trong Nhóm đều có thể gõ lệnh hoặc dùng 3 nút dưới đáy màn hình!"
        ].join("\n\n"),
        { reply_markup: buildMainReplyKeyboard(userId, chatId) }
      );
    }

    if (gAction === "remove") {
      removeAllowedGroupId(targetGroupId);
      callTelegramApi("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "🚫 Đã gỡ quyền Nhóm (" + targetGroupId + ") khỏi thiết lập Bot!"
      });
      return safeSendMessage(
        chatId,
        "🚫 <b>ĐÃ GỠ QUYỀN NHÓM KHỎI THIẾT LẬP BOT</b>\n\nGroup ID <code>" +
          escapeHtml(targetGroupId) +
          "</code> đã bị xóa khỏi danh sách <code>ALLOWED_GROUP_IDS</code>."
      );
    }
  }

  // Kiểm tra quyền truy cập chung (User nằm trong ALLOWED_USER_IDS hoặc đang ở trong Group đã cấp phép)
  if (!isAuthorizedAccess(userId, chatId) && !isAuthorizedUser(userId)) {
    callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: getUnauthorizedMessage(),
      show_alert: true
    });
    return null;
  }

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
