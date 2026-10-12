// financeService.js //
/**
 * ============================================================
 * MODULE: FINANCE SERVICE (SRP)
 * Chuyên trách toàn bộ nghiệp vụ Quản lý Thu Chi:
 * - /c (Quỹ Cá Nhân), /lcb (Quỹ Phụ), /clcb (Đồng thời cả 2 quỹ)
 * - /undo (Hoàn tác giao dịch bằng lệnh hoặc nút Inline)
 * - /sodu, /balance (Bảng cân đối theo Ngân hàng & #Tag)
 * - /ls, /history (Lịch sử 5 giao dịch gần nhất kèm link Bill)
 * - /limit (Đặt & kiểm tra hạn mức chi tiêu theo #Tag)
 * - /chotso, /renew (Chốt sổ cuối kỳ sang bảng Lịch Sử, giữ số dư đầu kỳ)
 * - /reset (Chuyển toàn bộ giao dịch về bảng Lịch Sử Chốt Sổ, đưa số dư về 0)
 * ============================================================
 */

/**
 * Sinh mã giao dịch duy nhất (VD: TX849201)
 * @returns {string}
 */
function generateTxId() {
  var rand = Math.floor(100000 + Math.random() * 900000);
  return "TX" + rand;
}

/**
 * Tính toán thống kê tổng hợp từ danh sách dòng giao dịch của một bảng
 * @param {Array<object>} rows
 * @returns {object} { totalBalance, byBank, byTag, spentByTag }
 */
function calculateSheetStats(rows) {
  var totalBalance = 0;
  var byBank = {};
  var byTag = {};
  var spentByTag = {}; // Tổng số tiền đã CHI (số dương) của từng #Tag để so với Hạn mức

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var amt = Number(r.amount) || 0;
    var bankKey = String(r.bank || "Chung").trim();
    var tagKey = normalizeTag(r.tag || "#CHUNG");

    totalBalance += amt;
    byBank[bankKey] = (byBank[bankKey] || 0) + amt;
    byTag[tagKey] = (byTag[tagKey] || 0) + amt;

    if (amt < 0 && r.note !== "Số dư đầu kỳ") {
      spentByTag[tagKey] = (spentByTag[tagKey] || 0) + Math.abs(amt);
    }
  }

  return {
    totalBalance: totalBalance,
    byBank: byBank,
    byTag: byTag,
    spentByTag: spentByTag
  };
}

/**
 * Tạo dòng thông báo kiểm tra Hạn mức (/limit) cho một #Tag (Tối giản, dịu mắt cho Z Fold)
 * @param {string} tag
 * @param {number} spentAmount
 * @returns {string}
 */
function buildLimitAlertText(tag, spentAmount) {
  var limitsMap = getAllTagLimits();
  var normTag = normalizeTag(tag);
  var limitVal = limitsMap[normTag];
  if (!limitVal || limitVal <= 0) {
    return "";
  }

  var spent = Number(spentAmount) || 0;
  var percent = Math.round((spent / limitVal) * 100);
  var remain = limitVal - spent;

  var statusLabel = "An toàn";
  if (percent >= 100) {
    statusLabel = "Vượt hạn mức";
  } else if (percent >= 80) {
    statusLabel = "Sắp chạm trần";
  }

  return (
    "<blockquote>" +
    "🎯 <b>Hạn mức <code>" +
    escapeHtml(normTag) +
    "</code>:</b> " +
    escapeHtml(formatCurrency(limitVal, false)) +
    "\n\n" +
    "• Đã chi: " +
    escapeHtml(formatCurrency(spent, false)) +
    " (" +
    percent +
    "%)\n\n" +
    "• Còn lại: <b>" +
    escapeHtml(formatCurrency(remain, false)) +
    "</b> <i>(" +
    statusLabel +
    ")</i>" +
    "</blockquote>"
  );
}

