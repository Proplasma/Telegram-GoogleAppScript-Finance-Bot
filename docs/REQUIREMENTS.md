# Yêu cầu Nghiệp vụ và Quy chuẩn Kỹ thuật (Phiên bản 2.1.1)

Tài liệu này tổng hợp toàn bộ các yêu cầu chức năng, quy ước cú pháp lệnh và quy tắc vận hành bắt buộc của dự án **Telegram GAS Finance Bot (v2.1.1)**.

---

## 1. Yêu cầu Nghiệp vụ Tài chính

### 1.1. Quản lý Đa Quỹ (`/c`, `/lcb`, `/clcb`)
- **`/c` (Quỹ Cá Nhân):** Ghi nhận các khoản thu và chi cá nhân vào bảng `Thu Chi`.
- **`/lcb` (Quỹ Phụ):** Ghi nhận các khoản thu và chi của quỹ phụ vào bảng `Quỹ Phụ`.
- **`/clcb` (Ghi đồng thời 2 quỹ):** Ghi nhận cùng một giao dịch vào cả 2 bảng `Thu Chi` và `Quỹ Phụ` với cùng Mã GD, Ngân hàng và `#Tag`. Khi hoàn tác (`/undo`), hệ thống tự động xóa đồng bộ ở cả 2 bảng.

### 1.2. Quy tắc Cú pháp Nhập liệu
- Bắt buộc mọi lệnh điều khiển đều phải bắt đầu bằng ký tự `/`.
- Cấu trúc chuẩn:
  ```text
  /<lệnh> <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]
  ```
- **Quy tắc dấu số tiền:**
  - Có dấu `+` hoặc **không ghi dấu** (ví dụ: `50k`, `+50k`, `200.000`) -> Hiểu là khoản **THU** (cộng vào số dư).
  - Có dấu `-` ở đầu (ví dụ: `-50k`, `-200.000`) -> Hiểu là khoản **CHI** (trừ vào số dư).
- **Quy tắc giá trị mặc định:**
  - Nếu người dùng không nhập `<Ngân_Hàng>`, tự động gán là `Chung` (nếu dùng tiền mặt người dùng sẽ chủ động nhập `CASH`).
  - Nếu người dùng không nhập `#Tag`, tự động gán là `#CHUNG`.

### 1.3. Tự động lưu Ảnh Hóa Đơn (Bill) lên Google Drive
- Khi người dùng gửi tin nhắn kèm ảnh hóa đơn (hoặc gửi ảnh trước rồi nhập lệnh ngay sau, hoặc trả lời lệnh vào ảnh), Bot tự động tải ảnh có độ phân giải cao nhất từ Telegram lên thư mục `SuperFinanceBot_Bills` trên Google Drive.
- Đường dẫn xem ảnh được trả về ngay trong tin nhắn phản hồi và được lưu vào cột `Link Ảnh Bill` trong bảng giao dịch tương ứng.

### 1.4. Lưu sổ liên thông qua các kỳ (`/reset` và `/chotso`)
- Tuyệt đối không xóa mất dữ liệu giao dịch lịch sử khi sang tháng mới hoặc khi reset.
- Khi gọi `/reset` hoặc `/chotso`:
  - Toàn bộ từng dòng giao dịch hiện có trong `Thu Chi` và `Quỹ Phụ` phải được di chuyển nguyên vẹn sang nối tiếp ở cuối bảng `Lịch Sử Chốt Sổ`, tạo thành một sổ cái lịch sử liên thông xuyên suốt các tháng.
  - Với `/reset`: Sau khi chuyển toàn bộ giao dịch cũ sang `Lịch Sử Chốt Sổ`, làm trống bảng hiện tại để toàn bộ số dư các Ngân hàng, `#Tag` và 2 Quỹ trở về `0 đ`.
  - Với `/chotso` (`/renew`): Sau khi chuyển toàn bộ giao dịch cũ sang `Lịch Sử Chốt Sổ`, gom số dư hiện tại của từng cặp `(Ngân hàng, #Tag)` thành các dòng `Số dư đầu kỳ` cho kỳ mới.

### 1.5. Phân quyền Đa Tài khoản (`ALLOWED_USER_IDS`)
- Cho phép cấu hình nhiều tài khoản Telegram được phép sử dụng Bot, ngăn cách bởi dấu phẩy (ví dụ: `8544500048, 1678072401`).
- Nếu tài khoản không nằm trong danh sách được phép nhắn tin tới Bot, hệ thống chặn toàn bộ xử lý phía sau và chỉ trả về chuỗi:
  ```text
  Bot 2.1.1 Loading...
  ```

---

## 2. Quy chuẩn Kỹ thuật & Vận hành Bắt buộc

1. **Kiến trúc SOLID & Ghi chú đầu file:**
   - Mã nguồn trong `src/` được tách theo đúng trách nhiệm: `core/`, `services/`, `controllers/`, `F1ActivateBot.js`, `GrantAllPermission.js`, `main.js`.
   - Dòng đầu tiên của mọi file mã nguồn bắt buộc có ghi chú tên file đó (ví dụ: `// F1ActivateBot.js //`).
2. **Bảo toàn `F1ActivateBot.js`, mục điền `WEBAPP_URL` và `GrantAllPermission.js`:**
   - File `F1ActivateBot.js` luôn được đặt ở vị trí số 1 và `GrantAllPermission.js` ở vị trí số 2 trong `filePushOrder` của `.clasp.json`.
   - Tuyệt đối không xóa hoặc ẩn mục điền `'WEBAPP_URL'` trong hàm `setupEnvironment()`.
   - Hàm `ActivateBot()` luôn gọi `GrantAllPermissions()` để cấp toàn bộ quyền Google Apps Script trong 1 lần chạy duy nhất.
3. **Chống hiện tượng Lặp lệnh (Anti-Reply-Storm) & Cầu chì dừng khẩn cấp:**
   - Hàm `doPost(e)` luôn trả về `HtmlService.createHtmlOutput("OK")` trên Google Apps Script để tránh lỗi `302 Found Redirect`.
   - Kiểm tra 3 tầng bảo vệ trong `securityGuard.js`: Cờ `EMERGENCY_STOP`, khử trùng lặp `update_id` (`CacheService` + `ScriptProperties`), và bỏ qua tin nhắn quá hạn (`MAX_MESSAGE_AGE_SECONDS = 180`).
