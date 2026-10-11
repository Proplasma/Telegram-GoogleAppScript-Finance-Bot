# Telegram GAS Finance Bot - Phiên bản 2.1.1

Hệ thống Bot Telegram quản lý tài chính đa quỹ hoạt động trên nền tảng **Google Apps Script (V8 Runtime)**, tự động lưu trữ dữ liệu vào **Google Sheets**, tự động tải ảnh hóa đơn (Bill) lên **Google Drive**, và hỗ trợ phát triển/bảo trì cục bộ thông qua **Google Clasp**.

---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 1: TỔNG QUAN GIAO DIỆN BOT TRÊN TELEGRAM        -->
<!-- Tên file ảnh gợi ý: ./images/01-tong-quan-giao-dien-bot.png       -->
<!-- ================================================================= -->

![Ảnh minh họa 01 - Tổng quan giao diện Bot trên Telegram](./images/01-tong-quan-giao-dien-bot.png)

<!-- ================================================================= -->


---

## 1. Tính năng cốt lõi của Phiên bản 2.1.1

1. **Quản lý Thu Chi Đa Quỹ (`/c`, `/lcb`, `/clcb`):**
   - `/c`: Tính toán và ghi chép cho **Quỹ Cá Nhân** (bảng `Thu Chi`).
   - `/lcb`: Tính toán và ghi chép cho **Quỹ Phụ** (bảng `Quỹ Phụ`).
   - `/clcb`: Ghi nhận đồng thời vào **cả 2 quỹ** trong một lệnh duy nhất (đồng bộ Mã GD, Ngân hàng và `#Tag`).
2. **Quản lý Đa Tài khoản Ngân hàng & Phân loại `#Tag`:**
   - Hỗ trợ nhập tên ngân hàng/nguồn tiền (`Techcombank`, `Vietcombank`, `MB`, `CASH`...) và phân loại `#Tag` (`#TRADA`, `#ANUONG`, `#LUONG`...).
   - Tự động gán giá trị mặc định: Không nhập tên ngân hàng sẽ gán vào `Chung`, không nhập `#Tag` sẽ gán vào `#CHUNG`.
3. **Bộ phân tích số tiền linh hoạt:**
   - Quy tắc dấu: Có dấu `+` hoặc không ghi dấu (ví dụ `50k`, `+50k`) được hiểu là **THU VÀO (cộng số dư)**; có dấu `-` (ví dụ `-50k`, `-50.000`) được hiểu là **CHI RA (trừ số dư)**.
   - Hỗ trợ đơn vị viết tắt (`k`, `tr`, `m`, `1tr5`) và biểu thức cộng trừ gộp nhiều khoản (`-35k-15k-10k`).
4. **Tự động tải Ảnh Hóa Đơn (Bill) lên Google Drive:**
   - Hỗ trợ cả 3 phương thức gửi ảnh trên Telegram:
     - Gửi ảnh kèm câu lệnh trong phần Chú thích (Caption).
     - Gửi ảnh rời trước rồi gõ lệnh `/c`, `/lcb`, `/clcb` ở tin nhắn kế tiếp (trong vòng 5 phút).
     - Bấm Trả lời (Reply) lệnh vào một bức ảnh đã gửi trước đó.
   - Tự động lưu ảnh vào thư mục `SuperFinanceBot_Bills` trên Google Drive, trả về đường dẫn xem ảnh trực tiếp trên Telegram và ghi đường dẫn vào cột `Link Ảnh Bill` trong Google Sheets.
5. **Lưu sổ liên thông qua các kỳ (`/reset` và `/chotso`):**
   - Toàn bộ các dòng giao dịch cũ (kèm đầy đủ Mã GD, Thời gian, Ngân hàng, `#Tag`, Số tiền, Ghi chú, Link Ảnh Bill) được chuyển nguyên vẹn sang nối tiếp tại bảng `Lịch Sử Chốt Sổ`, liên thông toàn bộ các tháng với nhau mà không làm mất dữ liệu.
   - `/reset`: Chuyển toàn bộ giao dịch cũ sang bảng `Lịch Sử Chốt Sổ` và đưa số dư tất cả các mục về `0 đ`.
   - `/chotso` (`/renew`): Chuyển toàn bộ giao dịch cũ sang bảng `Lịch Sử Chốt Sổ` và giữ lại số dư hiện tại làm dòng `Số dư đầu kỳ` mới.
6. **Phân quyền Đa Tài khoản Telegram (`ALLOWED_USER_IDS`):**
   - Cho phép nhiều tài khoản Telegram cùng truy cập thông qua danh sách ID ngăn cách bởi dấu phẩy (ví dụ: `8544500048, 1678072401`).
   - Tài khoản không nằm trong danh sách được phép sẽ tự động bị chặn và chỉ nhận phản hồi mặc định: `Bot 2.1.1 Loading...`.
