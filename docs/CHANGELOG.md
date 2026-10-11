# Nhật ký Thay đổi Phiên bản (Changelog)

---

## Phiên bản 2.1.1 (11/10/2026)
- **Lưu sổ liên thông cho lệnh `/reset` và `/chotso`:**
  - Nâng cấp bảng `Lịch Sử Chốt Sổ` lên cấu trúc 11 cột chuẩn.
  - Bổ sung hàm `archiveTransactionsToHistorySheet()` trong `src/services/sheetService.js`: Di chuyển nguyên vẹn từng dòng giao dịch của cả 2 bảng (`Thu Chi` và `Quỹ Phụ`) nối tiếp vào bảng `Lịch Sử Chốt Sổ` kèm dòng tổng kết kỳ, đảm bảo không mất bất kỳ giao dịch hay link ảnh Bill nào qua các tháng.
- **Tích hợp cấp quyền 1 chạm (`GrantAllPermission.js`) & cố định `F1ActivateBot.js`:**
  - Tạo module `src/GrantAllPermission.js` kích hoạt đồng thời 7 nhóm quyền của Google Apps Script trong 1 lần chạy duy nhất.
  - Cố định `F1ActivateBot.js` ở vị trí số 1 và `GrantAllPermission.js` ở vị trí số 2 trong `filePushOrder` của `.clasp.json`, giữ nguyên mục điền `WEBAPP_URL` tại đầu dự án.
- **Chuẩn hóa giao diện văn bản & Tài liệu dự án:**
  - Loại bỏ các biểu tượng trang trí không cần thiết, trình bày lại khung bảng Unicode rõ ràng và biên tập bộ tài liệu kỹ thuật trong `docs/` và `README.md`.

---

## Phiên bản 2.1.0 (11/10/2026)
- **Phân quyền Đa Tài khoản (`ALLOWED_USER_IDS`):**
  - Cho phép nhiều tài khoản Telegram truy cập Bot theo danh sách ID ngăn cách bởi dấu phẩy.
  - Tự động trả về `Bot <Phiên bản> Loading...` đối với các tài khoản không nằm trong danh sách cho phép.
- **Hệ thống Quản lý Thu Chi Đa Quỹ & Đa Ngân Hàng:**
  - Triển khai 3 lệnh chính `/c` (Quỹ Cá Nhân), `/lcb` (Quỹ Phụ), `/clcb` (Ghi đồng thời 2 quỹ) theo cấu trúc `/c <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]`.
  - Hỗ trợ mặc định Ngân hàng `Chung` và phân loại `#CHUNG` khi người dùng lược bỏ.
  - Quy ước dấu: `+` hoặc không ghi dấu là Thu vào; dấu `-` là Chi ra.
- **Tự động tải Ảnh Hóa Đơn (Bill) lên Google Drive (`driveService.js`):**
  - Hỗ trợ nhận diện ảnh từ Caption, Reply hoặc ảnh gửi rời trước câu lệnh.
  - Lưu file vào thư mục `SuperFinanceBot_Bills` trên Google Drive, trả về link xem ảnh và ghi vào cột `Link Ảnh Bill` trên Google Sheets.
- **Bộ lệnh Báo cáo, Hạn mức & Hoàn tác:**
  - Bổ sung các lệnh `/sodu` (`/balance`), `/ls` (`/history`), `/limit`, `/undo`, `/chotso` (`/renew`), `/reset`.
  - Tự động tạo mới file Google Spreadsheet riêng biệt gắn với dự án Google Apps Script gồm 5 bảng: `Thu Chi`, `Quỹ Phụ`, `Hạn Mức`, `Lịch Sử Chốt Sổ`, `Logs`.

---

## Phiên bản 2.0.0: Host Core Bot on GAS (11/10/2026)
- Thiết lập nền tảng phát triển và triển khai tự động qua Google Clasp (`@google/clasp`).
- Xây dựng kiến trúc SOLID cơ sở, bộ giả lập môi trường `local/gas-shim.js` và hệ thống bảo vệ 3 tầng chống lặp lệnh (`securityGuard.js` + `HtmlService.createHtmlOutput("OK")`).
