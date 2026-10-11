# Telegram GAS Finance Bot - Phiên bản 2.2.0 (Hybrid UI)

Hệ thống Bot Telegram quản lý tài chính đa quỹ hoạt động hoàn toàn trên nền tảng **Google Apps Script (V8 Runtime)**, lưu trữ dữ liệu tự động vào **Google Sheets**, tải ảnh hóa đơn (Bill) lên **Google Drive**, và hỗ trợ song song **3 phương thức tương tác (Hybrid UI)**: Giao diện đồ họa 3 Tab (**Open UI Mode**), Nút bấm từng bước trong khung chat (**In-Chat Wizard**), và Dòng lệnh truyền thống (**CLI Commands**).

---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 1: TỔNG QUAN GIAO DIỆN BOT & OPEN UI MODE       -->
<!-- Tên file ảnh gợi ý: ./images/01-tong-quan-giao-dien-bot.png       -->
<!-- ================================================================= -->

![Ảnh minh họa 01 - Tổng quan giao diện Bot và Open UI Mode trên Telegram](./images/01-tong-quan-giao-dien-bot.png)

<!-- ================================================================= -->


---

## 1. Tính năng cốt lõi của Phiên bản 2.2.0 (Hybrid UI)

1. **Tương tác Đa Tầng Song Song (3-Layer Hybrid UI):**
   - **Tầng 1 - Giao diện Đồ họa `Open UI Mode` (Telegram Web App 3 Tab):**
     - Mở trực tiếp từ nút **Open UI Mode** trên bàn phím cố định dưới đáy màn hình Telegram.
     - **Tab 1 (Ghi Thu Chi):** Chọn Quỹ (`/c`, `/lcb`, `/clcb`), chọn chiều Thu/Chi, chọn nhanh thẻ Ngân hàng và `#Tag` (hiển thị kèm số dư trực tiếp), bàn phím máy tính đầy đủ phép toán (`+`, `-`, `*`, `/`, ngoặc đơn `( )`, phím tắt `.000`, `.000.000`, nút `=`), ô nhập ghi chú và nút đính kèm ảnh hóa đơn (Bill) tải thẳng lên Google Drive.
     - **Tab 2 (Số Dư & Hạn Mức):** Bảng đối chiếu số dư từng Ngân hàng giữa 2 Quỹ, thanh tiến độ phần trăm hạn mức chi tiêu theo `#Tag`, và biểu mẫu cài đặt hạn mức mới.
     - **Tab 3 (Lịch Sử & Sổ):** Danh sách 5 giao dịch gần nhất kèm đường dẫn xem ảnh Bill, nút Hoàn tác giao dịch vừa nhập (`/undo`), nút Chốt sổ tháng mới (`/chotso`) và Reset số dư về 0 (`/reset`).
   - **Tầng 2 - Bàn phím Cố định & Chọn nút 4 bước trong Chat (In-Chat Wizard):**
     - Cung cấp 7 nút chức năng cố định dưới đáy màn hình: `Open UI Mode`, `Ghi Thu / Chi`, `Xem Số Dư`, `5 GD Gần Nhất`, `Hoàn Tác (Undo)`, `Đặt Hạn Mức`, `Chốt Sổ / Reset`.
     - Khi bấm `Ghi Thu / Chi` (hoặc gõ `/ghi`), Bot hiển thị bảng nút bấm dẫn dắt từng bước ngay trong khung chat: Bước 1 (Chọn Quỹ) -> Bước 2 (Chọn Ngân hàng) -> Bước 3 (Chọn `#Tag`) -> Bước 4 (Nhập số tiền/phép tính và ghi chú).
   - **Tầng 3 - Dòng lệnh truyền thống (CLI Commands):**
     - Giữ nguyên 100% tốc độ gõ lệnh nhanh cho người quen dùng bàn phím (`/c`, `/lcb`, `/clcb`, `/sodu`, `/ls`, `/limit`, `/undo`, `/chotso`, `/reset`, `/status`, `/id`).
