# 🎬 HosiFlow Studio — AI Film & Workflow Workstation

<p align="center">
  <img src="./companion-extension/icons/hosiflow_logo.png" width="105" height="105" alt="HosiFlow Studio Logo" />
</p>

<p align="center">
  <strong>Trạm Làm Phim AI Độc Lập Chuyên Nghiệp — Tự Động Hóa Kịch Bản, Khóa Nhân Vật Đa Chiều, Nhạc Nền Google Flow Music & Bàn Dựng Timeline Điện Ảnh</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-v0.1.3-8b5cf6?style=for-the-badge&logo=rocket" alt="Version v0.1.3" />
  <img src="https://img.shields.io/badge/Companion-v1.5.7-06b6d4?style=for-the-badge&logo=googlechrome" alt="Companion v1.5.7" />
  <img src="https://img.shields.io/badge/Zero%20API%20Cost-100%25%20Free-10b981?style=for-the-badge" alt="Zero API Cost" />
  <img src="https://img.shields.io/badge/Engine-Native%20Rust%20%26%20FFmpeg%207.1-f59e0b?style=for-the-badge" alt="Native Engine" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <a href="./HosiFlow%20Studio_Setup.exe"><strong>📥 Tải Bản Cài Đặt (Setup .exe - 2.4 MB)</strong></a> •
  <a href="./HosiFlow-Studio.exe"><strong>⚡ Tải Bản Chạy Ngay (Portable .exe - 3.5 MB)</strong></a> •
  <a href="./companion-extension.zip"><strong>📦 Tải Tiện Ích Companion (.zip)</strong></a>
</p>

<p align="center">
  <a href="#-có-gì-mới-trong-bản-v013">Có Gì Mới v0.1.3</a> •
  <a href="#-tính-năng-cốt-lõi">Tính Năng Cốt Lõi</a> •
  <a href="#-quà-tặng-tân-thủ--credits-miễn-phí">Quà Tân Thủ</a> •
  <a href="#-hướng-dẫn-cài-đặt">Cài Đặt</a> •
  <a href="#-hướng-dẫn-sử-dụng-nhanh">Sử Dụng</a> •
  <a href="#-lịch-sử-phiên-bản-changelog">Changelog</a> •
  <a href="#️-support--donations">Ủng Hộ</a>
</p>

---

## 🌟 Giới Thiệu

**HosiFlow Studio** là phần mềm máy tính (Desktop App) độc lập chuyên sâu dành cho các nhà sáng tạo nội dung, biên kịch và nhà làm phim AI. 

Khác với các công cụ web rời rạc hay các phần mềm bắt buộc phải mua API đắt đỏ, HosiFlow kết hợp sức mạnh của:
1. **Visual Node Canvas (Mạng lưới Node trực quan)** đa luồng.
2. **Bộ phân tích kịch bản tiếng Việt thông minh** (Script → Nodes Engine).
3. **Hệ thống khóa nhân vật Model Sheet đa góc (Character Vault)**.
4. **Node Tạo Nhạc Nền BGM Điện Ảnh với Google Flow Music**.
5. **Bàn dựng Timeline Native FFmpeg tốc độ cao**.
6. **HosiFlow Companion Extension (v1.5.7)** — Cầu nối vệ tinh đa nền tảng điều khiển song song **Muse.ai** và **Google Flow Music**.

### 💡 Điểm Đột Phá: Cơ Chế "Zero API Cost" — Tiết Kiệm Tối Đa Chi Phí
* **Hoàn Toàn Không Cần API Key:** Không bắt buộc bạn phải đăng ký tài khoản lập trình viên, không cần thẻ tín dụng quốc tế, không lo mua token API hàng tháng đắt đỏ.
* **Tận Dụng Phiên Đăng Nhập Sẵn Có:** Tự động điều khiển và thực thi trực tiếp trên phiên làm việc Muse.ai và FlowMusic.app sẵn có của bạn trên trình duyệt Chrome thông qua tiện ích mở rộng HosiFlow Companion.
* **Sáng Tạo Không Giới Hạn:** Tận dụng triệt để tài nguyên có sẵn để viết kịch bản, tạo ảnh khung đầu, sinh video, tạo nhạc nền và dựng phim liên tục.
* **Bảo Mật Cục Bộ 100%:** Toàn bộ kịch bản, ảnh nhân vật, video và file âm thanh được xử lý và lưu trữ ngay trên ổ cứng máy tính của bạn qua cổng kết nối nội bộ `127.0.0.1:4826`, không qua bất kỳ máy chủ trung gian nào.

