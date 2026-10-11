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
 * Tạo dòng thông báo kiểm tra Hạn mức (/limit) cho một #Tag
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

  var statusLabel = "An toan";
  if (percent >= 100) {
    statusLabel = "VUOT HAN MUC";
  } else if (percent >= 80) {
    statusLabel = "Sap cham tran";
  }

  var alertBox = renderBoxTable(
    [
      { label: "Han muc", value: formatCurrency(limitVal, false) },
      { label: "Da chi", value: formatCurrency(spent, false) + " (" + percent + "%)" },
      { label: "Con lai", value: formatCurrency(remain, false) },
      { label: "Trang thai", value: statusLabel }
    ],
    13,
    23
  );

  return (
    "\n\n<b>THEO DÕI HẠN MỨC " +
    escapeHtml(normTag) +
    "</b>\n\n" +
    "<pre>" +
    escapeHtml(alertBox) +
    "</pre>"
  );
}

/**
 * Ghi nhận giao dịch mới cho /c, /lcb hoặc /clcb
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
  var typeLabel = isIncome ? "THU VAO (+)" : "CHI RA (-)";
  var amountFormatted = formatCurrency(parsedTx.amount, true);

  var titleHeader = "";
  var tableRows = [];
  var limitSection = "";

  if (mode === "c") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));

    titleHeader = "<b>GHI NHẬN GIAO DỊCH  |  QUỸ CÁ NHÂN (/c)</b>";
    tableRows = [
      { label: "Ma GD", value: txId },
      { label: "Loai GD", value: typeLabel },
      "SEPARATOR",
      { label: "Ngan hang", value: parsedTx.bank },
      { label: "Phan loai", value: parsedTx.tag },
      { label: "So tien", value: amountFormatted },
      { label: "Ghi chu", value: parsedTx.note },
      "SEPARATOR",
      { label: "Du " + parsedTx.tag, value: formatCurrency(cStats.byTag[parsedTx.tag] || 0, false) },
      { label: "Du " + parsedTx.bank, value: formatCurrency(cStats.byBank[parsedTx.bank] || 0, false) },
      { label: "TONG QUY", value: formatCurrency(cStats.totalBalance, false) }
    ];

    limitSection = buildLimitAlertText(parsedTx.tag, cStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "lcb") {
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);
    var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "<b>GHI NHẬN GIAO DỊCH  |  QUỸ PHỤ (/lcb)</b>";
    tableRows = [
      { label: "Ma GD", value: txId },
      { label: "Loai GD", value: typeLabel },
      "SEPARATOR",
      { label: "Ngan hang", value: parsedTx.bank },
      { label: "Phan loai", value: parsedTx.tag },
      { label: "So tien", value: amountFormatted },
      { label: "Ghi chu", value: parsedTx.note },
      "SEPARATOR",
      { label: "Du " + parsedTx.tag, value: formatCurrency(lcbStats.byTag[parsedTx.tag] || 0, false) },
      { label: "Du " + parsedTx.bank, value: formatCurrency(lcbStats.byBank[parsedTx.bank] || 0, false) },
      { label: "TONG QUY PHU", value: formatCurrency(lcbStats.totalBalance, false) }
    ];

    limitSection = buildLimitAlertText(parsedTx.tag, lcbStats.spentByTag[parsedTx.tag] || 0);
  } else if (mode === "clcb") {
    appendTransactionRow(SHEET_NAMES.PERSONAL, txRecord);
    appendTransactionRow(SHEET_NAMES.SUB_FUND, txRecord);

    var bothPersonalStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
    var bothSubStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

    titleHeader = "<b>GHI ĐỒNG THỜI 2 QUỸ  |  (/clcb)</b>";
    tableRows = [
      { label: "Ma GD", value: txId },
      { label: "Loai GD", value: typeLabel },
      "SEPARATOR",
      { label: "Ngan hang", value: parsedTx.bank },
      { label: "Phan loai", value: parsedTx.tag },
      { label: "So tien", value: amountFormatted },
      { label: "Ghi chu", value: parsedTx.note },
      "SEPARATOR",
      { label: "Du " + parsedTx.tag + " (/c)", value: formatCurrency(bothPersonalStats.byTag[parsedTx.tag] || 0, false) },
      { label: "Du " + parsedTx.tag + " (/lcb)", value: formatCurrency(bothSubStats.byTag[parsedTx.tag] || 0, false) },
      "SEPARATOR",
      { label: "QUY CA NHAN", value: formatCurrency(bothPersonalStats.totalBalance, false) },
      { label: "QUY PHU", value: formatCurrency(bothSubStats.totalBalance, false) }
    ];

    limitSection = buildLimitAlertText(parsedTx.tag, bothPersonalStats.spentByTag[parsedTx.tag] || 0);
  }

  var boxTableStr = renderBoxTable(tableRows, 15, 22);

  var messageParts = [
    titleHeader,
    "",
    "<pre>" + escapeHtml(boxTableStr) + "</pre>"
  ];

  if (limitSection) {
    messageParts.push(limitSection);
  }

  if (billUrl) {
    var linkLabel =
      billUrl.indexOf("drive.google.com") > -1
        ? "Mở xem ảnh hóa đơn (Bill) trên Google Drive"
        : "Mở xem file ảnh hóa đơn (Bill)";
    messageParts.push(
      "",
      "<b>ẢNH HÓA ĐƠN (BILL):</b>\n<a href=\"" + escapeHtml(billUrl) + "\">" + linkLabel + "</a>"
    );
  }

  if (hasPhoto && billError) {
    messageParts.push(
      "",
      "<i>Lưu ý Google Drive: " +
        escapeHtml(billError) +
        " (Mở GAS Editor -> Chọn hàm ActivateBot hoặc GrantAllPermissions -> Bấm Run để cấp quyền Drive).</i>"
    );
  }

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    messageParts.push(
      "",
      "<a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets</a>"
    );
  }

  var replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "Hoàn tác giao dịch (" + txId + ")",
          callback_data: "undo_tx:" + mode + ":" + txId
        }
      ]
    ]
  };

  return {
    text: messageParts.join("\n"),
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
    return "<b>KHÔNG TÌM THẤY GIAO DỊCH ĐỂ HOÀN TÁC</b>\n\nGiao dịch này đã được xóa trước đó hoặc bảng đang trống.";
  }

  var cStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var lcbStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.SUB_FUND));

  var scopeName =
    deletedPersonal && deletedSub
      ? "Ca 2 Quy (/clcb)"
      : deletedPersonal
      ? "Quy Ca Nhan (/c)"
      : "Quy Phu (/lcb)";

  var box = renderBoxTable(
    [
      { label: "Ma GD xoa", value: sample.txId || "N/A" },
      { label: "Pham vi", value: scopeName },
      "SEPARATOR",
      { label: "Ngan hang", value: sample.bank },
      { label: "Phan loai", value: sample.tag },
      { label: "So tien xoa", value: formatCurrency(sample.amount, true) },
      { label: "Ghi chu", value: sample.note },
      "SEPARATOR",
      { label: "Quy Ca Nhan", value: formatCurrency(cStats.totalBalance, false) },
      { label: "Quy Phu", value: formatCurrency(lcbStats.totalBalance, false) }
    ],
    15,
    22
  );

  return (
    "<b>ĐÃ HOÀN TÁC (XÓA) GIAO DỊCH THÀNH CÔNG</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>"
  );
}

/**
 * Tạo báo cáo Số dư tổng hợp (/sodu hoặc /balance)
 * @returns {string}
 */