7. **Bảo vệ Chống Lặp Lệnh (Anti-Reply-Storm 3 tầng) & Cấp quyền 1 chạm (`GrantAllPermission.js`):**
   - Phản hồi Webhook bằng `HtmlService.createHtmlOutput("OK")` để triệt tiêu lỗi `HTTP 302 Found` của Google Apps Script.
   - Tích hợp file `GrantAllPermission.js` giúp cấp toàn bộ quyền hệ thống (Sheets, Drive, UrlFetch, Triggers, HtmlService) chỉ trong 1 lần bấm Run duy nhất.

---

## 2. Cấu trúc Thư mục Dự án

```text
Core 2.1.1/
├── src/                                # Mã nguồn lõi đẩy lên Google Apps Script
│   ├── appsscript.json                 # Cấu hình Manifest V8 & OAuth Scopes
│   ├── F1ActivateBot.js                # File số 1: Điền WEBAPP_URL & chạy ActivateBot()
│   ├── GrantAllPermission.js           # File số 2: Cấp toàn bộ quyền Google 1 lần duy nhất
│   ├── main.js                         # Điểm tiếp nhận Webhook (doGet, doPost, finishResponse)
│   ├── core/
│   │   ├── config.js                   # Quản lý cấu hình, phiên bản 2.1.1 & phân quyền User ID
│   │   ├── securityGuard.js            # Bảo vệ 3 tầng chống Reply Storm & Emergency Stop
│   │   └── financeParser.js            # Bộ phân tích cú pháp lệnh, số tiền & kẻ khung bảng
│   ├── services/
│   │   ├── telegramService.js          # Giao tiếp Telegram Bot API
│   │   ├── driveService.js             # Tải ảnh Bill từ Telegram lên Google Drive
│   │   ├── sheetService.js             # Tự động tạo Google Sheets 5 bảng & lưu sổ liên thông
│   │   └── financeService.js           # Xử lý nghiệp vụ tài chính & báo cáo
│   └── controllers/
│       └── commandController.js        # Điều phối lệnh (/c, /lcb, /clcb, /sodu, /ls, /reset...)
├── local/                              # Công cụ chạy thử nghiệm & bảo trì trên máy tính
│   ├── gas-shim.js                     # Bộ giả lập môi trường GAS trên Node.js
│   ├── dev-polling.js                  # Chạy Bot trực tiếp trên máy tính qua Long-Polling
│   ├── emergency-stop.js               # Ngắt khẩn cấp Webhook từ dòng lệnh
│   ├── manage-webhook.js               # Kiểm tra, cài đặt, xóa Webhook
│   └── simulate.js                     # Kịch bản kiểm thử tự động
├── docs/                               # Tài liệu kỹ thuật của dự án
│   ├── REQUIREMENTS.md                 # Yêu cầu nghiệp vụ & Quy tắc bắt buộc
│   ├── SYSTEM_DESIGN.md                # Thiết kế kiến trúc, luồng xử lý & cấu trúc Database
│   ├── TROUBLESHOOTING.md              # Các sự cố kỹ thuật & cách khắc phục
│   └── CHANGELOG.md                    # Lịch sử cập nhật các phiên bản
├── images/                             # Thư mục chứa ảnh minh họa cho README
├── package.json                        # Cấu hình lệnh npm & Clasp (v2.1.1)
├── .clasp.json.example                 # File mẫu cấu hình Script ID và thứ tự đẩy file
└── .env.example                        # File mẫu cấu hình biến môi trường
```

---

## 3. Bảng Cú pháp Lệnh Chi Tiết

*Lưu ý: Mọi lệnh nhập vào bắt buộc phải có dấu `/` ở đầu.*

| Lệnh | Cú pháp | Ví dụ | Giải thích |
| :--- | :--- | :--- | :--- |
| **`/c`** | `/c <Ngân_Hàng> [#TAG] <Số_Tiền> [Ghi chú]` | `/c Techcombank #LUONG 15tr Lương tháng 10` | Ghi **THU** `+15.000.000 đ` vào Quỹ Cá Nhân. |
| **`/c`** | `/c <Ngân_Hàng> [#TAG] -<Số_Tiền> [Ghi chú]` | `/c Techcombank #TRADA -50k Mua trà đá` | Ghi **CHI** `-50.000 đ` từ `Techcombank`, mục `#TRADA`. |
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
<!-- CHÈN ẢNH MINH HỌA 2: KẾT QUẢ GHI GIAO DỊCH /c, /lcb, /clcb        -->
<!-- Tên file ảnh gợi ý: ./images/02-minh-hoa-ghi-giao-dich.png        -->
<!-- ================================================================= -->

![Ảnh minh họa 02 - Kết quả ghi nhận giao dịch và kẻ bảng](./images/02-minh-hoa-ghi-giao-dich.png)