2. **Bộ phân tích Biểu thức Toán học Đầy đủ (`+`, `-`, `*`, `/`, Ngoặc đơn `( )`):**
   - Hỗ trợ tính toán trực tiếp các biểu thức phức tạp kèm đơn vị tiền tệ viết tắt (`k`, `tr`, `m`, `1tr5`) trên cả giao diện đồ họa, luồng Wizard và câu lệnh chat.
   - Ví dụ: `/c MB #ANUONG -(120k+30k)/3 Ăn trưa chia 3 người` -> Hệ thống tự động tính ra `-50.000 đ` và lưu cả biểu thức gốc `-(120k+30k)/3` lẫn kết quả `-50000` vào Google Sheets.
3. **Quản lý Đa Quỹ, Đa Ngân hàng & Tự động tải Ảnh Bill lên Google Drive:**
   - Hỗ trợ ghi riêng từng quỹ (`/c`, `/lcb`) hoặc ghi đồng thời vào cả 2 quỹ (`/clcb`).
   - Hỗ trợ tải ảnh hóa đơn lên thư mục `SuperFinanceBot_Bills` trên Google Drive bằng 4 cách: Chọn ảnh trực tiếp trong màn hình `Open UI Mode`, gửi ảnh kèm lệnh ở Caption, gửi ảnh rời trước rồi nhập lệnh, hoặc bấm Reply lệnh vào ảnh.
4. **Lưu sổ Liên thông qua các kỳ (`/reset` và `/chotso`):**
   - Toàn bộ từng dòng giao dịch cũ (Mã GD, Thời gian, Ngân hàng, `#Tag`, Biểu thức, Số tiền, Ghi chú, Link Ảnh Bill) được di chuyển nguyên vẹn sang nối tiếp tại bảng `Lịch Sử Chốt Sổ`, liên thông xuyên suốt tất cả các tháng mà không bao giờ làm mất lịch sử giao dịch.
5. **Phân quyền Đa Tài khoản (`ALLOWED_USER_IDS`) & Chống Lặp Lệnh 3 Tầng:**
   - Cho phép nhiều tài khoản Telegram cùng sử dụng Bot. Tài khoản lạ sẽ tự động bị chặn với thông báo `Bot 2.2.0 Loading...`.
   - Phản hồi Webhook bằng `HtmlService.createHtmlOutput("OK")` kết hợp `securityGuard.js` giúp triệt tiêu hoàn toàn lỗi `302 Found Redirect` của Google Apps Script.

---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 2: MÀN HÌNH ĐỒ HỌA 3 TAB "OPEN UI MODE"         -->
<!-- Tên file ảnh gợi ý: ./images/02-giao-dien-open-ui-mode-3-tab.png  -->
<!-- ================================================================= -->

![Ảnh minh họa 02 - Giao diện đồ họa 3 Tab Open UI Mode và Máy tính tích hợp](./images/02-giao-dien-open-ui-mode-3-tab.png)

<!-- ================================================================= -->


---

## 2. Cấu trúc Thư mục Dự án

