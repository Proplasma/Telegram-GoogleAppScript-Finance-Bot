// financeParser.js //
/**
 * ============================================================
 * MODULE: FINANCE PARSER & FORMATTER (SRP)
 * Chuyên trách:
 * 1. Phân tích cú pháp lệnh /c, /lcb, /clcb, /limit
 *    - Hỗ trợ dạng chuẩn: /c <Ngân_Hàng> [#TAG] <Số_Tiền_Hoặc_Phép_Tính> [Ghi chú]
 *    - Hỗ trợ đầy đủ phép tính: Cộng (+), Trừ (-), Nhân (*, x, ×), Chia (/, ÷), Ngoặc đơn ( )
 *    - Quy tắc dấu: '+' hoặc không dấu -> THU (dương), '-' -> CHI (âm)
 *    - Mặc định Ngân hàng -> "Chung", mặc định Tag -> "#CHUNG"
 * 2. Định dạng tiền tệ VNĐ và kẻ khung bảng Unicode rõ nét
 * ============================================================
 */

/**
 * Chuyển đổi một hạng tử tiền tệ đơn lẻ không dấu (VD: "50k", "200.000", "1tr5", "1.5tr") sang số thực
 * @param {string} rawAtom
 * @returns {number|null}
 */
function parseUnsignedMoneyAtom(rawAtom) {
  if (!rawAtom) return null;
  var s = String(rawAtom).trim().toLowerCase();
  if (!s) return null;

  // Hỗ trợ dạng "1tr5" -> 1.5tr, "2k5" -> 2.5k
  var shorthandMatch = s.match(/^(\d+)(tr|m|k|ng)(\d+)$/);
  if (shorthandMatch) {
    var mainNum = parseInt(shorthandMatch[1], 10);
    var unit = shorthandMatch[2];
    var decStr = shorthandMatch[3];
    var decVal = parseInt(decStr, 10) / Math.pow(10, decStr.length);
    var mult = unit === "tr" || unit === "m" ? 1000000 : 1000;
    return (mainNum + decVal) * mult;
  }

  // Kiểm tra hậu tố đơn vị tiền tệ (k, ng, tr, m, đ, d, vnd)
  var multiplier = 1;
  if (/(tr|m)$/.test(s)) {
    multiplier = 1000000;
    s = s.replace(/(tr|m)$/, "");
  } else if (/(k|ng)$/.test(s)) {
    multiplier = 1000;
    s = s.replace(/(k|ng)$/, "");
  } else if (/(vnd|đ|d)$/.test(s)) {
    multiplier = 1;
    s = s.replace(/(vnd|đ|d)$/, "");
  }

  // Xử lý dấu chấm phân cách hàng nghìn (VD: "200.000" hoặc "1.500.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, "");
  } else {
    // Nếu là số thập phân kiểu "1,5" (kèm k/tr) -> đổi ',' thành '.'
    s = s.replace(/,/g, ".");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }

  var num = parseFloat(s);
  if (isNaN(num)) return null;

  return num * multiplier;
}

/**
 * Chuyển đổi một hạng tử tiền tệ có dấu đơn lẻ (VD: "50k", "-200.000", "+1tr5") sang số nguyên
 * @param {string} rawTerm
 * @returns {number|null}
 */
function parseSingleMoneyTerm(rawTerm) {
  if (!rawTerm) return null;
  var s = String(rawTerm).trim();
  if (!s) return null;

  var sign = 1;
  if (s.charAt(0) === "-") {
    sign = -1;
    s = s.substring(1).trim();
  } else if (s.charAt(0) === "+") {
    sign = 1;
    s = s.substring(1).trim();
  }

  var val = parseUnsignedMoneyAtom(s);
  if (val === null) return null;
  return Math.round(sign * val);
}

/**
 * Bộ tính toán biểu thức số học đệ quy (Recursive Descent Parser)
 * Hỗ trợ đầy đủ: Cộng (+), Trừ (-), Nhân (*, ×), Chia (/, ÷), Ngoặc đơn ( ), và các đơn vị tiền tệ (k, tr, 200.000)
 * Ví dụ:
 *   "-(35k*2+15k)"   -> -85000
 *   "-(120k+30k)/3"  -> -50000
 *   "35000*2+15000"  -> 85000
 *   "-50k"           -> -50000
 *
 * @param {string} exprStr
 * @returns {number|null}
 */