<!-- ================================================================= -->


---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 3: GỬI KÈM ẢNH BILL & LƯU LINK GOOGLE DRIVE     -->
<!-- Tên file ảnh gợi ý: ./images/03-minh-hoa-gui-anh-bill-drive.png   -->
<!-- ================================================================= -->

![Ảnh minh họa 03 - Gửi kèm ảnh hóa đơn Bill và trả về link Google Drive](./images/03-minh-hoa-gui-anh-bill-drive.png)

<!-- ================================================================= -->


---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 4: BÁO CÁO SỐ DƯ (/sodu) & LỊCH SỬ (/ls)        -->
<!-- Tên file ảnh gợi ý: ./images/04-bao-cao-so-du-va-lich-su.png      -->
<!-- ================================================================= -->

![Ảnh minh họa 04 - Báo cáo số dư theo Ngân hàng, Tag và Lịch sử giao dịch](./images/04-bao-cao-so-du-va-lich-su.png)

<!-- ================================================================= -->


---


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 5: BẢNG GOOGLE SHEETS & LỊCH SỬ CHỐT SỔ LIÊN THÔNG -->
<!-- Tên file ảnh gợi ý: ./images/05-cau-truc-bang-google-sheets.png   -->
<!-- ================================================================= -->

![Ảnh minh họa 05 - Cấu trúc 5 bảng Google Sheets và Lịch Sử Chốt Sổ liên thông](./images/05-cau-truc-bang-google-sheets.png)

<!-- ================================================================= -->


---

## 4. Hướng dẫn Cài đặt & Triển khai lên Google Apps Script

### Bước 1: Cài đặt thư viện
```bash
npm install
npx clasp login
```

### Bước 2: Cấu hình thông tin Bot
1. Sao chép `.clasp.json.example` thành `.clasp.json` và điền `scriptId` của dự án Google Apps Script.
2. Sao chép `.env.example` thành `.env` và điền `TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS`.
3. Mở file `src/F1ActivateBot.js` và `src/core/config.js`, điền `TELEGRAM_BOT_TOKEN` và danh sách `ALLOWED_USER_IDS`.

### Bước 3: Đẩy mã nguồn và Deploy Web App
```bash
npm run push
```
1. Mở trình sửa code Google Apps Script, bấm **Deploy (Triển khai)** -> **New deployment (Tùy chọn triển khai mới)** -> Chọn loại **Web app**.
2. Mục **Execute as (Thực thi dưới dạng)**: Chọn **Me (Tôi)**.
3. Mục **Who has access (Ai có quyền truy cập)**: Chọn **Anyone (Bất kỳ ai)** -> Bấm **Deploy** và sao chép đường dẫn `WEBAPP_URL`.

### Bước 4: Điền `WEBAPP_URL` và Cấp toàn bộ quyền 1 lần duy nhất
1. Tại giao diện Google Apps Script Editor, mở file đầu tiên **`F1ActivateBot.gs`**, dán đường dẫn vừa sao chép vào mục `'WEBAPP_URL'` trong hàm `setupEnvironment()`.
2. Chọn hàm **`ActivateBot`** trên thanh công cụ và bấm **Run (Chạy)**.
3. Hàm `ActivateBot` sẽ tự động gọi `GrantAllPermissions()` trong `GrantAllPermission.gs` để yêu cầu cấp trọn bộ quyền (Google Sheets, Google Drive, Telegram API, Triggers) trong 1 lần duy nhất và tự động cài đặt Webhook.


<!-- ================================================================= -->
<!-- CHÈN ẢNH MINH HỌA 6: ĐIỀN WEBAPP_URL & CHẠY ACTIVATEBOT TRÊN GAS  -->
<!-- Tên file ảnh gợi ý: ./images/06-kich-hoat-activatebot-gas.png     -->
<!-- ================================================================= -->

![Ảnh minh họa 06 - Điền WEBAPP_URL trong F1ActivateBot.gs và chạy ActivateBot](./images/06-kich-hoat-activatebot-gas.png)

<!-- ================================================================= -->


---

## 5. Tài liệu chi tiết trong thư mục `docs/`

- [Yêu cầu Nghiệp vụ & Quy tắc Dự án (`docs/REQUIREMENTS.md`)](./docs/REQUIREMENTS.md)
- [Thiết kế Kiến trúc & Cơ sở dữ liệu (`docs/SYSTEM_DESIGN.md`)](./docs/SYSTEM_DESIGN.md)
- [Sự cố Kỹ thuật & Giải pháp Khắc phục (`docs/TROUBLESHOOTING.md`)](./docs/TROUBLESHOOTING.md)
- [Nhật ký Thay đổi Phiên bản (`docs/CHANGELOG.md`)](./docs/CHANGELOG.md)
"# Telegram-GoogleAppScript-Finance-Bot" 