```text
Core 2.2.0/
├── manual-copy-paste/                  # BỘ 3 FILE GỘP SẴN DÀNH CHO NGƯỜI KHÔNG CHUYÊN CODE
│   ├── 1_F1ActivateBot.gs              # File 1: Điền Token, User ID, WEBAPP_URL & chạy ActivateBot()
│   ├── 2_Code.gs                       # File 2: Đã gộp toàn bộ 11 file xử lý lõi thành 1 file duy nhất
│   ├── 3_uiWebApp.html                 # File 3: Giao diện đồ họa 3 Tab "Open UI Mode"
│   └── appsscript.json                 # Cấu hình quyền truy cập Google Sheets, Drive, Telegram
├── src/                                # Mã nguồn nguyên bản phân tách theo kiến trúc SOLID
│   ├── appsscript.json                 # Cấu hình Manifest V8 & OAuth Scopes
│   ├── F1ActivateBot.js                # File số 1: Điền WEBAPP_URL & chạy ActivateBot()
│   ├── GrantAllPermission.js           # File số 2: Cấp toàn bộ quyền Google 1 lần duy nhất
│   ├── main.js                         # Điểm tiếp nhận GET (Web App UI) và POST (Telegram Webhook)
│   ├── uiWebApp.html                   # Giao diện HTML/CSS/JS của "Open UI Mode" (3 Tab)
│   ├── core/
│   │   ├── config.js                   # Quản lý cấu hình, phiên bản 2.2.0 & phân quyền User ID
│   │   ├── securityGuard.js            # Bảo vệ 3 tầng chống Reply Storm & Emergency Stop
│   │   └── financeParser.js            # Bộ phân tích biểu thức (+ - * / ngoặc đơn) & kẻ khung bảng
│   ├── services/
│   │   ├── telegramService.js          # Giao tiếp Telegram Bot API
│   │   ├── driveService.js             # Tải ảnh Bill từ Telegram & Web App lên Google Drive
│   │   ├── sheetService.js             # Tự động tạo Google Sheets 5 bảng & lưu sổ liên thông
│   │   └── financeService.js           # Xử lý nghiệp vụ tài chính & báo cáo
│   └── controllers/
│       ├── uiController.js             # Điều phối Reply Keyboard, Wizard 4 bước & API Web App
│       └── commandController.js        # Điều phối lệnh (/c, /lcb, /clcb, /sodu, /ls, /reset...)
├── local/                              # Công cụ chạy thử nghiệm & bảo trì trên máy tính (Node.js)
│   ├── gas-shim.js                     # Bộ giả lập môi trường GAS trên Node.js
│   ├── dev-polling.js                  # Chạy Bot trực tiếp trên máy tính qua Long-Polling
│   ├── emergency-stop.js               # Ngắt khẩn cấp Webhook từ dòng lệnh
│   ├── manage-webhook.js               # Kiểm tra, cài đặt, xóa Webhook
│   └── simulate.js                     # Kịch bản kiểm thử tự động
├── docs/                               # Tài liệu kỹ thuật chi tiết của dự án
│   ├── REQUIREMENTS.md                 # Yêu cầu nghiệp vụ & Quy chuẩn kỹ thuật
│   ├── SYSTEM_DESIGN.md                # Thiết kế kiến trúc, luồng xử lý & cấu trúc Database
│   ├── TROUBLESHOOTING.md              # Các sự cố kỹ thuật & cách khắc phục
│   └── CHANGELOG.md                    # Lịch sử cập nhật các phiên bản
├── images/                             # Thư mục chứa ảnh minh họa cho README
├── UI_Simulation_Preview.html          # File mở trực tiếp trên trình duyệt để xem thử giao diện UI
├── package.json                        # Cấu hình lệnh npm & Clasp (v2.2.0)
├── .clasp.json.example                 # File mẫu cấu hình Script ID và thứ tự đẩy file
└── .env.example                        # File mẫu cấu hình biến môi trường
```

---

## 3. Hướng dẫn Triển khai Đơn Giản Cho Người Không Chuyên Code (Chỉ Cần Copy - Paste Trên Trình Duyệt)

Nếu bạn không sử dụng công cụ lập trình (Node.js / Clasp), bạn có thể triển khai toàn bộ hệ thống Bot và giao diện **Open UI Mode** trực tiếp trên trình duyệt web chỉ trong 5 bước dưới đây.

### Bước 1: Lấy 2 thông tin trên ứng dụng Telegram (2 phút)
1. **Lấy `BOT_TOKEN`:**
   - Mở Telegram, tìm kiếm tài khoản **`@BotFather`** (có dấu tích xanh).
   - Gửi lệnh `/newbot`, đặt tên hiển thị và tên người dùng (username kết thúc bằng chữ `bot`, ví dụ: `MyFinanceGAS_bot`).
   - `@BotFather` sẽ trả về một đoạn mã Token có dạng `1234567890:AAH...`. Hãy sao chép đoạn mã này.
2. **Lấy `USER_ID` (Mã định danh tài khoản của bạn):**
   - Tìm kiếm bot **`@userinfobot`** trên Telegram và bấm **Start**.
   - Bot sẽ trả về dòng `Id:` gồm một dãy số (ví dụ: `123456789`). Hãy sao chép dãy số này. (Nếu muốn cho phép cả người thân cùng dùng Bot, hãy lấy thêm `Id` của họ).

---

