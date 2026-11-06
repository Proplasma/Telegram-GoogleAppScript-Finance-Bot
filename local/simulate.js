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

// 4. Kiểm thử Hộp thoại Xác nhận Hoàn tác Giao dịch (Undo Confirmation)
console.log("▶ [Test 4] Kiểm thử luồng Hộp thoại Xác nhận Hoàn tác Giao dịch:");
const adminId = getAllowedUserIds()[0] || "8544500048";

// 4.1 Thêm 1 giao dịch mẫu
const txParsed = parseTransactionArgs("MB #ANUONG -50k Cơm trưa kiểm thử");
const txResult = executeFinanceTransaction("c", txParsed, "Admin (" + adminId + ")", { uploaded: false, fileUrl: "" });
const match = txResult.text.match(/Mã GD:<\/b> <code>([^<]+)<\/code>/);
const sampleTxId = match ? match[1] : "";
console.log("   - Đã tạo GD mẫu:", sampleTxId);

// 4.2 Gọi buildUndoConfirmationPreview -> Kỳ vọng trả về hộp thoại xác nhận kèm 2 nút Inline
const confirmPreview = buildUndoConfirmationPreview("c", sampleTxId);
const hasConfirmBtn = confirmPreview.replyMarkup &&
  confirmPreview.replyMarkup.inline_keyboard[0][0].callback_data === "confirm_undo:c:" + sampleTxId;
const hasCancelBtn = confirmPreview.replyMarkup &&
  confirmPreview.replyMarkup.inline_keyboard[0][1].callback_data === "cancel_undo:c:" + sampleTxId;
console.log("   - Hộp thoại chứa nút Xác nhận & Hủy bỏ:", (hasConfirmBtn && hasCancelBtn) ? "PASSED ✅" : "FAILED ❌");

// 4.3 Giả lập bấm nút Hủy bỏ (cancel_undo)
const cancelCallback = {
  update_id: 900003,
  callback_query: {
    id: "cb_cancel_1",
    from: { id: Number(adminId), first_name: "Admin" },
    message: { message_id: 10, chat: { id: Number(adminId), type: "private" } },
    data: "cancel_undo:c:" + sampleTxId
  }
};
doPost({ postData: { contents: JSON.stringify(cancelCallback) } });
// Kiểm tra giao dịch vẫn còn trong Sheet
const stillExists = getAllTransactionRows(SHEET_NAMES.PERSONAL).some(r => r.txId === sampleTxId);
console.log("   - Bấm Hủy bỏ -> Giao dịch vẫn được giữ nguyên:", stillExists ? "PASSED ✅" : "FAILED ❌");

// 4.4 Giả lập bấm nút Xác nhận Hoàn tác (confirm_undo)
const confirmCallback = {
  update_id: 900004,
  callback_query: {
    id: "cb_confirm_1",
    from: { id: Number(adminId), first_name: "Admin" },
    message: { message_id: 10, chat: { id: Number(adminId), type: "private" } },
    data: "confirm_undo:c:" + sampleTxId
  }
};
doPost({ postData: { contents: JSON.stringify(confirmCallback) } });
// Kiểm tra giao dịch đã bị xóa thành công
const deletedSuccessfully = !getAllTransactionRows(SHEET_NAMES.PERSONAL).some(r => r.txId === sampleTxId);
console.log("   - Bấm Xác nhận Hoàn tác -> Giao dịch đã được xóa thành công:", deletedSuccessfully ? "PASSED ✅" : "FAILED ❌");

console.log("\x1b[32m✔ Hoàn tất kiểm thử giả lập!\x1b[0m");