function buildBalanceReport() {
  var personalRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var subRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var pStats = calculateSheetStats(personalRows);
  var sStats = calculateSheetStats(subRows);
  var limitsMap = getAllTagLimits();

  var overviewBox = renderBoxTable(
    [
      { label: "QUY CA NHAN", value: formatCurrency(pStats.totalBalance, false) },
      { label: "QUY PHU", value: formatCurrency(sStats.totalBalance, false) }
    ],
    15,
    22
  );

  var bankRows = [];
  var bankKeys = Object.keys(pStats.byBank);
  if (bankKeys.length === 0) {
    bankRows.push({ label: "Mac dinh", value: "0 đ" });
  } else {
    for (var i = 0; i < bankKeys.length; i++) {
      var bName = bankKeys[i];
      bankRows.push({
        label: bName,
        value: formatCurrency(pStats.byBank[bName], false)
      });
    }
  }
  var bankBox = renderBoxTable(bankRows, 15, 22);

  var tagRows = [];
  var tagKeys = Object.keys(pStats.byTag);
  if (tagKeys.length === 0) {
    tagRows.push({ label: "Mac dinh", value: "0 đ" });
  } else {
    for (var j = 0; j < tagKeys.length; j++) {
      var tName = tagKeys[j];
      var tBal = formatCurrency(pStats.byTag[tName], false);
      if (limitsMap[tName]) {
        var spent = pStats.spentByTag[tName] || 0;
        var pct = Math.round((spent / limitsMap[tName]) * 100);
        tBal += " (" + pct + "% HM)";
      }
      tagRows.push({
        label: tName,
        value: tBal
      });
    }
  }
  var tagBox = renderBoxTable(tagRows, 15, 22);

  var parts = [
    "<b>BÁO CÁO SỐ DƯ TÀI CHÍNH (/sodu)</b>",
    "",
    "<b>1. TỔNG QUAN HAI QUỸ:</b>",
    "<pre>" + escapeHtml(overviewBox) + "</pre>",
    "",
    "<b>2. SỐ DƯ THEO NGÂN HÀNG (QUỸ CÁ NHÂN):</b>",
    "<pre>" + escapeHtml(bankBox) + "</pre>",
    "",
    "<b>3. SỐ DƯ THEO PHÂN LOẠI #TAG:</b>",
    "<pre>" + escapeHtml(tagBox) + "</pre>"
  ];

  var sheetUrl = getProperty("SHEET_URL");
  if (sheetUrl) {
    parts.push("", "<a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets chi tiết</a>");
  }

  return parts.join("\n");
}