### Bước 2: Tạo dự án mới trên Google Apps Script
1. Truy cập địa chỉ: **`https://script.google.com`** và đăng nhập bằng tài khoản Google của bạn.
2. Bấm vào nút **`Dự án mới (New project)`** ở góc trên bên trái.
3. Bấm vào dòng chữ `Dự án không có tiêu đề (Untitled project)` ở thanh trên cùng và đổi tên thành **`SuperFinanceGAS_Bot`**.

---

### Bước 3: Copy và Dán Mã Nguồn (Chọn 1 trong 2 cách dưới đây)

#### Cách 3A (Khuyên dùng cho người không chuyên - Nhanh nhất chỉ với 3 file trong thư mục `manual-copy-paste/`)

Trong thư mục **`manual-copy-paste/`** của bộ mã nguồn này đã được gộp sẵn thành **3 file** để bạn không phải tạo nhiều file lẻ. Bạn thực hiện đúng thứ tự sau:

| Thứ tự | Thao tác trên màn hình Google Apps Script | File cần mở trên máy tính để Copy | Nơi Dán (Paste) vào Google Apps Script |
| :--- | :--- | :--- | :--- |
| **File 1** | Bấm vào dấu **`+`** (bên cạnh mục *Tệp / Files*) -> Chọn **`Tệp mã (Script)`** -> Đặt tên là **`F1ActivateBot`** (không cần gõ đuôi `.gs`) rồi nhấn Enter. | Mở file **`manual-copy-paste/1_F1ActivateBot.gs`** | Xóa chữ `function myFunction() {}` mặc định, dán toàn bộ nội dung file `1_F1ActivateBot.gs` vào. |
| **File 2** | Bấm vào file **`Mã.gs` (hoặc `Code.gs`)** có sẵn từ đầu ở thanh bên trái. | Mở file **`manual-copy-paste/2_Code.gs`** | Xóa hết nội dung mặc định, dán toàn bộ nội dung file `2_Code.gs` vào. |
| **File 3** | Bấm vào dấu **`+`** (bên cạnh mục *Tệp / Files*) -> Chọn **`HTML`** -> Đặt tên chính xác là **`uiWebApp`** (chữ `W` và `A` viết hoa, không gõ đuôi `.html`) rồi nhấn Enter. | Mở file **`manual-copy-paste/3_uiWebApp.html`** | Xóa hết nội dung HTML mặc định, dán toàn bộ nội dung file `3_uiWebApp.html` vào. |

#### Cách 3B (Dành cho người muốn giữ nguyên 13 file tách rời trong thư mục `src/`)

Nếu bạn muốn copy trực tiếp từ thư mục **`src/`** mà không dùng bản gộp:
- Với các file có đuôi **`.js`**: Trên Google Apps Script, bấm dấu **`+`** -> Chọn **`Tệp mã (Script)`** -> Đặt tên file rồi dán nội dung tương ứng vào (`F1ActivateBot`, `GrantAllPermission`, `main`, `config`, `securityGuard`, `financeParser`, `telegramService`, `driveService`, `sheetService`, `financeService`, `uiController`, `commandController`).
- Với file **`src/uiWebApp.html`**: Trên Google Apps Script, bấm dấu **`+`** -> Chọn **`HTML`** -> Đặt tên chính xác là **`uiWebApp`** rồi dán toàn bộ nội dung của `src/uiWebApp.html` vào.

#### Cập nhật file cấu hình quyền `appsscript.json` (Bắt buộc cho cả Cách 3A và 3B):
1. Nhìn sang thanh công cụ dọc ở ngoài cùng bên trái của Google Apps Script, bấm vào biểu tượng **Hình bánh răng (`Cài đặt dự án / Project Settings`)**.
2. Tích chọn vào ô vuông: **`Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa (Show "appsscript.json" manifest file in editor)`**.
3. Bấm lại vào biểu tượng **`< >` (`Trình chỉnh sửa / Editor`)** ở thanh bên trái để quay lại danh sách file.
4. Bạn sẽ thấy file **`appsscript.json`** xuất hiện ở đầu danh sách. Hãy bấm vào đó, xóa nội dung cũ và dán toàn bộ nội dung của file **`src/appsscript.json`** (hoặc **`manual-copy-paste/appsscript.json`**) vào.
5. Bấm tổ hợp phím **`Ctrl + S`** (hoặc bấm biểu tượng **Đĩa mềm** trên thanh công cụ) để lưu toàn bộ các file vừa tạo.

