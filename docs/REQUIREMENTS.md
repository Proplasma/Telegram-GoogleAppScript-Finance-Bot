# Yêu cầu Nghiệp vụ và Quy chuẩn Kỹ thuật (Phiên bản 2.2.0 - Hybrid UI)

Tài liệu này tổng hợp toàn bộ các yêu cầu chức năng, kiến trúc giao diện đa tầng, quy ước cú pháp lệnh và quy tắc vận hành bắt buộc của dự án **Telegram GAS Finance Bot (v2.2.0)**.

---

## 1. Yêu cầu Giao diện Đa Tầng (3-Layer Hybrid UI)

Hệ thống bắt buộc duy trì song song cả 3 lớp tương tác để phục vụ cả người dùng không quen gõ lệnh lẫn người dùng thích tốc độ dòng lệnh:

### 1.1. Tầng 1: Giao diện Đồ họa `Open UI Mode` (Telegram Web App 3 Tab)
- Mở trực tiếp từ nút **Open UI Mode** trên bàn phím cố định ở đáy màn hình Telegram.
- Thiết kế gồm 3 Tab chức năng với thanh cuộn dọc mảnh và bảng màu phân biệt rõ ràng:
  1. **Tab 1 - Ghi Thu Chi:** Chọn Quỹ (`/c`, `/lcb`, `/clcb`), chọn chiều giao dịch (`CHI RA (-)` màu đỏ, `THU VÀO (+)` màu xanh), chọn nhanh thẻ Ngân hàng và `#Tag`, bàn phím máy tính đầy đủ (`+`, `-`, `*`, `/`, ngoặc đơn `( )`, `.000`, `.000.000`, `=`), ô ghi chú và nút đính kèm ảnh hóa đơn (Bill) tải trực tiếp lên Google Drive.
  2. **Tab 2 - Số Dư & Hạn Mức:** Bảng tổng hợp số dư từng Ngân hàng của cả 2 Quỹ, danh sách thanh tiến độ hạn mức chi tiêu theo `#Tag` (tự động đổi màu Xanh / Vàng / Đỏ theo tỷ lệ phần trăm), và biểu mẫu cập nhật hạn mức mới.
  3. **Tab 3 - Lịch Sử & Sổ:** Xem 5 giao dịch gần nhất kèm đường dẫn ảnh Bill, nút Hoàn tác giao dịch cuối (`/undo`), nút Chốt sổ tháng mới (`/chotso`) và Reset số dư về 0 (`/reset`).

### 1.2. Tầng 2: Bàn phím Cố định 3 Nút (Tối ưu Z Fold) & Chọn nút 4 bước trong Chat (In-Chat Wizard)
- Hiển thị bàn phím cố định (Persistent Reply Keyboard) dưới đáy khung chat gồm 3 nút thao tác chính (`📱 Mở App Thu Chi (UI Mode)`, `📊 Số Dư`, `📜 Lịch sử`).
- Khi gõ `/ghi`, Bot dẫn dắt qua 4 bước chọn nút Inline ngay trong luồng chat: Chọn Quỹ -> Chọn Ngân hàng -> Chọn `#Tag` -> Nhập số tiền/biểu thức và ghi chú.

### 1.3. Tầng 3: Dòng lệnh truyền thống (CLI Commands)
- Mọi lệnh điều khiển gõ trực tiếp đều bắt đầu bằng ký tự `/`.
- Cấu trúc chuẩn:
  ```text
  /<lệnh> <Ngân_Hàng> [#TAG] <Số_Tiền_Hoặc_Biểu_Thức> [Ghi chú]
  ```
- **Quy tắc dấu và biểu thức toán học:**
  - Có dấu `+` hoặc **không ghi dấu** (ví dụ: `50k`, `+50k`, `200.000`) -> Hiểu là khoản **THU** (cộng vào số dư).
  - Có dấu `-` ở đầu (ví dụ: `-50k`, `-(120k+30k)/3`) -> Hiểu là khoản **CHI** (trừ vào số dư).
  - Hỗ trợ đầy đủ 4 phép toán Cộng (`+`), Trừ (`-`), Nhân (`*`, `×`), Chia (`/`, `÷`) và Ngoặc đơn `( )`.
- **Quy tắc giá trị mặc định:**
  - Không nhập `<Ngân_Hàng>` -> Tự động gán là `Chung`.
  - Không nhập `#Tag` -> Tự động gán là `#CHUNG`.

---

## 2. Yêu cầu Quản lý Dữ liệu, Ảnh Bill, Ủy quyền Nhóm 1 Chạm & Bảo mật

1. **Tự động lưu Ảnh Hóa Đơn (Bill) lên Google Drive:**
   - Lưu ảnh vào thư mục `SuperFinanceBot_Bills` trên Google Drive qua cả 4 hình thức: tải lên từ màn hình `Open UI Mode`, gửi ảnh kèm Caption lệnh, gửi ảnh rời trước câu lệnh (trong 5 phút), hoặc bấm Reply lệnh vào ảnh.
2. **Lưu sổ liên thông qua các kỳ (`/reset` và `/chotso`):**
   - Toàn bộ các dòng giao dịch hiện có trong `Thu Chi` và `Quỹ Phụ` được di chuyển nguyên vẹn sang nối tiếp ở cuối bảng `Lịch Sử Chốt Sổ`, tạo thành sổ cái liên thông xuyên suốt các tháng, tuyệt đối không làm mất dữ liệu cũ.
3. **Phân quyền Đa Tài khoản (`ALLOWED_USER_IDS`) & Tự lấy Group Info / Cấp quyền Nhóm 1 Chạm (`ALLOWED_GROUP_IDS`):**
   - Cho phép nhiều tài khoản cá nhân (`ALLOWED_USER_IDS`) và nhiều nhóm chat (`ALLOWED_GROUP_IDS`) truy cập theo danh sách ID ngăn cách bởi dấu phẩy.
   - Khi đưa Bot vào nhóm (đã cấp quyền Admin cho Bot) và gõ `/id` hoặc `/setgroup`, Bot tự động lấy thông tin nhóm (`Group ID` âm `-100...`, tên nhóm) và hiển thị nút bấm Inline **1 chạm** để Admin lưu đè `Group ID` vào `PropertiesService` ngay trên Telegram mà không cần sửa code thủ công.
   - Tài khoản/nhóm không có trong danh sách chỉ nhận phản hồi mặc định: `Bot 2.2.0 Loading...`.
4. **Bảo toàn `F1ActivateBot.js`, mục điền `WEBAPP_URL` và `GrantAllPermission.js`:**
   - File `F1ActivateBot.js` luôn ở vị trí số 1 và `GrantAllPermission.js` ở vị trí số 2.
   - Hàm `ActivateBot()` tự động gọi `GrantAllPermissions()` để cấp trọn bộ quyền Google Apps Script trong 1 lần bấm Run duy nhất.