/**
 * Ghi nhận giao dịch mới cho /c, /lcb hoặc /clcb
 * Giao diện tối ưu cho màn hình hẹp Samsung Galaxy Z Fold (cách 1 dòng trắng giữa mỗi dòng)
 * @param {string} mode - "c" | "lcb" | "clcb"
 * @param {object} parsedTx - Kết quả từ parseTransactionArgs()
 * @param {string} userLabel - Tên & ID người nhập
 * @param {object|string} billInfo - { hasPhoto, billUrl, error } hoặc chuỗi billUrl
 * @returns {object} { text, replyMarkup }
 */
function executeFinanceTransaction(mode, parsedTx, userLabel, billInfo) {
  var txId = generateTxId();
  var nowStr = getNowFormatted();

  var billUrl = "";
  var billError = "";
  var hasPhoto = false;

  if (typeof billInfo === "string") {
    billUrl = billInfo;
    hasPhoto = Boolean(billInfo);
  } else if (billInfo && typeof billInfo === "object") {
    billUrl = billInfo.billUrl || "";
    billError = billInfo.error || "";
    hasPhoto = Boolean(billInfo.hasPhoto);
  }

  var txRecord = {
    txId: txId,
    time: nowStr,
    user: userLabel,
    bank: parsedTx.bank,
    tag: parsedTx.tag,
    rawAmount: parsedTx.rawAmount,
    amount: parsedTx.amount,
    note: parsedTx.note,
    billUrl: billUrl
  };

  var isIncome = parsedTx.amount >= 0;
  var amountFormatted = formatCurrency(parsedTx.amount, true);
  var flowLine = isIncome
    ? "🟢 <b>Thu vào:</b> <code>" + escapeHtml(amountFormatted) + "</code>"
    : "🔴 <b>Chi ra:</b> <code>" + escapeHtml(amountFormatted) + "</code>";

  var titleHeader = "";
  var balanceQuote = "";
  var limitSection = "";

  if (mode === "c") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));

    titleHeader = "✅ <b>GHI NHẬN GIAO DỊCH (/c)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code>: <b>" +
      escapeHtml(formatCurrency(cStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư " +
      escapeHtml(parsedTx.bank) +
      ": <b>" +
      escapeHtml(formatCurrency(cStats.byBank[parsedTx.bank] || 0, false)) +
      "</b>\n\n" +
      "💎 <b>Tổng Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(cStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, cStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "lcb") {
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);
    var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "✅ <b>GHI NHẬN GIAO DỊCH (/lcb)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code>: <b>" +
      escapeHtml(formatCurrency(lcbStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư " +
      escapeHtml(parsedTx.bank) +
      ": <b>" +
      escapeHtml(formatCurrency(lcbStats.byBank[parsedTx.bank] || 0, false)) +
      "</b>\n\n" +
      "💎 <b>Tổng Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(lcbStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, lcbStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "clcb") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);

    var bothPersonalStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
    var bothSubStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "✅ <b>GHI ĐỒNG THỜI 2 QUỸ (/clcb)</b>";
    balanceQuote =
      "<blockquote>" +
      "💰 <b>SỐ DƯ SAU GIAO DỊCH</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code> (/c): <b>" +
      escapeHtml(formatCurrency(bothPersonalStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "• Dư <code>" +
      escapeHtml(parsedTx.tag) +
      "</code> (/lcb): <b>" +
      escapeHtml(formatCurrency(bothSubStats.byTag[parsedTx.tag] || 0, false)) +
      "</b>\n\n" +
      "📘 <b>Tổng Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(bothPersonalStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Tổng Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(bothSubStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>";

    limitSection = buildLimitAlertText(parsedTx.tag, bothPersonalStats.spentByTag[parsedTx.tag] || 0);
  }

  // Mỗi dòng phản hồi cách nhau 1 dòng trắng (\n\n) để thoáng mắt trên Samsung Z Fold
  var messageBlocks = [
    titleHeader,
    flowLine,
    "🧮 <b>Phép tính:</b> <code>" + escapeHtml(String(parsedTx.rawAmount || parsedTx.amount)) + "</code>",
    "🏦 <b>Ngân hàng:</b> " + escapeHtml(parsedTx.bank),
    "🏷️ <b>Phân loại:</b> <code>" + escapeHtml(parsedTx.tag) + "</code>",
    "📝 <b>Ghi chú:</b> " + escapeHtml(parsedTx.note),
    "🆔 <b>Mã GD:</b> <code>" + escapeHtml(txId) + "</code>",
    balanceQuote
  ];

  if (limitSection) {
    messageBlocks.push(limitSection);
  }

  // Tách riêng mục Ảnh Hóa Đơn (Bill) và Mở bảng Google Sheets cách nhau 1 dòng trắng
  if (billUrl) {
    var linkLabel =
      billUrl.indexOf("drive.google.com") > -1
        ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
        : "🖼 Mở xem file ảnh hóa đơn (Bill)";
    messageBlocks.push(
      "📸 <b>ẢNH HÓA ĐƠN (BILL):</b>\n<a href=\"" + escapeHtml(billUrl) + "\">" + linkLabel + "</a>"
    );
  }

  if (hasPhoto && billError) {
    messageBlocks.push(
      "⚠️ <i>Lưu ý Google Drive: " +
        escapeHtml(billError) +
        " (Mở GAS Editor -> Chọn hàm ActivateBot hoặc GrantAllPermissions -> Bấm Run để cấp quyền Drive).</i>"
    );
  }

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    messageBlocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  var replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "↩️ Hoàn tác giao dịch (" + txId + ")",
          callback_data: "undo_tx:" + mode + ":" + txId
        }
      ]
    ]
  };

  return {
    text: messageBlocks.join("\n\n"),
    replyMarkup: replyMarkup
  };
}