---

### Bước 4: Điền Token, Tạo Đường Dẫn Web App (`Deploy`) và Dán `WEBAPP_URL`

1. **Điền Token và User ID của bạn:**
   - Tại danh sách file bên trái, bấm vào file **`F1ActivateBot.gs`**.
   - Tìm đến đoạn `var envData = { ... }` (khoảng dòng 32–42) và thay thế thông tin thật của bạn vào giữa cặp dấu nháy đơn `'...'`:
     ```javascript
     var envData = {
       'APP_VERSION': '2.2.0',
       'BOT_TOKEN': 'DÁN_BOT_TOKEN_CỦA_BẠN_VÀO_ĐÂY',
       'TELEGRAM_BOT_TOKEN': 'DÁN_BOT_TOKEN_CỦA_BẠN_VÀO_ĐÂY',
       'ALLOWED_USER_IDS': 'DÁN_USER_ID_CỦA_BẠN_VÀO_ĐÂY',
       'ADMIN_IDS': 'DÁN_USER_ID_CỦA_BẠN_VÀO_ĐÂY',
       'ADMIN_CHAT_ID': 'DÁN_USER_ID_CỦA_BẠN_VÀO_ĐÂY',
       // DIEN WEBAPP_URL MOI SAU KHI DEPLOY TAI DAY:
       'WEBAPP_URL': 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
       'EMERGENCY_STOP': 'false'
     };
     ```
     *(Lưu ý: Nếu muốn cho phép 2 tài khoản cùng dùng, điền cách nhau bởi dấu phẩy ở mục `ALLOWED_USER_IDS`, ví dụ: `'123456789, 987654321'`)*
   - Bấm **`Ctrl + S`** để lưu lại.

2. **Bấm nút Triển khai (`Deploy`) để lấy đường dẫn `WEBAPP_URL`:**
   - Nhìn lên góc trên bên phải màn hình Google Apps Script, bấm nút màu xanh **`Triển khai (Deploy)`** -> Chọn **`Tùy chọn triển khai mới (New deployment)`**.
   - Một bảng nhỏ hiện ra: Bấm vào biểu tượng **Hình bánh răng** (bên cạnh dòng *Chọn loại / Select type*) -> Chọn **`Ứng dụng web (Web app)`**.
   - Tại mục **`Thực thi dưới dạng (Execute as)`**: Chọn **`Tôi (Me)`**.
   - Tại mục **`Ai có quyền truy cập (Who has access)`**: Bắt buộc chọn **`Bất kỳ ai (Anyone)`**.
   - Bấm nút **`Triển khai (Deploy)`** ở góc dưới bảng.
   - Sau khi triển khai xong, màn hình sẽ hiện ra mục **`URL ứng dụng web (Web app URL)`** có dạng `https://script.google.com/macros/s/AKfycb.../exec`. Hãy bấm nút **`Sao chép (Copy)`** ngay bên dưới đường dẫn đó, rồi bấm **Xong (Done)**.

3. **Dán `WEBAPP_URL` vừa sao chép vào `F1ActivateBot.gs`:**
   - Quay trở lại file **`F1ActivateBot.gs`**, tìm dòng `'WEBAPP_URL':` và dán đường dẫn vừa sao chép vào:
     ```javascript
     'WEBAPP_URL': 'https://script.google.com/macros/s/AKfycb.../exec',
     ```
   - Bấm **`Ctrl + S`** (hoặc biểu tượng Đĩa mềm) để lưu file.

---

### Bước 5: Bấm Nút `Run` Hàm `ActivateBot` Để Cấp Quyền & Kích Hoạt (Chỉ làm 1 lần duy nhất)

1. Vẫn đang mở file **`F1ActivateBot.gs`**, nhìn lên thanh công cụ ngang ở phía trên:
   - Đảm bảo ô chọn hàm (nằm bên phải nút *Gỡ lỗi / Debug*) đang hiển thị chữ **`ActivateBot`**.
   - Bấm vào nút **`Chạy (Run)`** ngay bên trái đó.
