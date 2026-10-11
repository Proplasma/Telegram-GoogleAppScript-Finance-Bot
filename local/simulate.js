/**
 * ============================================================
 * CÔNG CỤ GIẢ LẬP TIN NHẮN & KIỂM THỬ ANTI-REPLY-STORM (SIMULATOR)
 * Kiểm tra trực tiếp logic doPost(e), chống trùng lặp update_id
 * và cầu chì dừng khẩn cấp mà không cần gửi tin nhắn thật.
 * Sử dụng: npm run test:sim
 * ============================================================
 */

require("./gas-shim");

console.log("\x1b[36m=== KIỂM THỬ HỆ THỐNG SOLID & CHỐNG REPLY STORM ===\x1b[0m\n");

// 1. Giả lập một bản tin hợp lệ
const nowSec = Math.floor(Date.now() / 1000);
const mockUpdate = {
  update_id: 900001,
  message: {
    message_id: 1,
    date: nowSec,
    from: { id: 123456789, first_name: "Tester" },
    chat: { id: 123456789, type: "private" },
    text: "/status"
  }
};

console.log("▶ [Test 1] Gửi bản tin hợp lệ #900001:");
const res1 = doPost({ postData: { contents: JSON.stringify(mockUpdate) } });
console.log("Kết quả Test 1:", res1.toString(), "\n");

// 2. Giả lập Telegram gửi lặp lại cùng update_id #900001 (Reply Storm Simulation)
console.log("▶ [Test 2] Giả lập Telegram retry lặp lại Update #900001:");
const res2 = doPost({ postData: { contents: JSON.stringify(mockUpdate) } });
console.log("Kết quả Test 2 (Kỳ vọng bị chặn):", res2.toString(), "\n");

// 3. Giả lập bản tin cũ bị kẹt từ 10 phút trước (Stale Update Simulation)
const staleUpdate = {
  update_id: 900002,
  message: {
    message_id: 2,
    date: nowSec - 600,
    from: { id: 123456789, first_name: "Tester" },
    chat: { id: 123456789, type: "private" },
    text: "/ping"
  }
};
console.log("▶ [Test 3] Giả lập bản tin cũ bị dồn ứ từ 10 phút trước (#900002):");
const res3 = doPost({ postData: { contents: JSON.stringify(staleUpdate) } });
console.log("Kết quả Test 3 (Kỳ vọng bị chặn do quá hạn):", res3.toString(), "\n");

console.log("\x1b[32m✔ Hoàn tất kiểm thử giả lập!\x1b[0m");