---

## 🚀 Có Gì Mới Trong Bản v0.1.3?

* 🎵 **Tích hợp Node Tạo Nhạc Nền BGM (Google Flow Music):**
  * Tự động hóa soạn prompt âm nhạc trên [flowmusic.app](https://www.flowmusic.app).
  * Đầy đủ Preset thể loại âm nhạc: *Điện ảnh (Cinematic), Lo-Fi Chill, Cyberpunk Synthwave, Giao hưởng Hào Hùng, Kinh dị / Hồi hộp, TikTok Viral Beat, Guitar Mộc Mạc...*
  * Bắt chuẩn xác luồng stream âm thanh gốc từ Google Cloud Storage (`producer-app-public/clips/{uuid}.m4a`).
* ✂️ **Tự Động Cắt Nhạc (Auto-Trim) Bằng FFmpeg Nội Bộ:**
  * Tính năng **Khớp tổng video (Auto)**: Nhạc nền được tự động đo và cắt gọt chuẩn xác theo đúng tổng số giây của các scene video trên Canvas bằng bộ lọc âm thanh `afade` Native FFmpeg.
* 🌐 **Nâng cấp HosiFlow Companion lên v1.5.7:**
  * Hỗ trợ nhận diện Multi-Tab thông minh: Tab Muse.ai (`MUSE`), tab Google Flow Music (`FLOW`), hoặc cả hai (`ALL`).
  * In-Page Passive Engine chạy trong Page World (`world: "MAIN"`): Bắt luồng âm thanh tự nhiên 100%, chấm dứt hoàn toàn tình trạng play/pause nhạc cũ.
* 🎁 **Tích hợp Hộp Thoại Quà Tặng Tân Thủ & Nhận Credits Miễn Phí:**
  * Nhận ngay **500 Credits Google Flow Music** và **1 Tỷ Muse Tokens** miễn phí.
* ⚡ **Sửa Lỗi Đồng Bộ Phiên Bản:** Đồng bộ trực tiếp phiên bản Desktop với cấu hình hệ thống, loại bỏ triệt để thông báo cập nhật sai lệch khi khởi động.

---

## 🎁 Quà Tặng Tân Thủ & Credits Miễn Phí

Để hỗ trợ các nhà sáng tạo nội dung bắt đầu làm phim AI mà không lo thiếu tài nguyên, HosiFlow Studio tích hợp chương trình quà tặng đối tác:

| Nền Tảng | Phần Thưởng Nhận Được | Hướng Dẫn Kích Hoạt |
| :--- | :---: | :--- |
| **Google Flow Music** | 🎁 **500 Credits Miễn Phí** | Đăng ký tài khoản mới qua liên kết: [https://www.flowmusic.app/invite/YBILFP](https://www.flowmusic.app/invite/YBILFP) |
| **Muse.ai Workstation** | 🎁 **1 Tỷ Tokens Miễn Phí** | Đăng ký tại [muse.ai](https://muse.ai) và nhập mã giới thiệu: **`2LUZIO`** trong mục **Settings** trong vòng 48h sau khi tạo tài khoản |

*(Bạn có thể bấm trực tiếp vào nút **`[ 🎁 Nhận Credits ]`** trên thanh công cụ Studio Toolbar để mở hộp thoại quà tặng bất kỳ lúc nào).*

---

## 🛠️ Tính Năng Cốt Lõi

### 1. 🤖 Bộ Chuyển Đổi Kịch Bản Phân Cảnh (Script → Nodes Engine)
* **Bóc tách kịch bản tiếng Việt tự động:** Nhận diện các biến khóa điện ảnh:
  * `[STYLE LOCK]`: Phong cách ánh sáng, gam màu, ống kính, chất lượng hình ảnh.
  * `[CHAR LOCK]`: Tên, độ tuổi, trang phục, diện mạo nhân vật cố định.
  * `[SET LOCK]`: Bối cảnh chính của câu chuyện.
  * `[VIDEO SUFFIX]`: Chuyển động máy quay, tỷ lệ khung hình, chống watermark.
* **Tự động bung mạng lưới Nodes:** Tự động tạo Prompt Node, Image Node (khung đầu) và Video Node (hành động) thẳng hàng, kết nối logic trên Canvas.
* **Muse.ai Soạn Kịch Bản 1-Chạm:** Chỉ cần nhập 1 dòng ý tưởng, Muse.ai tự động soạn kịch bản phân cảnh chuẩn cấu trúc và điền thẳng vào phần mềm.

### 2. 👤 Node Khóa Mặt & Model Sheet Nhân Vật (Character Vault)
Giải quyết triệt để bài toán **"nhân vật bị đổi mặt qua từng cảnh"** trong làm phim AI:
* **Multi-Sheet Reference:** Hỗ trợ nạp cùng lúc trọn bộ 4 Model Sheet chuyên nghiệp:
  * 🔄 **Xoay 360° (Turnaround Sheet):** Mặt trước, góc 3/4, mặt nghiêng và sau lưng trên nền trắng.
  * 😊 **Biểu Cảm (Expression Sheet):** 6 trạng thái cảm xúc (Vui, giận, buồn, ngạc nhiên, suy nghĩ, cười tít mắt).
  * 🏃 **Tư Thế Hành Động (Action Poses Sheet):** 6 dáng điệu (Khoanh tay, bước đi, vẫy chào, ngồi làm việc, chỉ tay, ăn mừng).
  * 🎒 **Chi Tiết & Đạo Cụ (Props & Costume Sheet):** Cận cảnh chất liệu vải vest, tai nghe, micro, phụ kiện.
* **Tự Động Nối Sang Mọi Cảnh (1 Click):** Tự động kéo dây tham chiếu màu xanh ngọc đến toàn bộ các node ảnh và video trên Canvas.
* **Tạo Model Sheet tự động:** Tải 1 ảnh chân dung gốc lên, Muse.ai sẽ tự động vẽ thêm 4 Model Sheet đa góc với độ tương đồng 100%.

### 3. 🎵 Node Nhạc Nền BGM Điện Ảnh (Google Flow Music Node)
* **Tạo nhạc nền chuẩn điện ảnh:** Nhập mô tả nhạc cụ, nhịp điệu (BPM), cao trào hoặc chọn Preset có sẵn.
* **Tự động khớp thời lượng video:** Tích hợp tùy chọn **Auto Duration Match** — tự động tính tổng số giây của tất cả các cảnh video trên bàn dựng để cắt nhạc vừa vặn.
* **Tích hợp Audio Player trên Node:** Nghe thử trực tiếp trên Canvas với sóng âm, thanh tua thời gian (seek bar) và nút tải về máy tính.

### 4. 🎬 Bàn Dựng Timeline Nâng Cao với Native FFmpeg
* **Render Native GPU:** Gọi trực tiếp FFmpeg 7.1 của hệ điều hành, không giật lag, không bị giới hạn 2GB RAM như WebAssembly trên trình duyệt.
* **Hiệu Ứng Chuyển Cảnh Điện Ảnh (Transitions):** Cắt nối thông thường, chớp đen (Fade), mờ chồng (Dissolve / Crossfade), lia cảnh (Wipe).
* **Lồng Nhạc Nền (BGM Audio Track):** Tự động hòa trộn âm thanh môi trường của clip với nhạc nền bằng bộ lọc `amix` và xuất video MP4 sắc nét.
* **Trích xuất End-Frame tức thì (~100ms):** Cắt khung hình cuối của video trước để nối mượt vào video sau (Continuity Lock).

### 5. 📁 Quản Lý Dự Án & Thư Viện Mẫu (Presets)
* **Lưu / Mở file `.hosiflow`:** Lưu trữ toàn bộ trạng thái canvas, vị trí node, dây nối, timeline clips để tiếp tục dựng phim bất kỳ lúc nào.
* **Thư viện mẫu có sẵn:**
  * *Review Sản Phẩm TikTok Affiliate (9:16)*
  * *Phim Ngắn Viễn Tưởng Cyberpunk (16:9)*
  * *Phim Tài Liệu & Lịch Sử Hùng Tráng (16:9)*

---

## 📥 Hướng Dẫn Cài Đặt

### Bước 1: Tải & Cài Đặt HosiFlow Studio Desktop
Bạn có thể tải trực tiếp ngay trên trang GitHub này:
* 📥 **[Tải Bản Cài Đặt: HosiFlow Studio Setup.exe (2.4 MB)](./HosiFlow%20Studio_Setup.exe)** *(Khuyên dùng — Tự động tạo biểu tượng trên Desktop & Menu Start)*.
* ⚡ **[Tải Bản Chạy Ngay: HosiFlow-Studio.exe (3.5 MB)](./HosiFlow-Studio.exe)** *(Bản Portable — Mở là chạy ngay không cần cài đặt)*.

### Bước 2: Cài Đặt HosiFlow Companion (Chrome Extension v1.5.7)
1. Tải file **[`companion-extension.zip`](./companion-extension.zip)** về máy và giải nén (hoặc dùng thư mục [`companion-extension`](./companion-extension) trong repository).
2. Mở trình duyệt Google Chrome, truy cập địa chỉ: `chrome://extensions`.
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** ➔ Chọn thư mục **`companion-extension`**.
5. Biểu tượng **HosiFlow Companion** sẽ xuất hiện trên thanh công cụ của Chrome.

---

## 🎯 Hướng Dẫn Sử Dụng Nhanh

1. **Khởi động:**
   * Mở ứng dụng **HosiFlow Studio** trên máy tính.
   * Mở trình duyệt Chrome, mở và đăng nhập:
     * Tab 1: **Muse.ai** (`https://muse.ai`) — dùng để tạo ảnh, video và nhân vật.
     * Tab 2: **Google Flow Music** (`https://www.flowmusic.app`) — dùng để tạo nhạc nền BGM.
   * Huy hiệu trạng thái trên thanh công cụ Studio Toolbar sẽ chuyển sang **`ALL READY`** (Màu xanh ngọc).

2. **Soạn kịch bản & Bung Node:**
   * Bấm nút **`Kịch Bản`** trên thanh công cụ ➔ Nhập ý tưởng và bấm **`Tạo Kịch Bản`**.
   * Bấm **`+ Tạo Cảnh Vào Canvas`** để bung toàn bộ mạng lưới node ảnh và video thẳng hàng.

3. **Khóa gương mặt nhân vật:**
   * Thêm node **Character Vault** ➔ Nạp ảnh chân dung hoặc bấm **`✨ Muse.ai Tự Động Gen`**.
   * Bấm **`⚡ Tự Động Nối Sang Mọi Cảnh`** để đồng bộ diện mạo nhân vật xuyên suốt bộ phim.

4. **Tạo Nhạc Nền BGM:**
   * Thêm node **Nhạc Nền BGM (FlowMusic)** trên Canvas.
   * Chọn thể loại nhạc mong muốn (vd: *Điện ảnh, Giao hưởng...*) và tick chọn **Khớp tổng video (Auto)**.
   * Bấm **`Tạo Nhạc (Google Flow Music)`** ➔ Hệ thống tự động tạo nhạc và cắt ngắn đúng số giây của phim.

5. **Xuất Phim Hoàn Chỉnh:**
   * Bấm **`Chạy Workflow`** để tự động kết xuất toàn bộ video.
   * Kéo các cảnh vào **Timeline Dock** ở đáy màn hình.
   * Bấm **`Xuất Phim (Native FFmpeg)`** ➔ Video MP4 hoàn chỉnh kèm hình ảnh sắc nét và nhạc nền hùng tráng sẽ được lưu về máy tính của bạn!

---

## 📋 Lịch Sử Phiên Bản (Changelog)

### v0.1.3 (09/11/2026)
* **Tích hợp Google Flow Music BGM Engine:** Thêm Node tạo nhạc nền chuyên dụng với đầy đủ preset thể loại âm nhạc phong phú.
* **FFmpeg Audio Auto-Trim:** Tự động cắt gọt file nhạc đúng thời lượng tổng của video trên Canvas bằng bộ lọc âm thanh Native.
* **HosiFlow Companion v1.5.7:** Bổ sung In-Page Passive Engine chạy trong Page World, hỗ trợ song song 2 nền tảng Muse.ai & FlowMusic.app.
* **Starter Gifts Modal:** Tích hợp hộp thoại nhận 500 Credits FlowMusic và 1 Tỷ Muse Tokens miễn phí.
* **Khắc phục triệt để lỗi kiểm tra cập nhật:** Đồng bộ phiên bản tự động theo cấu hình hệ thống.

### v0.1.2 (04/11/2026)
* Tái cấu trúc thanh công cụ Toolbar trực quan, phân nhóm chức năng gọn gàng.
* Thêm tính năng đặt tên / đổi tên Node nhanh bằng cách nhấp trực tiếp vào tiêu đề.
* Bổ sung nút xoá Node trực quan trên thanh tiêu đề và phím tắt `Delete` / `Backspace`.
* Ẩn hoàn toàn cửa sổ CMD đen khi xuất video bằng Native FFmpeg.
* Tích hợp hộp thoại lưu và mở dự án (`.hosiflow`) chuẩn Windows Native.

### v0.1.1 (01/11/2026)
* Nâng cấp bộ phân tích kịch bản tiếng Việt chuyên sâu với các khóa điện ảnh `[STYLE LOCK]`, `[CHAR LOCK]`, `[SET LOCK]`.
* Tối ưu hóa tính năng End-Frame Continuity nối mượt khung hình giữa các cảnh video.
* Thêm tính năng Lightbox phóng to ảnh và video độ phân giải gốc.

### v0.1.0 (28/10/2026)
* Phát hành phiên bản đầu tiên của HosiFlow Studio: Visual Node Canvas, Character Vault Model Sheet và Timeline Native FFmpeg.

---

## 💻 Yêu Cầu Hệ Thống

* **Hệ điều hành:** Windows 10 / Windows 11 (64-bit).
* **Trình duyệt:** Google Chrome (phiên bản mới nhất).
* **FFmpeg:** Khuyên dùng FFmpeg 7.0+ có sẵn trong Windows PATH (để tăng tốc xuất video bằng GPU).
* **RAM:** Tối thiểu 8GB (khuyên dùng 16GB trở lên).

---

## ❤️ Support & Donations

Nếu **HosiFlow Studio** giúp quy trình sáng tạo và dựng phim AI của bạn trở nên thuận tiện và hiệu quả, hãy cân nhắc ủng hộ tác giả:

* **PayPal:** [paypal.me/nkstudio](https://paypal.me/nkstudio)
* **MB Bank:** `0908107000` (LA CHI NHAN)
* **Ví MoMo:** `0908107000` (LA CHI NHAN)

---

## 📬 Contact & Support

Hỗ trợ kỹ thuật, đóng góp tính năng, báo lỗi hoặc hợp tác phát triển, vui lòng liên hệ tác giả:

* **Website:** [lachinhan.xyz](https://www.lachinhan.xyz)
* **Facebook:** [facebook.com/nhanlc](https://facebook.com/nhanlc)
* **Zalo:** [0908107000](https://zalo.me/0908107000)
* **WhatsApp:** [+84 908 107 000](https://wa.me/84908107000)
* **Telegram:** [0908107000](https://t.me/0908107000)

---

## 📄 Bản Quyền & Giấy Phép (License)

- **HosiFlow Studio (Desktop App):** Được phát hành theo giấy phép **[MIT License](LICENSE)**. Bản quyền © 2026 La Chí Nhân.
- **HosiFlow Companion Extension (`companion-extension/`):** 
  - Phần tiện ích mở rộng có tham khảo, kế thừa và tích hợp các module xử lý DOM, cơ chế bóc tách video attachments và pipeline WebAssembly từ dự án nguồn mở **[MuseFlow](https://github.com/bynne2602/museflow)** của tác giả **bynne2602**.
  - Tiện ích mở rộng cùng thư viện đính kèm **FFmpeg WebAssembly Core** được phân phối theo giấy phép **GNU General Public License v2.0 (GPL-2.0-or-later)**.
  - Toàn bộ điều khoản chi tiết, ghi nhận tác giả và mã nguồn gốc được lưu trữ tại file [companion-extension/THIRD_PARTY_NOTICES.md](companion-extension/THIRD_PARTY_NOTICES.md) và [companion-extension/LICENSE](companion-extension/LICENSE).

---

<p align="center">
  Phát triển với ❤️ bởi <strong><a href="https://www.lachinhan.xyz">La Chí Nhân</a></strong>
</p>
