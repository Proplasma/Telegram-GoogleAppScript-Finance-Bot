# Nhật ký Thay đổi Phiên bản (Changelog)

---

## Phiên bản 2.2.0: Hybrid UI - Giao diện Đa Tầng, Tối ưu Màn hình Hẹp (Z Fold) & Máy tính Biểu thức (12/10/2026)
- **Kiến trúc Giao diện Đa Tầng (3-Layer Hybrid UI):**
  - **Tầng 1 (`Open UI Mode` - Web App 3 Tab):** Thêm giao diện đồ họa `src/uiWebApp.html` mở trực tiếp từ bàn phím đáy màn hình Telegram, gồm 3 Tab (`Ghi Thu Chi`, `Số Dư & Hạn Mức`, `Lịch Sử & Sổ`), tích hợp thanh cuộn dọc hiện đại, bảng màu phân biệt Quỹ/Thu/Chi và tính năng tải ảnh hóa đơn (Bill) trực tiếp từ thiết bị lên Google Drive (`uploadBase64BillToDrive`).
  - **Tầng 2 (`In-Chat Wizard` & Bàn phím cố định 3 nút):** Tinh gọn bàn phím cố định dưới đáy màn hình (`buildMainReplyKeyboard` trong `src/controllers/uiController.js`) còn đúng 3 nút chính: `📱 Mở App Thu Chi (UI Mode)`, `📊 Số Dư`, và `📜 Lịch sử` (5 giao dịch gần nhất), đồng thời hỗ trợ luồng chọn nút 4 bước ngay trong khung chat (`/ghi`).
  - **Tầng 3 (`CLI Commands`):** Giữ nguyên và tương thích 100% với toàn bộ tập lệnh bắt đầu bằng dấu `/`.
- **Tối ưu Hiển thị Tin nhắn cho Màn hình Hẹp (Samsung Galaxy Z Fold):**
  - Thay thế bảng kẻ khung `<pre>` rộng 44 ký tự bằng bố cục tách dòng dọc (giãn cách 1 dòng trắng `\n\n` giữa mỗi dòng phản hồi), hiển thị tiếng Việt có dấu đầy đủ, kết hợp thẻ `<blockquote>` và `<code>` chuẩn Telegram.
  - Tối giản hóa khung hiển thị Hạn mức (`🎯 Hạn mức #Tag`, `• Đã chi`, `• Còn lại`), tách riêng mục `📸 ẢNH HÓA ĐƠN (BILL)` và `📊 Mở bảng Google Sheets` cách nhau 1 dòng trắng.
- **Nâng cấp Bộ phân tích Biểu thức Toán học (`src/core/financeParser.js`):**
  - Bổ sung bộ phân tích đệ quy (Recursive Descent Parser) hỗ trợ đầy đủ 4 phép tính Cộng (`+`), Trừ (`-`), Nhân (`*`, `×`), Chia (`/`, `÷`), Ngoặc đơn `( )` và các đơn vị tiền tệ viết tắt (`k`, `tr`, `1tr5`) trên cả bàn phím máy tính UI và câu lệnh chat.
- **Tự động Lấy Thông tin Nhóm & Cấp quyền Nhóm Chat 1 Chạm (`ALLOWED_GROUP_IDS`, `/id`, `/setgroup`):**
  - Bổ sung cơ chế phân quyền nhóm chat (`ALLOWED_GROUP_IDS`) song song với phân quyền cá nhân (`ALLOWED_USER_IDS`).
  - Khi thêm Bot vào nhóm Telegram (đã cấp quyền Admin cho Bot), người quản trị chỉ cần gõ `/id` hoặc `/setgroup` ngay trong nhóm: Bot tự động trả về thông tin nhóm (`Group ID` âm `-100...`, tên nhóm) kèm nút bấm Inline **1 chạm** (`✅ Cấp quyền luôn cho Nhóm này`) để ghi đè trực tiếp vào `PropertiesService` mà không cần mở trình duyệt sửa code.
  - Tự động tương thích bàn phím cố định 3 nút trong môi trường Group Chat (`chatId < 0`) nhằm loại bỏ lỗi `400 BUTTON_TYPE_INVALID` của Telegram API.
- **Đóng gói Bộ cài đặt Thủ công (`manual-copy-paste/`):**
  - Bổ sung thư mục `manual-copy-paste/` (gộp sẵn thành 3 file `1_F1ActivateBot.gs`, `2_Code.gs`, `3_uiWebApp.html` kèm `appsscript.json`) và hướng dẫn từng bước trong `README.md` dành cho người không chuyên code.

---

## Phiên bản 2.1.1 (11/10/2026)
- **Lưu sổ liên thông cho lệnh `/reset` và `/chotso`:**
  - Nâng cấp bảng `Lịch Sử Chốt Sổ` lên cấu trúc 11 cột chuẩn.
  - Bổ sung hàm `archiveTransactionsToHistorySheet()` trong `src/services/sheetService.js`: Di chuyển nguyên vẹn từng dòng giao dịch của cả 2 bảng (`Thu Chi` và `Quỹ Phụ`) nối tiếp vào bảng `Lịch Sử Chốt Sổ` kèm dòng tổng kết kỳ, đảm bảo không mất bất kỳ giao dịch hay link ảnh Bill nào qua các tháng.
- **Tích hợp cấp quyền 1 chạm (`GrantAllPermission.js`) & cố định `F1ActivateBot.js`:**
  - Tạo module `src/GrantAllPermission.js` kích hoạt đồng thời 7 nhóm quyền của Google Apps Script trong 1 lần chạy duy nhất.
  - Cố định `F1ActivateBot.js` ở vị trí số 1 và `GrantAllPermission.js` ở vị trí số 2 trong `filePushOrder` của `.clasp.json`.

---

## Phiên bản 2.1.0 (11/10/2026)
- **Phân quyền Đa Tài khoản (`ALLOWED_USER_IDS`)** và quản lý Thu Chi Đa Quỹ (`/c`, `/lcb`, `/clcb`).
- **Tự động tải Ảnh Hóa Đơn (Bill) lên Google Drive (`driveService.js`)**.
- **Bộ lệnh Báo cáo, Hạn mức & Hoàn tác (`/sodu`, `/ls`, `/limit`, `/undo`, `/chotso`, `/reset`)**.

---

## Phiên bản 2.0.0: Host Core Bot on GAS (11/10/2026)
- Thiết lập nền tảng phát triển và triển khai tự động qua Google Clasp (`@google/clasp`), kiến trúc SOLID cơ sở và hệ thống bảo vệ 3 tầng chống lặp lệnh (`securityGuard.js` + `HtmlService.createHtmlOutput("OK")`).
