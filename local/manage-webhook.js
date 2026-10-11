/**
 * ============================================================
 * QUẢN LÝ TELEGRAM WEBHOOK TIỆN LỢI TỪ DÒNG LỆNH
 * Sử dụng:
 *   npm run webhook:info
 *   npm run webhook:set <URL_WEB_APP>
 *   npm run webhook:delete
 * ============================================================
 */

require("./gas-shim");

const token = getBotToken();
const args = process.argv.slice(2);
const command = (args[0] || "info").toLowerCase();
const targetUrl = args[1] || process.env.WEBAPP_URL;

if (!token || token.includes("YOUR_TELEGRAM_BOT_TOKEN") || token.length < 15) {
  console.log("\x1b[31m✖ Lỗi: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env!\x1b[0m");
  process.exit(1);
}

console.log("\x1b[36m=== CÔNG CỤ QUẢN LÝ TELEGRAM WEBHOOK (@SuperFinanceGAS_bot) ===\x1b[0m\n");

switch (command) {
  case "info":
  case "status": {
    console.log("🔍 Đang kiểm tra thông tin Webhook từ Telegram...");
    const info = getTelegramWebhookInfo();
    console.log(JSON.stringify(info, null, 2));
    if (info && info.result) {
      if (info.result.url) {
        console.log(`\n\x1b[32m✔ Webhook hiện tại:\x1b[0m ${info.result.url}`);
        if (info.result.last_error_message) {
          console.log(`\x1b[31m⚠ Lỗi webhook gần nhất:\x1b[0m ${info.result.last_error_message}`);
        }
      } else {
        console.log("\n\x1b[33mℹ Hiện tại KHÔNG CÓ Webhook nào được kích hoạt (Chế độ Polling / Offline).\x1b[0m");
      }
    }
    break;
  }

  case "set": {
    if (!targetUrl || !targetUrl.startsWith("https://")) {
      console.log("\x1b[31m✖ Lỗi: Cần cung cấp URL Webhook hợp lệ (bắt đầu bằng https://)!\x1b[0m");
      console.log("Ví dụ: npm run webhook:set https://script.google.com/macros/s/XXXXX/exec");
      process.exit(1);
    }
    console.log(`📡 Đang thiết lập Webhook trỏ về: \x1b[32m${targetUrl}\x1b[0m ...`);
    const setRes = setTelegramWebhook(targetUrl, true);
    console.log(JSON.stringify(setRes, null, 2));
    if (setRes && setRes.ok) {
      console.log("\n\x1b[32m✔ Thiết lập Webhook THÀNH CÔNG! Đã tự động xóa hàng đợi cũ (drop_pending_updates: true).\x1b[0m");
    } else {
      console.log("\n\x1b[31m✖ Thiết lập Webhook thất bại!\x1b[0m");
    }
    break;
  }

  case "delete":
  case "del":
  case "remove": {
    console.log("🗑️ Đang xóa Webhook trên Telegram...");
    const delRes = deleteTelegramWebhook(true);
    console.log(JSON.stringify(delRes, null, 2));
    if (delRes && delRes.ok) {
      console.log("\n\x1b[32m✔ Đã xóa Webhook thành công! Bạn có thể chạy 'npm run dev' để test local.\x1b[0m");
    }
    break;
  }

  default:
    console.log("Sử dụng một trong các lệnh sau:");
    console.log("  npm run webhook:info");
    console.log("  npm run webhook:set <WEBAPP_URL>");
    console.log("  npm run webhook:delete");
}
