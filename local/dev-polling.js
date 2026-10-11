/**
 * ============================================================
 * LOCAL DEV SERVER (TELEGRAM LONG-POLLING)
 * Cho phép chat trực tiếp với @SuperFinanceGAS_bot trên Telegram
 * trong khi code chạy và debug trực tiếp trên máy tính cá nhân!
 * ============================================================
 */

require("./gas-shim");
const https = require("https");

const token = getBotToken();

if (!token || token.includes("YOUR_TELEGRAM_BOT_TOKEN") || token.length < 15) {
  console.log("\x1b[31m====================================================\x1b[0m");
  console.log("\x1b[31m✖ LỖI: Chưa cấu hình TELEGRAM_BOT_TOKEN hợp lệ!\x1b[0m");
  console.log("Vui lòng mở file \x1b[33m.env\x1b[0m và điền Token bot từ @BotFather.");
  console.log("\x1b[31m====================================================\x1b[0m");
  process.exit(1);
}

console.log("\x1b[32m====================================================================\x1b[0m");
console.log("\x1b[32m🚀 KHỞI ĐỘNG CHẾ ĐỘ DEV LOCAL (TELEGRAM LONG-POLLING)\x1b[0m");
console.log("Dự án: Super Finance GAS Bot (@SuperFinanceGAS_bot)");
console.log("Kiến trúc: SOLID Modular (src/core, src/services, src/controllers)");
console.log("Nhấn \x1b[33mCtrl + C\x1b[0m để dừng server dev.");
console.log("\x1b[32m====================================================================\x1b[0m\n");

function tgRequest(method, body = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

let isRunning = true;
let offset = 0;

async function initDev() {
  try {
    console.log("📡 Đang đồng bộ trạng thái với Telegram API...");
    const delRes = await tgRequest("deleteWebhook", { drop_pending_updates: false });
    if (delRes.ok) {
      console.log("✔ Đã chuyển Telegram sang chế độ Polling cục bộ.");
    }

    const meRes = await tgRequest("getMe");
    if (meRes.ok) {
      console.log(`🤖 Đã kết nối Bot: \x1b[36m@${meRes.result.username}\x1b[0m (${meRes.result.first_name})\n`);
      console.log("👉 Hãy mở Telegram và nhắn /start hoặc /ping cho bot để kiểm tra!\n");
    } else {
      console.log("\x1b[31m✖ Không thể lấy thông tin Bot. Kiểm tra lại Token!\x1b[0m", meRes);
      process.exit(1);
    }

    pollUpdates();
  } catch (err) {
    console.error("Lỗi khởi tạo:", err.message);
  }
}

async function pollUpdates() {
  while (isRunning) {
    try {
      const res = await tgRequest("getUpdates", {
        offset: offset,
        timeout: 25
      });

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;

          console.log(`\n\x1b[35m[📨 Update #${update.update_id}]\x1b[0m Nhận sự kiện từ Telegram:`);
          const fakeEvent = {
            postData: {
              contents: JSON.stringify(update)
            }
          };

          const startTime = Date.now();
          const gasResponse = doPost(fakeEvent);
          const elapsed = Date.now() - startTime;

          console.log(`\x1b[32m✔ Xử lý xong trong ${elapsed}ms | Output:\x1b[0m ${gasResponse.content}`);
        }
      }
    } catch (err) {
      if (isRunning) {
        console.error("\x1b[31m[Polling Error]\x1b[0m", err.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n\x1b[33m🛑 Đang dừng chế độ Local Dev...\x1b[0m");
  isRunning = false;
  setTimeout(() => {
    console.log("✔ Đã dừng hoàn toàn.");
    process.exit(0);
  }, 500);
});

initDev();
