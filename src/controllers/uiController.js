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
 * Hàng 1 luôn là nút "📱 Open UI Mode" mở trực tiếp Telegram Mini App / Web App
 * @param {string|number} userId
 * @returns {object} reply_markup
 */
function buildMainReplyKeyboard(userId) {
  var uiUrl = getWebAppUiUrl(userId);
  var openUiButton = uiUrl
    ? { text: "📱 Open UI Mode", web_app: { url: uiUrl } }
    : { text: "📱 Open UI Mode" };

  return {
    keyboard: [
      [openUiButton],
      [{ text: "➕ Ghi Thu / Chi" }, { text: "📊 Xem Số Dư" }],
      [{ text: "📜 5 GD Gần Nhất" }, { text: "↩️ Hoàn Tác (Undo)" }],
      [{ text: "🎯 Đặt Hạn Mức" }, { text: "📅 Chốt Sổ / Reset" }]
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

  var dirLabel = state.sign === "-" ? "CHI RA (-)" : "THU VAO (+)";
  var summaryBox = renderBoxTable(
    [
      { label: "Quy ghi chep", value: "/" + state.fund + " (" + dirLabel + ")" },
      { label: "Ngan hang", value: state.bank },
      { label: "Phan loai", value: state.tag }
    ],
    14,
    23
  );

  var text =
    "🧮 <b>GHI THU / CHI TỪNG BƯỚC (BƯỚC 4/4)</b>\n\n" +
    "<pre>" +
    escapeHtml(summaryBox) +
    "</pre>\n\n" +
    "✍️ <b>Hãy gõ vào ô chat:</b> <code>&lt;Số tiền hoặc Phép tính&gt; [Ghi chú]</code>\n" +
    "• Ví dụ 1: <code>55k mua trà đào</code>\n" +
    "• Ví dụ 2 (Nhân/Chia/Cộng/Trừ): <code>(120k+30k)/3 ăn trưa chia 3</code>\n" +
    "• 📸 Hoặc gửi <b>Ảnh Bill</b> kèm chú thích số tiền.";

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

  var box = renderBoxTable(
    [
      { label: "GD Quy Ca Nhan", value: pRows.length + " dong (" + formatCurrency(pStats.totalBalance, false) + ")" },
      { label: "GD Quy Phu", value: sRows.length + " dong (" + formatCurrency(sStats.totalBalance, false) + ")" }
    ],
    15,
    24
  );

  var text =
    "📅 <b>QUẢN TRỊ SỔ CUỐI KỲ (/chotso & /reset)</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>\n\n" +
    "1️⃣ <b>Chốt Sổ Tháng Mới (/chotso):</b> Chuyển toàn bộ giao dịch hiện tại vào bảng <i>Lịch Sử Chốt Sổ</i>, giữ nguyên số dư hiện tại làm Số dư đầu kỳ mới.\n" +
    "2️⃣ <b>Reset Về 0 (/reset):</b> Chuyển toàn bộ giao dịch hiện tại vào bảng <i>Lịch Sử Chốt Sổ</i> (bảo toàn 100% lịch sử) và đưa số dư hiện tại về 0 đ.";

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

  // 2. Xử lý các nút bấm cố định trên Reply Keyboard dưới đáy màn hình (hỗ trợ cả bản có icon và không icon)
  if (
    clean === "📱 Open UI Mode" ||
    clean === "Open UI Mode" ||
    clean === "/ui" ||
    clean === "/menu"
  ) {
    setWizardState(chatId, null);
    var uiUrl = getWebAppUiUrl(userId);
    var msgText =
      "📱 <b>BẢNG ĐIỀU KHIỂN ĐỒ HỌA (OPEN UI MODE)</b>\n\n" +
      "• Bấm nút <b>📱 Open UI Mode</b> ở bàn phím dưới đáy màn hình hoặc nút bên dưới để mở giao diện 3 Tab (tích hợp Máy tính <code>+ - × ÷</code> và tải Ảnh Bill lên Google Drive).";

    if (uiUrl) {
      safeSendMessage(chatId, msgText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 Mở Bảng Điều Khiển (Open UI Mode)", web_app: { url: uiUrl } }]
          ]
        }
      });
    }
    return safeSendMessage(
      chatId,
      "✅ Đã cập nhật bàn phím điều khiển nhanh dưới đáy màn hình.",
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

  if (clean === "📊 Xem Số Dư" || clean === "Xem Số Dư") {
    setWizardState(chatId, null);
    var balReport = buildBalanceReport();
    return safeSendMessage(chatId, balReport, {
      reply_markup: buildMainReplyKeyboard(userId),
      disable_web_page_preview: true
    });
  }

  if (clean === "📜 5 GD Gần Nhất" || clean === "5 GD Gần Nhất") {
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
