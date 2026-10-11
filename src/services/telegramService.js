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
  global.setTelegramWebhook = setTelegramWebhook;
  global.deleteTelegramWebhook = deleteTelegramWebhook;
  global.getTelegramWebhookInfo = getTelegramWebhookInfo;

  module.exports = {
    callTelegramApi: callTelegramApi,
    sendMessage: sendMessage,
    safeSendMessage: safeSendMessage,
    replyToMessage: replyToMessage,
    sendInlineKeyboard: sendInlineKeyboard,
    setTelegramWebhook: setTelegramWebhook,
    deleteTelegramWebhook: deleteTelegramWebhook,
    getTelegramWebhookInfo: getTelegramWebhookInfo
  };
}