/**
 * Xem lại 5 giao dịch gần nhất (/ls hoặc /history)
 * @param {number} [limitCount=5]
 * @returns {string}
 */
function buildRecentHistoryReport(limitCount) {
  var count = limitCount || 5;
  var pRows = getAllTransactionRows(SHEET_NAMES.PERSONAL);
  var sRows = getAllTransactionRows(SHEET_NAMES.SUB_FUND);

  var recentP = pRows.slice(-count).reverse();
  var recentS = sRows.slice(-count).reverse();

  var parts = ["<b>LỊCH SỬ " + count + " GIAO DỊCH GẦN NHẤT (/ls)</b>"];

  parts.push("", "--------------------------------", "<b>1. QUỸ CÁ NHÂN (/c):</b>");
  if (recentP.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var i = 0; i < recentP.length; i++) {
      var item = recentP[i];
      var box = renderBoxTable(
        [
          { label: "Thoi gian", value: item.time },
          { label: "Ngan hang", value: item.bank + " | " + item.tag },
          { label: "So tien", value: formatCurrency(item.amount, true) },
          { label: "Ghi chu", value: item.note }
        ],
        13,
        24
      );
      var itemText = "\n<pre>" + escapeHtml(box) + "</pre>";
      if (item.billUrl) {
        itemText += "\n<a href=\"" + escapeHtml(item.billUrl) + "\">Xem ảnh Bill (" + escapeHtml(item.txId) + ")</a>";
      }
      parts.push(itemText);
    }
  }

  parts.push("", "--------------------------------", "<b>2. QUỸ PHỤ (/lcb):</b>");
  if (recentS.length === 0) {
    parts.push("<i>(Chưa có giao dịch nào)</i>");
  } else {
    for (var j = 0; j < recentS.length; j++) {
      var sItem = recentS[j];
      var sBox = renderBoxTable(
        [
          { label: "Thoi gian", value: sItem.time },
          { label: "Ngan hang", value: sItem.bank + " | " + sItem.tag },
          { label: "So tien", value: formatCurrency(sItem.amount, true) },
          { label: "Ghi chu", value: sItem.note }
        ],
        13,
        24
      );
      var sItemText = "\n<pre>" + escapeHtml(sBox) + "</pre>";
      if (sItem.billUrl) {
        sItemText += "\n<a href=\"" + escapeHtml(sItem.billUrl) + "\">Xem ảnh Bill (" + escapeHtml(sItem.txId) + ")</a>";
      }
      parts.push(sItemText);
    }
  }

  return parts.join("\n");
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
    return "<b>CÚ PHÁP HẠN MỨC CHƯA ĐÚNG</b>\n\n" + parsed.error;
  }

  upsertTagLimit(parsed.tag, parsed.limitAmount, userLabel);

  var pStats = calculateSheetStats(getAllTransactionRows(SHEET_NAMES.PERSONAL));
  var currentSpent = pStats.spentByTag[parsed.tag] || 0;
  var percent = Math.round((currentSpent / parsed.limitAmount) * 100);

  var box = renderBoxTable(
    [
      { label: "Phan loai", value: parsed.tag },
      { label: "Han muc moi", value: formatCurrency(parsed.limitAmount, false) },
      "SEPARATOR",
      { label: "Da chi ky nay", value: formatCurrency(currentSpent, false) + " (" + percent + "%)" },
      { label: "Con duoc tieu", value: formatCurrency(parsed.limitAmount - currentSpent, false) }
    ],
    15,
    22
  );

  return (
    "<b>ĐÃ CẬP NHẬT HẠN MỨC CHI TIÊU (/limit)</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>"
  );
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

  var box = renderBoxTable(
    [
      { label: "Dong Quy Chinh", value: pRows.length + " giao dich" },
      { label: "Dong Quy Phu", value: sRows.length + " giao dich" },
      "SEPARATOR",
      { label: "Quy Ca Nhan", value: formatCurrency(pStats.totalBalance, false) },
      { label: "Quy Phu", value: formatCurrency(sStats.totalBalance, false) }
    ],
    15,
    22
  );

  var text =
    "<b>XÁC NHẬN CHỐT SỔ CUỐI KỲ (/chotso)</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>\n\n" +
    "<b>Khi xác nhận Chốt sổ (/chotso):</b>\n" +
    "1. Toàn bộ các dòng giao dịch kỳ này sẽ được chuyển sang bảng <b>Lịch Sử Chốt Sổ</b>.\n" +
    "2. Các dòng giao dịch lẻ được gom gọn thành dòng <b>Số dư đầu kỳ</b> mới cho từng Ngân hàng & #Tag.\n" +
    "<i>(Nếu muốn lưu sổ và đưa toàn bộ số dư về 0, hãy dùng lệnh /reset)</i>";

  var replyMarkup = {
    inline_keyboard: [
      [
        { text: "Xác nhận Chốt Sổ", callback_data: "confirm_renew:yes" },
        { text: "Hủy bỏ", callback_data: "confirm_renew:no" }
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

  var box = renderBoxTable(
    [
      { label: "Thoi gian", value: nowStr },
      { label: "Da chuyen su", value: archivedCount + " dong giao dich" },
      "SEPARATOR",
      { label: "Du dau ky /c", value: formatCurrency(pStats.totalBalance, false) },
      { label: "Du dau ky /lcb", value: formatCurrency(sStats.totalBalance, false) }
    ],
    15,
    22
  );

  return (
    "<b>ĐÃ CHỐT SỔ SANG KỲ MỚI THÀNH CÔNG</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>\n\n" +
    "Toàn bộ <b>" +
    archivedCount +
    " giao dịch chi tiết</b> (kèm Ghi chú & Link Bill) đã được chuyển nguyên vẹn sang bảng <b>Lịch Sử Chốt Sổ</b>.\n" +
    "Đã khởi tạo dòng <b>Số dư đầu kỳ</b> mới cho kỳ tiếp theo."
  );
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

  var box = renderBoxTable(
    [
      { label: "Thoi gian", value: nowStr },
      { label: "GD chuyen su", value: archivedCount + " dong (" + pRows.length + " /c, " + sRows.length + " /lcb)" },
      { label: "Du cu (/c)", value: formatCurrency(pStats.totalBalance, false) },
      { label: "Du cu (/lcb)", value: formatCurrency(sStats.totalBalance, false) },
      "SEPARATOR",
      { label: "So du cac Bank", value: "0 đ" },
      { label: "So du cac #Tag", value: "0 đ" },
      { label: "QUY CA NHAN", value: "0 đ" },
      { label: "QUY PHU", value: "0 đ" }
    ],
    16,
    21
  );

  var sheetUrl = getProperty("SHEET_URL");
  var msg =
    "<b>ĐÃ LƯU SỔ LIÊN THÔNG & RESET SỐ DƯ VỀ 0 (/reset)</b>\n\n" +
    "<pre>" +
    escapeHtml(box) +
    "</pre>\n\n" +
    "Đã di chuyển nguyên vẹn <b>" +
    archivedCount +
    " dòng giao dịch cũ</b> (đầy đủ Mã GD, Thời gian, Ngân hàng, #Tag, Số tiền, Ghi chú, Link Ảnh Bill) sang nối tiếp tại bảng <b>Lịch Sử Chốt Sổ</b>.\n" +
    "Số dư hiện tại của tất cả Ngân hàng, #Tag và 2 Quỹ đã đưa về <b>0 đ</b>.";

  if (sheetUrl) {
    msg += "\n\n<a href=\"" + escapeHtml(sheetUrl) + "\">Mở bảng Google Sheets (Xem tab Lịch Sử Chốt Sổ)</a>";
  }

  return msg;
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
