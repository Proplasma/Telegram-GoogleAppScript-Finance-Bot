# Sự cố Kỹ thuật và Giải pháp Khắc phục (Troubleshooting)

Tài liệu ghi lại các vấn đề kỹ thuật thực tế phát sinh khi vận hành Bot Telegram trên Google Apps Script và giải pháp đã được tích hợp sẵn trong phiên bản **2.2.0 (Hybrid UI)**.

---

## 1. Sự cố: Lỗi "Wrong response from the webhook: 302 Found" gây lặp lệnh (Reply Storm)

### Nguyên nhân
1. Khi hàm `doPost(e)` trên Google Apps Script kết thúc bằng `ContentService.createTextOutput()`, máy chủ Google Frontend trả về mã phản hồi `HTTP 302 Found` để chuyển hướng sang tên miền `script.googleusercontent.com/macros/echo?...`.
2. Máy chủ Telegram Webhook không chấp nhận mã chuyển hướng `302` mà coi đó là lỗi gửi gói tin thất bại, dẫn đến việc Telegram tự động gửi lặp lại cùng một tin nhắn liên tục vào Webhook.

### Giải pháp đã áp dụng
1. Trong hàm `finishResponse()` tại `src/main.js`: Sử dụng `HtmlService.createHtmlOutput("OK")` khi chạy trên Google Apps Script để trả về trực tiếp mã `HTTP 200 OK`, chấm dứt hoàn toàn lỗi `302 Found`.
2. Trong `src/core/securityGuard.js`: Áp dụng cơ chế bảo vệ 3 tầng:
   - **Tầng 1:** Kiểm tra cờ ngắt mạch khẩn cấp `EMERGENCY_STOP`.
   - **Tầng 2:** Khử trùng lặp `update_id` kết hợp giữa `CacheService` và `PropertiesService` (`LAST_PROCESSED_UPDATE_ID` lưu bền vững).
   - **Tầng 3:** Từ chối các gói tin có thời gian khởi tạo quá `180 giây` (`MAX_MESSAGE_AGE_SECONDS`).

---

## 2. Sự cố: Gửi kèm Ảnh Hóa Đơn (Bill) nhưng không trả về Link Google Drive

### Nguyên nhân
1. Khi bổ sung dịch vụ `DriveApp`, Google Apps Script yêu cầu chủ sở hữu tài khoản phải xác nhận quyền OAuth (`https://www.googleapis.com/auth/drive`) trên trình duyệt.
2. Người dùng có thể tải ảnh từ nhiều nguồn: chọn ảnh trong giao diện Web App (`Open UI Mode`), gửi ảnh kèm caption, gửi ảnh rời trước rồi mới gõ lệnh `/c`, hoặc bấm Reply vào ảnh.

### Giải pháp đã áp dụng
1. Khai báo tường minh toàn bộ danh sách `oauthScopes` trong file `src/appsscript.json`.
2. Xây dựng file `src/GrantAllPermission.js` (được gọi tự động trong `ActivateBot()`) để cấp trọn bộ quyền (Drive, Sheets, UrlFetch, Triggers, HtmlService) trong 1 lần bấm Run duy nhất.
3. Nâng cấp `src/services/driveService.js` với cả `uploadBase64BillToDrive()` (cho Web App UI) và `uploadBillPhotoFromMessage()` (cho luồng chat Telegram).

---

## 3. Sự cố: Giao diện Web App (`Open UI Mode`) không nhúng được trong khung Telegram nếu thiếu cấu hình Frame

### Nguyên nhân
Mặc định `HtmlService` trên Google Apps Script chặn hiển thị trang bên trong `iframe` của ứng dụng bên thứ ba nếu không bật cờ `XFrameOptionsMode.ALLOWALL`.

### Giải pháp đã áp dụng
Trong hàm `doGet(e)` tại `src/main.js`, thiết lập `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` kết hợp thẻ meta `viewport` chuẩn di động, giúp cửa sổ **Open UI Mode** mở mượt mà trên cả Telegram Desktop, iOS và Android.

---

## 4. Sự cố: Đưa Bot vào Nhóm Chat (Group) nhưng Bot không đọc được tin nhắn hoặc báo lỗi `400 BUTTON_TYPE_INVALID`

### Nguyên nhân
1. Mặc định Telegram bật chế độ **Group Privacy** cho mọi Bot mới tạo, khiến Bot trong nhóm không nhận được tin nhắn thường hoặc ảnh hóa đơn nếu người dùng không gõ `@TenBot`.
2. Việc tìm `Group ID` (dãy số âm `-100...`) của nhóm rồi mở lại trình duyệt sửa code khá phức tạp với người dùng.
3. Telegram Bot API cấm gửi nút có thuộc tính `web_app: { url }` bên trong `ReplyKeyboardMarkup` hoặc `InlineKeyboardMarkup` khi gửi vào Group Chat (`chatId < 0`), trả về lỗi `400 Bad Request: BUTTON_TYPE_INVALID`.

### Giải pháp chuẩn hóa đã áp dụng (Dùng cho cả các dự án Bot về sau)
1. **Cấp quyền Admin cho Bot trong Nhóm:** Khi thêm Bot vào nhóm và cấp quyền Quản trị viên (Admin), Bot tự động đọc được mọi câu lệnh, nút bấm bàn phím đáy và ảnh hóa đơn mà không cần tag `@TenBot`.
2. **Tự lấy Group Info & Cấp quyền Nhóm 1 chạm (`/id` & `/setgroup`):**
   - Admin chỉ cần gõ `/id` hoặc `/setgroup` ngay trong nhóm chat.
   - Bot sẽ hiển thị thông tin nhóm kèm nút bấm Inline **`✅ Cấp quyền luôn cho Nhóm này (Ghi đè thiết lập)`** (`group_auth:set:<groupId>`), lưu thẳng `Group ID` vào `PropertiesService` trên Google Apps Script mà không cần mở trình duyệt sửa code.
3. **Tự động chuyển đổi nút Web App khi ở trong Nhóm (`chatId < 0`):**
   - Hàm `buildMainReplyKeyboard(userId, chatId)` tự động kiểm tra `Number(chatId) < 0`. Nếu ở trong nhóm, nút `📱 Mở App Thu Chi (UI Mode)` chuyển sang nút Text thường, và khi thành viên bấm vào sẽ nhận được nút Inline chuẩn dạng `url` để mở giao diện Web App an toàn mà không bao giờ gặp lỗi `400 BUTTON_TYPE_INVALID`.

