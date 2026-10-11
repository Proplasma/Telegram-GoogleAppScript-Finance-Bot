# Sự cố Kỹ thuật và Giải pháp Khắc phục (Troubleshooting)

Tài liệu ghi lại các vấn đề kỹ thuật thực tế phát sinh khi vận hành Bot Telegram trên Google Apps Script và giải pháp đã được tích hợp sẵn trong phiên bản **2.1.1**.

---

## 1. Sự cố: Lỗi "Wrong response from the webhook: 302 Found" gây lặp lệnh (Reply Storm)

### Nguyên nhân
1. Khi hàm `doPost(e)` trên Google Apps Script kết thúc bằng `ContentService.createTextOutput()`, máy chủ Google Frontend trả về mã phản hồi `HTTP 302 Found` để chuyển hướng sang tên miền `script.googleusercontent.com/macros/echo?...`.
2. Máy chủ Telegram Webhook không chấp nhận mã chuyển hướng `302` mà coi đó là lỗi gửi gói tin thất bại, dẫn đến việc Telegram tự động gửi lặp lại cùng một tin nhắn liên tục vào Webhook.
3. Nếu bộ lọc trùng lặp chỉ lưu trên `CacheService` trong thời gian ngắn, sau khi hết hạn cache, các bản tin gửi lại từ Telegram sẽ làm Bot thực thi lại lệnh cũ nhiều lần.

### Giải pháp đã áp dụng
1. Trong hàm `finishResponse()` tại `src/main.js`: Sử dụng `HtmlService.createHtmlOutput("OK")` khi chạy trên Google Apps Script để trả về trực tiếp mã `HTTP 200 OK`, chấm dứt hoàn toàn lỗi `302 Found`.
2. Trong `src/core/securityGuard.js`: Áp dụng cơ chế bảo vệ 3 tầng:
   - **Tầng 1:** Kiểm tra cờ ngắt mạch khẩn cấp `EMERGENCY_STOP`.
   - **Tầng 2:** Khử trùng lặp `update_id` kết hợp giữa `CacheService` và `PropertiesService` (`LAST_PROCESSED_UPDATE_ID` lưu bền vững).
   - **Tầng 3:** Từ chối các gói tin có thời gian khởi tạo quá `180 giây` (`MAX_MESSAGE_AGE_SECONDS`).

---

## 2. Sự cố: Gửi kèm Ảnh Hóa Đơn (Bill) nhưng không trả về Link Google Drive

### Nguyên nhân
1. Khi bổ sung dịch vụ `DriveApp` từ máy tính thông qua `clasp push` và `clasp deploy`, Google Apps Script yêu cầu chủ sở hữu tài khoản phải xác nhận quyền OAuth (`https://www.googleapis.com/auth/drive`) trên trình duyệt. Nếu chưa cấp quyền, lệnh gọi `DriveApp` bị từ chối trong khi `SpreadsheetApp` vẫn chạy bình thường.
2. Ngoài ra, người dùng trên Telegram có thói quen gửi ảnh theo nhiều cách khác nhau: gửi ảnh kèm caption, gửi ảnh rời trước rồi mới gõ lệnh `/c` ở tin nhắn sau, hoặc bấm Reply vào ảnh.

### Giải pháp đã áp dụng
1. Khai báo tường minh toàn bộ danh sách `oauthScopes` trong file `src/appsscript.json`.
2. Xây dựng file `src/GrantAllPermission.js` (và tích hợp thẳng vào `ActivateBot()` trong `src/F1ActivateBot.js`) để khi chạy kích hoạt lần đầu tiên, Google Apps Script sẽ yêu cầu cấp trọn bộ quyền (Drive, Sheets, UrlFetch, Triggers, HtmlService) trong 1 lần duy nhất.
3. Nâng cấp `src/services/driveService.js` hỗ trợ đồng thời cả 3 cách gửi ảnh:
   - Ảnh đính kèm trực tiếp cùng Caption lệnh.
   - Lệnh Reply vào một bức ảnh trước đó.
   - Ảnh gửi rời trong vòng 5 phút trước khi gõ lệnh `/c`, `/lcb`, `/clcb`.

---

## 3. Sự cố: Lỗi mã hóa Tiếng Việt có dấu trên môi trường Local Windows

### Nguyên nhân
Khi giả lập `UrlFetchApp.fetch` trên Windows bằng lệnh `curl --data "..."`, chuỗi JSON chứa ký tự tiếng Việt có dấu bị biến dạng bảng mã do cơ chế truyền tham số dòng lệnh của Windows.

### Giải pháp đã áp dụng
Trong `local/gas-shim.js`, truyền dữ liệu JSON dưới dạng luồng nhị phân qua `stdin` (`--data-binary @-`) sử dụng `Buffer.from(payloadStr, "utf-8")` trong `execFileSync("curl", ...)`, giúp bảo toàn 100% ký tự tiếng Việt trên mọi hệ điều hành.
