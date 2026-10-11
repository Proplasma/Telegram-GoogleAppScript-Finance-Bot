/**
 * ============================================================
 * GAS-SHIM: Giả lập môi trường Google Apps Script trên Node.js
 * Giúp mã nguồn trong src/ chạy trực tiếp trên máy tính để dev & test
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Tự động nạp file .env từ thư mục gốc NewBot
const dotenvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(dotenvPath)) {
  require("dotenv").config({ path: dotenvPath });
}

// 1. Giả lập Logger
const Logger = {
  log: function (...args) {
    const time = new Date().toLocaleTimeString("vi-VN");
    console.log(`\x1b[36m[GAS Logger ${time}]\x1b[0m`, ...args);
  }
};

// 2. Giả lập UrlFetchApp
class HttpResponseShim {
  constructor(status, headers, bodyText) {
    this._status = status;
    this._headers = headers;
    this._bodyText = bodyText;
  }
  getResponseCode() {
    return this._status;
  }
  getHeaders() {
    return this._headers;
  }
  getContentText() {
    return this._bodyText;
  }
  getBlob() {
    return {
      setName: function () {
        return this;
      }
    };
  }
}

const UrlFetchApp = {
  fetch: function (url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (options.contentType) {
      headers["Content-Type"] = options.contentType;
    }

    try {
      const curlArgs = ["-s", "-X", method, url];
      for (const [k, v] of Object.entries(headers)) {
        curlArgs.push("-H", `${k}: ${v}`);
      }
      const execOptions = { encoding: "utf-8" };
      if (options.payload) {
        const payloadStr =
          typeof options.payload === "string" ? options.payload : JSON.stringify(options.payload);
        curlArgs.push("--data-binary", "@-");
        execOptions.input = Buffer.from(payloadStr, "utf-8");
      }
      curlArgs.push("-w", "\n%{http_code}");

      const output = execFileSync("curl", curlArgs, execOptions);
      const lastNewlineIndex = output.lastIndexOf("\n");
      const body = output.substring(0, lastNewlineIndex);
      const code = parseInt(output.substring(lastNewlineIndex + 1).trim(), 10) || 200;

      return new HttpResponseShim(code, {}, body);
    } catch (err) {
      return new HttpResponseShim(500, {}, JSON.stringify({ ok: false, description: err.message }));
    }
  }
};

// 3. Giả lập PropertiesService
const _localPropertiesStore = new Map();
for (const [key, value] of Object.entries(process.env)) {
  _localPropertiesStore.set(key, value);
}

const PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (key) {
        return _localPropertiesStore.get(key) || process.env[key] || null;
      },
      setProperty: function (key, value) {
        _localPropertiesStore.set(key, String(value));
      },
      setProperties: function (obj) {
        for (const [k, v] of Object.entries(obj)) {
          _localPropertiesStore.set(k, String(v));
        }
      },
      deleteAllProperties: function () {
        _localPropertiesStore.clear();
      }
    };
  }
};

// 4. Giả lập ContentService
const ContentService = {
  MimeType: {
    JSON: "application/json",
    TEXT: "text/plain",
    HTML: "text/html"
  },
  createTextOutput: function (content) {
    return {
      content: content,
      mimeType: "text/plain",
      setMimeType: function (type) {
        this.mimeType = type;
        return this;
      },
      toString: function () {
        return this.content;
      }
    };
  }
};

// 5. Giả lập Utilities
const Utilities = {
  formatDate: function (date, timeZone) {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: timeZone === "Asia/Ho_Chi_Minh" ? "Asia/Ho_Chi_Minh" : undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  },
  sleep: function (ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
};

// 6. Giả lập CacheService
const _localCacheStore = new Map();
const CacheService = {
  getScriptCache: function () {
    return {
      get: function (key) {
        const item = _localCacheStore.get(key);
        if (!item) return null;
        if (Date.now() > item.expireAt) {
          _localCacheStore.delete(key);
          return null;
        }
        return item.value;
      },
      put: function (key, value, expirationInSeconds) {
        _localCacheStore.set(key, {
          value: String(value),
          expireAt: Date.now() + (expirationInSeconds || 600) * 1000
        });
      },
      remove: function (key) {
        _localCacheStore.delete(key);
      }
    };
  }
};

// 7. Giả lập SpreadsheetApp trên RAM cho Local Test
class SheetShim {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }
  getName() {
    return this.name;
  }
  getLastRow() {
    return this.rows.length;
  }
  appendRow(rowArr) {
    this.rows.push(rowArr.slice());
  }
  deleteRow(rowIndex1Based) {
    if (rowIndex1Based >= 1 && rowIndex1Based <= this.rows.length) {
      this.rows.splice(rowIndex1Based - 1, 1);
    }
  }
  deleteRows(startRow1Based, howMany) {
    if (startRow1Based >= 1 && howMany > 0) {
      this.rows.splice(startRow1Based - 1, howMany);
    }
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    const self = this;
    return {
      setFontWeight: function () {
        return this;
      },
      getValues: function () {
        const res = [];
        for (let r = 0; r < numRows; r++) {
          const rowData = self.rows[row - 1 + r] || [];
          const slice = [];
          for (let c = 0; c < numCols; c++) {
            let val = rowData[col - 1 + c];
            if (typeof val === "string" && val.startsWith("'")) {
              val = val.substring(1);
            }
            slice.push(val !== undefined ? val : "");
          }
          res.push(slice);
        }
        return res;
      },
      setValues: function (matrix) {
        for (let r = 0; r < matrix.length; r++) {
          if (!self.rows[row - 1 + r]) self.rows[row - 1 + r] = [];
          for (let c = 0; c < matrix[r].length; c++) {
            self.rows[row - 1 + r][col - 1 + c] = matrix[r][c];
          }
        }
      }
    };
  }
}

const _spreadsheetsById = new Map();
const SpreadsheetApp = {
  create: function (name) {
    const id = "LOCAL_SHEET_" + Date.now();
    const sheets = new Map();
    sheets.set("Sheet1", new SheetShim("Sheet1"));
    const ssObj = {
      getId: () => id,
      getName: () => name,
      getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
      getSheetByName: (tabName) => sheets.get(tabName) || null,
      insertSheet: (tabName) => {
        const s = new SheetShim(tabName);
        sheets.set(tabName, s);
        return s;
      },
      getSheets: () => Array.from(sheets.values()),
      deleteSheet: (sheetObj) => {
        if (sheetObj && sheetObj.getName) {
          sheets.delete(sheetObj.getName());
        }
      }
    };
    _spreadsheetsById.set(id, ssObj);
    return ssObj;
  },
  openById: function (id) {
    if (!_spreadsheetsById.has(id)) {
      return this.create("Restored_" + id);
    }
    return _spreadsheetsById.get(id);
  }
};

// Đăng ký toàn cục vào global của Node.js
global.Logger = Logger;
global.UrlFetchApp = UrlFetchApp;
global.PropertiesService = PropertiesService;
global.ContentService = ContentService;
global.CacheService = CacheService;
global.Utilities = Utilities;
global.SpreadsheetApp = SpreadsheetApp;

// Nạp toàn bộ các module chuẩn SOLID của Bot theo đúng thứ tự phụ thuộc
require("../src/core/config");
require("../src/core/financeParser");
require("../src/services/telegramService");
require("../src/services/driveService");
require("../src/services/sheetService");
require("../src/services/financeService");
require("../src/core/securityGuard");
require("../src/controllers/uiController");
require("../src/controllers/commandController");
require("../src/GrantAllPermission");
require("../src/F1ActivateBot");
require("../src/main");

module.exports = {
  Logger,
  UrlFetchApp,
  PropertiesService,
  ContentService,
  CacheService,
  Utilities,
  SpreadsheetApp
};