function parseAmountExpression(exprStr) {
  if (exprStr === null || exprStr === undefined) return null;
  var raw = String(exprStr)
    .trim()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");

  if (!raw) return null;

  // Tách chuỗi thành danh sách các Token: Toán tử (+, -, *, /, (, )) và Hạng tử tiền tệ
  var tokens = [];
  var i = 0;
  while (i < raw.length) {
    var ch = raw.charAt(i);
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
    } else {
      var start = i;
      while (
        i < raw.length &&
        raw.charAt(i) !== "+" &&
        raw.charAt(i) !== "-" &&
        raw.charAt(i) !== "*" &&
        raw.charAt(i) !== "/" &&
        raw.charAt(i) !== "(" &&
        raw.charAt(i) !== ")"
      ) {
        i++;
      }
      var atomStr = raw.substring(start, i);
      var numVal = parseUnsignedMoneyAtom(atomStr);
      if (numVal === null) {
        return null;
      }
      tokens.push(numVal);
    }
  }

  if (tokens.length === 0) return null;

  var pos = 0;
  var hasError = false;

  // Expr = Term { ('+' | '-') Term }
  function parseExpr() {
    var left = parseTerm();
    while (!hasError && pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      var op = tokens[pos++];
      var right = parseTerm();
      if (op === "+") {
        left += right;
      } else {
        left -= right;
      }
    }
    return left;
  }

  // Term = Factor { ('*' | '/') Factor }
  function parseTerm() {
    var left = parseFactor();
    while (!hasError && pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      var op = tokens[pos++];
      var right = parseFactor();
      if (op === "*") {
        left *= right;
      } else {
        if (right === 0) {
          hasError = true;
          return 0;
        }
        left /= right;
      }
    }
    return left;
  }

  // Factor = ('+' | '-') Factor | '(' Expr ')' | Number
  function parseFactor() {
    if (pos >= tokens.length) {
      hasError = true;
      return 0;
    }

    var tok = tokens[pos];
    if (tok === "+") {
      pos++;
      return parseFactor();
    }
    if (tok === "-") {
      pos++;
      return -parseFactor();
    }
    if (tok === "(") {
      pos++;
      var inside = parseExpr();
      if (pos >= tokens.length || tokens[pos] !== ")") {
        hasError = true;
        return 0;
      }
      pos++; // Bỏ qua dấu ')'
      return inside;
    }
    if (typeof tok === "number") {
      pos++;
      return tok;
    }

    hasError = true;
    return 0;
  }

  var finalVal = parseExpr();
  if (hasError || pos !== tokens.length || !isFinite(finalVal) || isNaN(finalVal)) {
    return null;
  }

  var rounded = Math.round(finalVal);
  if (rounded === 0 && !/^0([kKmM]|tr)?$/.test(raw)) {
    return null;
  }

  return rounded;
}

/**
 * Kiểm tra một từ (token) có phải là biểu thức số tiền hợp lệ hay không
 * @param {string} token
 * @returns {boolean}
 */
function isAmountToken(token) {
  if (!token) return false;
  if (String(token).charAt(0) === "#") return false;
  return parseAmountExpression(token) !== null;
}

/**
 * Chuẩn hóa #Tag (viết hoa, tự thêm dấu # ở đầu, thay ký tự lạ)
 * @param {string} rawTag
 * @returns {string}
 */
