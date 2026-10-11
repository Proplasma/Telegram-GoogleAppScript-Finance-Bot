/**
 * ============================================================
 * CÔNG CỤ DỪNG KHẨN CẤP BOT TELEGRAM (EMERGENCY KILL SWITCH)
 * Sử dụng:
 *   npm run stop
 *   hoặc: node local/emergency-stop.js
 * ============================================================
 */

require("./gas-shim");
const https = require("https");

const token = getBotToken();

if (!token || token.includes("YOUR_TELEGRAM_BOT_TOKEN") || token.length < 15) {
  console.log("\x1b[31m✖ Lỗi: Không tìm thấy TELEGRAM_BOT_TOKEN hợp lệ trong file .env!\x1b[0m");
  process.exit(1);
}

console.log("\x1b[31m============================================================\x1b[0m");
console.log("\x1b[31m🛑 ĐANG THỰC HIỆN DỪNG KHẨN CẤP BOT (@SuperFinanceGAS_bot)...\x1b[0m");
console.log("1. Ngắt Webhook kết nối tới Google Apps Script.");
console.log("2. XÓA SẠCH toàn bộ tin nhắn đang bị kẹt trong hàng đợi Telegram (drop_pending_updates: true).");
console.log("\x1b[31m============================================================\x1b[0m\n");

const postData = JSON.stringify({ drop_pending_updates: true });

const options = {
  hostname: "api.telegram.org",
  port: 443,
  path: `/bot${token}/deleteWebhook`,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let rawData = "";
  res.on("data", (chunk) => (rawData += chunk));
  res.on("end", () => {
    try {
      const json = JSON.parse(rawData);
      if (json.ok) {
        console.log("\x1b[32m✔ DỪNG KHẨN CẤP THÀNH CÔNG! Bot đã ngắt kết nối khỏi Webhook.\x1b[0m");
        console.log("\x1b[32m✔ Toàn bộ tin nhắn bị lặp / Reply Storm đã bị Telegram hủy bỏ.\x1b[0m\n");
        console.log("👉 Hiện tại bot đang ở trạng thái AN TOÀN (OFFLINE).");
        console.log("👉 Khi muốn bật lại Webhook sau khi sửa lỗi, chạy:");
        console.log("   \x1b[36mnpm run webhook:set <URL_WEB_APP>\x1b[0m");
      } else {
        console.log("\x1b[31m✖ Telegram API trả về lỗi:\x1b[0m", json);
      }
    } catch (e) {
      console.log("Phản hồi thô:", rawData);
    }
  });
});

req.on("error", (err) => {
  console.error("\x1b[31m✖ Lỗi kết nối mạng:\x1b[0m", err.message);
});

req.write(postData);
req.end();