2. **Cách bấm khi bảng Cấp quyền của Google hiện ra:**
   - Một hộp thoại *Yêu cầu ủy quyền (Authorization required)* sẽ xuất hiện -> Bấm nút **`Xem lại quyền (Review permissions)`**.
   - Chọn tài khoản Google của bạn.
   - Khi màn hình hiện cảnh báo *Google chưa xác minh ứng dụng này (Google hasn't verified this app)*:
     - Bấm vào dòng chữ nhỏ **`Nâng cao (Advanced)`** ở góc dưới bên trái.
     - Bấm tiếp vào dòng **`Đi tới SuperFinanceGAS_Bot (không an toàn) / Go to SuperFinanceGAS_Bot (unsafe)`** ở dưới cùng.
     - Cuộn xuống cuối trang và bấm nút **`Cho phép (Allow)`**.
3. **Kiểm tra hoàn tất:**
   - Nhìn xuống khung **`Nhật ký thực thi (Execution log)`** ở đáy màn hình Google Apps Script. Khi thấy các dòng:
     - `[ActivateBot] Cap nhat bien moi truong thanh cong.`
     - `[GrantAllPermissions] HOAN TAT! Da kich hoat 7/7 nhom quyen.`
     - `[ActivateBot] Thiet lap Webhook thanh cong.`
   - Hãy mở ứng dụng Telegram, vào Bot của bạn và gõ lệnh **`/start`**. Bàn phím cố định chứa nút **`Open UI Mode`** sẽ lập tức hiện ra dưới đáy màn hình và hệ thống tự động tạo sẵn file Google Sheets gồm 5 bảng trong Google Drive của bạn.


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 3: ĐIỀN WEBAPP_URL & CHẠY ACTIVATEBOT TRÊN GAS  -->
<!-- Tên file ảnh gợi ý: ./images/03-kich-hoat-activatebot-gas.png     -->
<!-- ================================================================= -->

![Ảnh minh họa 03 - Điền WEBAPP_URL trong F1ActivateBot.gs và bấm Run ActivateBot](./images/03-kich-hoat-activatebot-gas.png)

<!-- ================================================================= -->


---

## 4. Hướng dẫn Triển khai Tự Động Bằng Dòng Lệnh (Dành cho Lập trình viên dùng Clasp)

Nếu bạn sử dụng Node.js và muốn đồng bộ mã nguồn từ máy tính lên Google Apps Script thông qua `@google/clasp`:

```bash
npm install
npx clasp login
```

1. Sao chép `.clasp.json.example` thành `.clasp.json` và điền `scriptId` của dự án Google Apps Script.
2. Sao chép `.env.example` thành `.env` và điền `TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS`.
3. Mở file `src/F1ActivateBot.js` và `src/core/config.js`, điền `TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS` và `WEBAPP_URL`.
4. Đẩy mã nguồn và phát hành phiên bản:
   ```bash
   npm run push
   npm run deploy
   ```

---

## 5. Bảng Cú pháp Lệnh Chi Tiết (Khi dùng song song với Giao diện UI)

*Lưu ý: Mọi lệnh gõ trực tiếp đều bắt buộc bắt đầu bằng dấu `/`. Hỗ trợ đầy đủ phép tính `+`, `-`, `*`, `/` và ngoặc đơn `( )`.*

| Lệnh | Cú pháp | Ví dụ | Giải thích |
| :--- | :--- | :--- | :--- |
| **`/ghi`** | `/ghi` | `/ghi` | Mở bảng chọn nút 4 bước ngay trong khung chat Telegram. |
| **`/c`** | `/c <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]` | `/c Techcombank #LUONG 15tr Lương tháng 10` | Ghi **THU** `+15.000.000 đ` vào Quỹ Cá Nhân. |
| **`/c`** | `/c <Ngân_Hàng> [#TAG] -<Biểu_Thức> [Ghi chú]` | `/c MB #ANUONG -(120k+30k)/3 Ăn trưa chia 3` | Tự động tính phép chia `-50.000 đ` từ `MB`, mục `#ANUONG`. |
| **`/c`** | `/c -<Số_Tiền> [Ghi chú]` | `/c -30k Gửi xe` | Không ghi ngân hàng và tag: Tự động gán ngân hàng `Chung`, phân loại `#CHUNG`. |
| **`/lcb`** | `/lcb <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]` | `/lcb MB #DICHO -200k Mua đồ ăn` | Ghi thu/chi vào bảng **Quỹ Phụ**. |
| **`/clcb`** | `/clcb <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]` | `/clcb CASH #QUATANG -500k Mua quà` | Ghi đồng thời vào **cả 2 bảng** (`Thu Chi` và `Quỹ Phụ`). |
| **`/limit`** | `/limit #<TAG> <Số_Tiền>` | `/limit #TRADA 200k` | Đặt hạn mức chi tiêu cho `#TRADA` là `200.000 đ`. |
| **`/sodu`** | `/sodu` hoặc `/balance` | `/sodu` | Xem bảng cân đối: Tổng 2 Quỹ, Số dư từng Ngân hàng và từng `#Tag`. |
| **`/ls`** | `/ls` hoặc `/history` | `/ls` | Xem lại 5 giao dịch gần nhất của 2 Quỹ (kèm link xem ảnh Bill). |
| **`/undo`** | `/undo` | `/undo` | Xóa giao dịch vừa nhập gần nhất (hoặc bấm nút Hoàn tác dưới tin nhắn). |
| **`/chotso`** | `/chotso` hoặc `/renew` | `/chotso` | Chuyển toàn bộ giao dịch cũ sang `Lịch Sử Chốt Sổ`, giữ lại dòng `Số dư đầu kỳ`. |
| **`/reset`** | `/reset` | `/reset` | Chuyển toàn bộ giao dịch cũ sang `Lịch Sử Chốt Sổ`, đưa mọi số dư hiện tại về `0 đ`. |
| **`/status`** | `/status` | `/status` | Xem phiên bản, danh sách ID được phép, trạng thái Sheet & Google Drive. |

---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 4: KẾT QUẢ GHI GIAO DỊCH & GỬI ẢNH BILL DRIVE    -->
<!-- Tên file ảnh gợi ý: ./images/04-minh-hoa-ghi-giao-dich-va-bill.png -->
<!-- ================================================================= -->

![Ảnh minh họa 04 - Kết quả ghi nhận giao dịch và đường dẫn ảnh Bill Google Drive](./images/04-minh-hoa-ghi-giao-dich-va-bill.png)

<!-- ================================================================= -->


---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 5: BÁO CÁO SỐ DƯ (/sodu) & LỊCH SỬ (/ls)        -->
<!-- Tên file ảnh gợi ý: ./images/05-bao-cao-so-du-va-lich-su.png      -->
<!-- ================================================================= -->

![Ảnh minh họa 05 - Báo cáo số dư theo Ngân hàng, Tag và Lịch sử giao dịch](./images/05-bao-cao-so-du-va-lich-su.png)

<!-- ================================================================= -->


---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 6: BẢNG GOOGLE SHEETS & LỊCH SỬ CHỐT SỔ LIÊN THÔNG -->
<!-- Tên file ảnh gợi ý: ./images/06-cau-truc-bang-google-sheets.png   -->
<!-- ================================================================= -->

![Ảnh minh họa 06 - Cấu trúc 5 bảng Google Sheets và Lịch Sử Chốt Sổ liên thông](./images/06-cau-truc-bang-google-sheets.png)

<!-- ================================================================= -->


---

## 6. Tài liệu chi tiết trong thư mục `docs/`

- [Yêu cầu Nghiệp vụ & Quy tắc Dự án (`docs/REQUIREMENTS.md`)](./docs/REQUIREMENTS.md)
- [Thiết kế Kiến trúc & Cơ sở dữ liệu (`docs/SYSTEM_DESIGN.md`)](./docs/SYSTEM_DESIGN.md)
- [Sự cố Kỹ thuật & Giải pháp Khắc phục (`docs/TROUBLESHOOTING.md`)](./docs/TROUBLESHOOTING.md)
- [Nhật ký Thay đổi Phiên bản (`docs/CHANGELOG.md`)](./docs/CHANGELOG.md)