/**
 * Hoàn tác (Undo) giao dịch gần nhất hoặc theo Mã GD cụ thể
 * @param {string} [targetMode] - "c" | "lcb" | "clcb"
 * @param {string} [specificTxId] - Mã GD cụ thể khi bấm nút Inline
 * @returns {string} Nội dung thông báo kết quả
 */
function executeUndoTransaction(targetMode, specificTxId) {
  var mode = String(targetMode || "c").trim().toLowerCase();
  var deletedPersonal = null;
  var deletedSub = null;

  if (specificTxId) {
    if (mode === "c" || mode === "clcb") {
      deletedPersonal = deleteTransactionByTxId(SHEET_NAMES.PERSONAL, specificTxId);
    }
    if (mode === "lcb" || mode === "clcb") {
      deletedSub = deleteTransactionByTxId(SHEET_NAMES.SUB_FUND, specificTxId);
    }
  } else {
    if (mode === "lcb") {
      deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
    } else if (mode === "clcb") {
      deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
      deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
    } else {
      var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
      var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);
      var lastP = pRows.length > 0 ? pRows[pRows.length - 1] : null;
      var lastS = sRows.length > 0 ? sRows[sRows.length - 1] : null;

      if (lastP && lastS && lastP.txId && lastP.txId === lastS.txId) {
        deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
        deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
        mode = "clcb";
      } else if (lastP) {
        deletedPersonal = deleteLastTransactionRow(SHEET_NAMES.PERSONAL);
        mode = "c";
      } else if (lastS) {
        deletedSub = deleteLastTransactionRow(SHEET_NAMES.SUB_FUND);
        mode = "lcb";
      }
    }
  }

  var sample = deletedPersonal || deletedSub;
  if (!sample) {
    return "⚠️ <b>KHÔNG TÌM THẤY GIAO DỊCH ĐỂ HOÀN TÁC</b>\n\nGiao dịch này đã được xóa trước đó hoặc bảng đang trống.";
  }

  var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

  var scopeName =
    deletedPersonal && deletedSub
      ? "Cả 2 Quỹ (/clcb)"
      : deletedPersonal
      ? "Quỹ Cá Nhân (/c)"
      : "Quỹ Phụ (/lcb)";

  var blocks = [
    "↩️ <b>ĐÃ HOÀN TÁC GIAO DỊCH</b>",
    "🆔 <b>Mã GD xóa:</b> <code>" + escapeHtml(sample.txId || "N/A") + "</code>",
    "📂 <b>Phạm vi:</b> " + escapeHtml(scopeName),
    "🏦 <b>Ngân hàng:</b> " + escapeHtml(sample.bank) + "  •  <code>" + escapeHtml(sample.tag) + "</code>",
    "💰 <b>Số tiền xóa:</b> <code>" + escapeHtml(formatCurrency(sample.amount, true)) + "</code>",
    "📝 <b>Ghi chú:</b> " + escapeHtml(sample.note),
    "<blockquote>" +
      "💎 <b>SỐ DƯ CẬP NHẬT</b>\n\n" +
      "📘 <b>Quỹ Cá Nhân:</b> <code>" +
      escapeHtml(formatCurrency(cStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Quỹ Phụ:</b> <code>" +
      escapeHtml(formatCurrency(lcbStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Tạo báo cáo Số dư tổng hợp (/sodu hoặc /balance)
 * Tối ưu hiển thị thoáng dòng cho Samsung Galaxy Z Fold
 * @returns {string}
 */
function buildBalanceReport() {
  var personalRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var subRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(personalRows);
  var sStats = calculateSheetStats(subRows);
  var limitsMap = getAllTagLimits();

  var overviewBlock =
    "<blockquote>" +
    "💰 <b>1. TỔNG QUAN HAI QUỸ</b>\n\n" +
    "📘 <b>Quỹ Cá Nhân (/c):</b> <code>" +
    escapeHtml(formatCurrency(pStats.totalBalance, false)) +
    "</code>\n\n" +
    "📙 <b>Quỹ Phụ (/lcb):</b> <code>" +
    escapeHtml(formatCurrency(sStats.totalBalance, false)) +
    "</code>" +
    "</blockquote>";

  var bankLines = ["🏦 <b>2. THEO NGÂN HÀNG (QUỸ CÁ NHÂN)</b>"];
  var bankKeys = Object.keys(pStats.byBank);
  if (bankKeys.length === 0) {
    bankLines.push("• <b>Mặc định:</b> 0 đ");
  } else {
    for (var i = 0; i < bankKeys.length; i++) {
      var bName = bankKeys[i];
      bankLines.push(
        "• <b>" +
          escapeHtml(bName) +
          ":</b> " +
          escapeHtml(formatCurrency(pStats.byBank[bName], false))
      );
    }
  }
  var bankBlock = "<blockquote>" + bankLines.join("\n\n") + "</blockquote>";

  var tagLines = ["🏷️ <b>3. THEO PHÂN LOẠI (#TAG)</b>"];
  var tagKeys = Object.keys(pStats.byTag);
  if (tagKeys.length === 0) {
    tagLines.push("• <b>Mặc định:</b> 0 đ");
  } else {
    for (var j = 0; j < tagKeys.length; j++) {
      var tName = tagKeys[j];
      var tBal = formatCurrency(pStats.byTag[tName], false);
      var lineStr = "• <code>" + escapeHtml(tName) + "</code>: <b>" + escapeHtml(tBal) + "</b>";
      if (limitsMap[tName]) {
        var spent = pStats.spentByTag[tName] || 0;
        var remain = limitsMap[tName] - spent;
        lineStr +=
          "\n  <i>(Hạn mức còn: " + escapeHtml(formatCurrency(remain, false)) + ")</i>";
      }
      tagLines.push(lineStr);
    }
  }
  var tagBlock = "<blockquote>" + tagLines.join("\n\n") + "</blockquote>";

  var parts = [
    "📊 <b>BÁO CÁO SỐ DƯ TÀI CHÍNH</b>",
    overviewBlock,
    bankBlock,
    tagBlock
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    parts.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return parts.join("\n\n");
}

/**
 * Xem lại 5 giao dịch gần nhất (/ls hoặc /history)
 * Tối ưu hiển thị thoáng dòng cho Samsung Galaxy Z Fold
 * @param {number} [limitCount=5]
 * @returns {string}
 */
function buildRecentHistoryReport(limitCount) {
  var count = limitCount || 5;
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var recentP = pRows.slice(-count).reverse();
  var recentS = sRows.slice(-count).reverse();

  var parts = ["📜 <b>" + count + " GIAO DỊCH GẦN NHẤT</b>"];

  parts.push("📘 <b>1. QUỸ CÁ NHÂN (/c)</b>");
  if (recentP.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var i = 0; i < recentP.length; i++) {
      var item = recentP[i];
      var iconP = Number(item.amount) >= 0 ? "🟢" : "🔴";
      var linesP = [
        iconP +
          " <b><code>" +
          escapeHtml(formatCurrency(item.amount, true)) +
          "</code></b>  •  <code>" +
          escapeHtml(item.tag) +
          "</code>",
        "🏦 " + escapeHtml(item.bank) + "  •  🕒 " + escapeHtml(item.time),
        "📝 " + escapeHtml(item.note)
      ];
      if (item.billUrl) {
        var billLabelP =
          item.billUrl.indexOf("drive.google.com") > -1
            ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
            : "🖼 Mở xem ảnh hóa đơn (Bill)";
        linesP.push("<a href=\"" + escapeHtml(item.billUrl) + "\">" + billLabelP + "</a>");
      }
      parts.push("<blockquote>" + linesP.join("\n\n") + "</blockquote>");
    }
  }

  parts.push("📙 <b>2. QUỸ PHỤ (/lcb)</b>");
  if (recentS.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var j = 0; j < recentS.length; j++) {
      var sItem = recentS[j];
      var iconS = Number(sItem.amount) >= 0 ? "🟢" : "🔴";
      var linesS = [
        iconS +
          " <b><code>" +
          escapeHtml(formatCurrency(sItem.amount, true)) +
          "</code></b>  •  <code>" +
          escapeHtml(sItem.tag) +
          "</code>",
        "🏦 " + escapeHtml(sItem.bank) + "  •  🕒 " + escapeHtml(sItem.time),
        "📝 " + escapeHtml(sItem.note)
      ];
      if (sItem.billUrl) {
        var billLabelS =
          sItem.billUrl.indexOf("drive.google.com") > -1
            ? "🖼 Mở xem ảnh hóa đơn (Bill) trên Google Drive"
            : "🖼 Mở xem ảnh hóa đơn (Bill)";
        linesS.push("<a href=\"" + escapeHtml(sItem.billUrl) + "\">" + billLabelS + "</a>");
      }
      parts.push("<blockquote>" + linesS.join("\n\n") + "</blockquote>");
    }
  }

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    parts.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return parts.join("\n\n");
}

/**
 * Xử lý đặt hạn mức chi tiêu cho một #Tag (/limit #TRADA 200k)
 * @param {string} argsText
 * @param {string} userLabel
 * @returns {string}
 */
function handleSetLimitCommand(argsText, userLabel) {
  var parsed = parseLimitArgs(argsText);
  if (!parsed.valid) {
    return "⚠️ <b>CÚ PHÁP HẠN MỨC CHƯA ĐÚNG</b>\n\n" + parsed.error;
  }

  upsertTagLimit(parsed.tag, parsed.limitAmount, userLabel);

  var pStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var currentSpent = pStats.spentByTag[parsed.tag] || 0;
  var percent = Math.round((currentSpent / parsed.limitAmount) * 100);
  var remain = parsed.limitAmount - currentSpent;

  var blocks = [
    "🎯 <b>ĐÃ CẬP NHẬT HẠN MỨC CHI TIÊU (/limit)</b>",
    "🏷️ <b>Phân loại:</b> <code>" + escapeHtml(parsed.tag) + "</code>",
    "💰 <b>Hạn mức mới:</b> <code>" + escapeHtml(formatCurrency(parsed.limitAmount, false)) + "</code>",
    "<blockquote>" +
      "• Đã chi kỳ này: " +
      escapeHtml(formatCurrency(currentSpent, false)) +
      " (" +
      percent +
      "%)\n\n" +
      "• Còn lại: <b>" +
      escapeHtml(formatCurrency(remain, false)) +
      "</b>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Tạo bản xem trước khi bấm /chotso hoặc /renew (kèm nút Inline xác nhận 2 bước)
 * @returns {object} { text, replyMarkup }
 */
function buildRenewPreview() {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var text = [
    "📅 <b>XÁC NHẬN CHỐT SỔ CUỐI KỲ (/chotso)</b>",
    "<blockquote>" +
      "📘 <b>Quỹ Cá Nhân (/c):</b> " +
      pRows.length +
      " giao dịch\n\n" +
      "👉 Số dư: <b><code>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</code></b>\n\n" +
      "📙 <b>Quỹ Phụ (/lcb):</b> " +
      sRows.length +
      " giao dịch\n\n" +
      "👉 Số dư: <b><code>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</code></b>" +
      "</blockquote>",
    "1️⃣ Toàn bộ các dòng giao dịch kỳ này sẽ được chuyển sang bảng <b>Lịch Sử Chốt Sổ</b>.",
    "2️⃣ Các dòng giao dịch lẻ được gom gọn thành dòng <b>Số dư đầu kỳ</b> mới cho từng Ngân hàng & #Tag.",
    "<i>(Nếu muốn lưu sổ và đưa toàn bộ số dư về 0, hãy dùng lệnh /reset)</i>"
  ].join("\n\n");

  var replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Xác nhận Chốt Sổ", callback_data: "confirm_renew:yes" },
        { text: "❌ Hủy bỏ", callback_data: "confirm_renew:no" }
      ]
    ]
  };

  return { text: text, replyMarkup: replyMarkup };
}

/**
 * Gom nhóm số dư theo cặp (Ngân hàng + #Tag) để tạo các dòng "Số dư đầu kỳ" mới sau khi chốt sổ
 * @param {Array<object>} rows
 * @param {string} userLabel
 * @returns {Array<object>}
 */
function buildOpeningBalanceRows(rows, userLabel) {
  var pairMap = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var bank = String(r.bank || "Chung").trim();
    var tag = normalizeTag(r.tag || "#CHUNG");
    var key = bank + "|||" + tag;
    pairMap[key] = (pairMap[key] || 0) + (Number(r.amount) || 0);
  }

  var nowStr = getNowFormatted();
  var openingList = [];
  var keys = Object.keys(pairMap);

  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    var bal = pairMap[k];
    if (bal !== 0) {
      var splitParts = k.split("|||");
      openingList.push({
        txId: generateTxId(),
        time: nowStr,
        user: userLabel,
        bank: splitParts[0],
        tag: splitParts[1],
        rawAmount: String(bal),
        amount: bal,
        note: "Số dư đầu kỳ",
        billUrl: ""
      });
    }
  }

  return openingList;
}

/**
 * Thực thi Chốt sổ cuối kỳ (/chotso, /renew) - Chuyển toàn bộ giao dịch cũ sang Lịch Sử Chốt Sổ và giữ lại Số dư đầu kỳ
 * @param {string} userLabel
 * @returns {string}
 */
function executeRenewPeriod(userLabel) {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var nowStr = getNowFormatted();
  var archivedCount = archiveTransactionsToHistorySheet(
    "CHOT SO " + nowStr,
    userLabel,
    pRows,
    sRows,
    pStats.totalBalance,
    sStats.totalBalance
  );

  var newPersonalOpening = buildOpeningBalanceRows(pRows, userLabel);
  var newSubOpening = buildOpeningBalanceRows(sRows, userLabel);

  resetSheetWithOpeningBalances(SHEET_NAMES.PERSONAL, newPersonalOpening);
  resetSheetWithOpeningBalances(SHEET_NAMES.SUB_FUND, newSubOpening);

  var blocks = [
    "✅ <b>ĐÃ CHỐT SỔ SANG KỲ MỚI THÀNH CÔNG</b>",
    "🕒 <b>Thời gian:</b> " + escapeHtml(nowStr),
    "📦 <b>Đã chuyển sổ:</b> <b>" + archivedCount + " dòng giao dịch</b> sang bảng <b>Lịch Sử Chốt Sổ</b>",
    "<blockquote>" +
      "🌱 <b>SỐ DƯ ĐẦU KỲ MỚI</b>\n\n" +
      "📘 <b>Quỹ Cá Nhân (/c):</b> <code>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</code>\n\n" +
      "📙 <b>Quỹ Phụ (/lcb):</b> <code>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

/**
 * Thực thi lệnh /reset:
 * - Di chuyển nguyên vẹn toàn bộ từng dòng giao dịch hiện tại của cả 2 bảng ("Thu Chi" và "Quỹ Phụ")
 *   sang nối tiếp tại bảng "Lịch Sử Chốt Sổ" (liên thông tất cả các tháng cũ với nhau, không mất bất kỳ giao dịch nào).
 * - Làm trống bảng hiện tại để đưa số dư của tất cả các mục về 0 đ bắt đầu kỳ mới.
 * @param {string} userLabel
 * @returns {string}
 */
function executeResetAllToZero(userLabel) {
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(pRows);
  var sStats = calculateSheetStats(sRows);

  var nowStr = getNowFormatted();
  var archivedCount = archiveTransactionsToHistorySheet(
    "RESET " + nowStr,
    userLabel,
    pRows,
    sRows,
    pStats.totalBalance,
    sStats.totalBalance
  );

  resetSheetWithOpeningBalances(SHEET_NAMES.PERSONAL, []);
  resetSheetWithOpeningBalances(SHEET_NAMES.SUB_FUND, []);

  var blocks = [
    "🧹 <b>ĐÃ LƯU SỔ LIÊN THÔNG & RESET SỐ DƯ VỀ 0 (/reset)</b>",
    "🕒 <b>Thời gian:</b> " + escapeHtml(nowStr),
    "📦 <b>Giao dịch lưu trữ:</b> <b>" +
      archivedCount +
      " dòng</b> (" +
      pRows.length +
      " /c, " +
      sRows.length +
      " /lcb)",
    "<blockquote>" +
      "📂 <b>SỐ DƯ CŨ ĐÃ LƯU LỊCH SỬ</b>\n\n" +
      "• Dư cũ (/c): <b>" +
      escapeHtml(formatCurrency(pStats.totalBalance, false)) +
      "</b>\n\n" +
      "• Dư cũ (/lcb): <b>" +
      escapeHtml(formatCurrency(sStats.totalBalance, false)) +
      "</b>\n\n" +
      "✨ <b>SỐ DƯ KỲ MỚI HIỆN TẠI</b>\n\n" +
      "• Tất cả Ngân hàng & #Tag: <code>0 đ</code>\n\n" +
      "• Quỹ Cá Nhân & Quỹ Phụ: <code>0 đ</code>" +
      "</blockquote>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    blocks.push("📊 <a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>");
  }

  return blocks.join("\n\n");
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.generateTxId = generateTxId;
  global.calculateSheetStats = calculateSheetStats;
  global.buildLimitAlertText = buildLimitAlertText;
  global.executeFinanceTransaction = executeFinanceTransaction;
  global.executeUndoTransaction = executeUndoTransaction;
  global.buildBalanceReport = buildBalanceReport;
  global.buildRecentHistoryReport = buildRecentHistoryReport;
  global.handleSetLimitCommand = handleSetLimitCommand;
  global.buildRenewPreview = buildRenewPreview;
  global.executeRenewPeriod = executeRenewPeriod;
  global.executeResetAllToZero = executeResetAllToZero;

  module.exports = {
    generateTxId: generateTxId,
    calculateSheetStats: calculateSheetStats,
    buildLimitAlertText: buildLimitAlertText,
    executeFinanceTransaction: executeFinanceTransaction,
    executeUndoTransaction: executeUndoTransaction,
    buildBalanceReport: buildBalanceReport,
    buildRecentHistoryReport: buildRecentHistoryReport,
    handleSetLimitCommand: handleSetLimitCommand,
    buildRenewPreview: buildRenewPreview,
    executeRenewPeriod: executeRenewPeriod,
    executeResetAllToZero: executeResetAllToZero
  };
}