function normalizeTag(rawTag) {
  if (!rawTag) return "#CHUNG";
  var t = String(rawTag).trim().toUpperCase();
  if (!t) return "#CHUNG";
  if (t.charAt(0) !== "#") {
    t = "#" + t;
  }
  t = t.replace(/[^#A-Z0-9_ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, "");
  return t.length > 1 ? t : "#CHUNG";
}

/**
 * Phân tích cú pháp cho các lệnh /c, /lcb, /clcb
 * Cú pháp chuẩn:
 *   /c <Ngân_Hàng> [#TAG] <Số_Tiền_Hoặc_Phép_Tính> [Ghi chú]
 * Đồng thời hỗ trợ linh hoạt:
 *   - Không nhập <Ngân_Hàng> -> Mặc định là "Chung"
 *   - Không nhập [#TAG]      -> Mặc định là "#CHUNG"
 *   - [#TAG] đặt trước hoặc ngay sau <Số_Tiền> đều nhận diện được
 *
 * @param {string} argsText - Phần chuỗi sau tên lệnh (VD: "Techcombank #TRADA -(35k*2+15k) Mua trà đá")
 * @returns {object} { valid, error, bank, tag, amount, rawAmount, note }
 */
function parseTransactionArgs(argsText) {
  var raw = String(argsText || "").trim();
  if (!raw) {
    return {
      valid: false,
      error: "Thiếu thông tin giao dịch.\nVí dụ đúng: <code>/c Techcombank #TRADA -50k Mua trà đá</code>"
    };
  }

  var tokens = raw.split(/\s+/);
  var amountIndex = -1;
  var parsedAmount = null;

  // Tìm vị trí của token Số Tiền / Biểu thức tính toán đầu tiên
  for (var i = 0; i < tokens.length; i++) {
    if (isAmountToken(tokens[i])) {
      amountIndex = i;
      parsedAmount = parseAmountExpression(tokens[i]);
      break;
    }
  }

  if (amountIndex === -1 || parsedAmount === null || parsedAmount === 0) {
    return {
      valid: false,
      error:
        "Không tìm thấy số tiền hoặc phép tính hợp lệ.\n" +
        "- Thu tiền: <code>50k</code> hoặc <code>+50k</code>\n" +
        "- Chi tiền: <code>-50k</code> hoặc <code>-(35k*2+15k)</code>\n" +
        "- Ví dụ: <code>/c Techcombank #TRADA -50k</code>"
    };
  }

  var bankParts = [];
  var tag = "";

  // Duyệt các token đứng trước <Số_Tiền> để lấy <Ngân_Hàng> và [#TAG]
  for (var j = 0; j < amountIndex; j++) {
    var tok = tokens[j];
    if (tok.charAt(0) === "#") {
      if (!tag) tag = normalizeTag(tok);
    } else {
      bankParts.push(tok);
    }
  }

  // Kiểm tra các token đứng sau <Số_Tiền>:
  // Nếu chưa có #Tag trước số tiền và token ngay sau số tiền bắt đầu bằng '#', lấy đó làm #Tag
  var noteStartIndex = amountIndex + 1;
  if (!tag && noteStartIndex < tokens.length && tokens[noteStartIndex].charAt(0) === "#") {
    tag = normalizeTag(tokens[noteStartIndex]);
    noteStartIndex++;
  }

  var bank = bankParts.length > 0 ? bankParts.join(" ") : "Chung";
  if (!tag) {
    tag = "#CHUNG";
  }

  var noteTokens = tokens.slice(noteStartIndex);
  var note = noteTokens.length > 0 ? noteTokens.join(" ") : "Không có ghi chú";

  return {
    valid: true,
    bank: bank,
    tag: tag,
    amount: parsedAmount,
    rawAmount: tokens[amountIndex],
    note: note
  };
}

/**
 * Phân tích cú pháp lệnh /limit
 * Ví dụ: /limit #TRADA 200k hoặc /limit #TRADA 100k*3
 * @param {string} argsText
 * @returns {object} { valid, error, tag, limitAmount }
 */
function parseLimitArgs(argsText) {
  var raw = String(argsText || "").trim();
  if (!raw) {
    return {
      valid: false,
      error: "Thiếu thông tin hạn mức.\nVí dụ: <code>/limit #TRADA 200k</code> hoặc <code>/limit #TRADA 200.000</code>"
    };
  }

  var tokens = raw.split(/\s+/);
  if (tokens.length < 2) {
    return {
      valid: false,
      error: "Cú pháp đúng: <code>/limit #TAG Số_Tiền</code>\nVí dụ: <code>/limit #TRADA 200k</code>"
    };
  }

  var tag = normalizeTag(tokens[0]);
  var amountVal = parseAmountExpression(tokens[1]);
  if (amountVal === null || Math.abs(amountVal) <= 0) {
    return {
      valid: false,
      error: "Số tiền hạn mức không hợp lệ.\nVí dụ: <code>/limit #TRADA 200k</code> hoặc <code>/limit #TRADA 200.000</code>"
    };
  }

  return {
    valid: true,
    tag: tag,
    limitAmount: Math.abs(amountVal)
  };
}

/**
 * Định dạng số tiền sang chuẩn VNĐ (VD: 50.000 đ, +50.000 đ, -50.000 đ)
 * @param {number} amount
 * @param {boolean} [showPlusSign=false]
 * @returns {string}
 */
function formatCurrency(amount, showPlusSign) {
  var num = Number(amount) || 0;
  var absFormatted = Math.abs(Math.round(num))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (num < 0) {
    return "-" + absFormatted + " đ";
  }
  if (num > 0 && showPlusSign) {
    return "+" + absFormatted + " đ";
  }
  return absFormatted + " đ";
}

/**
 * Căn lề chuỗi độ rộng cố định để vẽ bảng đẹp trong thẻ <pre>
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function padRight(text, width) {
  var str = String(text || "");
  if (str.length >= width) {
    return str.substring(0, width);
  }
  var spaces = "";
  for (var i = str.length; i < width; i++) {
    spaces += " ";
  }
  return str + spaces;
}

/**
 * Vẽ bảng có khung viền Unicode rõ ràng, giãn dòng thoáng mắt
 * @param {Array<object|string>} rows - Mảng các dòng: { label, value } hoặc "SEPARATOR"
 * @param {number} [labelWidth=13]
 * @param {number} [valueWidth=22]
 * @returns {string}
 */
function renderBoxTable(rows, labelWidth, valueWidth) {
  var lWidth = labelWidth || 13;
  var vWidth = valueWidth || 22;
  var totalInnerWidth = lWidth + 3 + vWidth; // "label : value"

  var horizontalLine = "";
  for (var i = 0; i < totalInnerWidth + 2; i++) {
    horizontalLine += "─";
  }

  var topBorder = "┌" + horizontalLine + "┐";
  var midBorder = "├" + horizontalLine + "┤";
  var botBorder = "└" + horizontalLine + "┘";

  var out = [topBorder];

  for (var r = 0; r < rows.length; r++) {
    var item = rows[r];
    if (item === "SEPARATOR") {
      out.push(midBorder);
    } else if (item && typeof item === "object") {
      var lbl = padRight(item.label, lWidth);
      var val = padRight(item.value, vWidth);
      out.push("│ " + lbl + " : " + val + " │");
    }
  }

  out.push(botBorder);
  return out.join("\n");
}

/**
 * Escape ký tự HTML đặc biệt để không làm vỡ thẻ HTML của Telegram
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.parseUnsignedMoneyAtom = parseUnsignedMoneyAtom;
  global.parseSingleMoneyTerm = parseSingleMoneyTerm;
  global.parseAmountExpression = parseAmountExpression;
  global.isAmountToken = isAmountToken;
  global.normalizeTag = normalizeTag;
  global.parseTransactionArgs = parseTransactionArgs;
  global.parseLimitArgs = parseLimitArgs;
  global.formatCurrency = formatCurrency;
  global.padRight = padRight;
  global.renderBoxTable = renderBoxTable;
  global.escapeHtml = escapeHtml;

  module.exports = {
    parseUnsignedMoneyAtom: parseUnsignedMoneyAtom,
    parseSingleMoneyTerm: parseSingleMoneyTerm,
    parseAmountExpression: parseAmountExpression,
    isAmountToken: isAmountToken,
    normalizeTag: normalizeTag,
    parseTransactionArgs: parseTransactionArgs,
    parseLimitArgs: parseLimitArgs,
    formatCurrency: formatCurrency,
    padRight: padRight,
    renderBoxTable: renderBoxTable,
    escapeHtml: escapeHtml
  };
}
