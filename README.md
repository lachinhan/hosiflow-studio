# 🎬 HosiFlow Studio — AI Film & Workflow Workstation

<p align="center">
  <img src="./companion-extension/icons/hosiflow_logo.png" width="100" height="100" alt="HosiFlow Studio Logo" />
</p>

<p align="center">
  <strong>Trạm Làm Phim AI Độc Lập Chuyên Nghiệp — Tự Động Hóa Kịch Bản, Khóa Nhân Vật Đa Chiều & Bàn Dựng Timeline Điện Ảnh</strong>
</p>

<p align="center">
  <a href="./HosiFlow%20Studio%20Setup.exe"><strong>📥 Tải Bản Cài Đặt (Setup .exe - 1.8 MB)</strong></a> •
  <a href="./HosiFlow%20Studio.exe"><strong>⚡ Tải Bản Chạy Ngay (Portable .exe - 5.1 MB)</strong></a>
</p>

<p align="center">
  <a href="#-tính-năng-cốt-lõi">Tính Năng</a> •
  <a href="#-hướng-dẫn-cài-đặt">Cài Đặt</a> •
  <a href="#-hướng-dẫn-sử-dụng-nhanh">Sử Dụng</a> •
  <a href="#-cấu-trúc-dự-án">Cấu Trúc</a> •
  <a href="#-yêu-cầu-hệ-thống">Yêu Cầu</a>
</p>

---

## 🌟 Giới Thiệu

**HosiFlow Studio** là phần mềm máy tính (Desktop App) độc lập chuyên sâu dành cho các nhà sáng tạo nội dung, biên kịch và nhà làm phim AI. 

Khác với các công cụ web rời rạc, HosiFlow kết hợp sức mạnh của **Visual Node Canvas (Mạng lưới Node trực quan)**, **Bộ phân tích kịch bản tiếng Việt thông minh**, **Hệ thống khóa nhân vật Model Sheet đa góc (Character Vault)** và **Bàn dựng Timeline Native FFmpeg tốc độ cao** — kết nối mượt mà với **Muse.ai** thông qua **HosiFlow Companion Extension**.

---

## 🚀 Tính Năng Cốt Lõi

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
* **Chế độ gửi linh hoạt:** Gửi trọn bộ tất cả các sheet để AI hiểu đa chiều 360° hoặc chỉ gửi ảnh chính (Primary Reference).

### 3. ✨ Muse.ai Tự Động Sinh Model Sheet (1-Click AI)
* **Tạo từ 1 Avatar có sẵn:** Chỉ cần tải lên 1 bức ảnh chân dung gốc, Muse.ai sẽ tự động vẽ thêm 4 Model Sheet đa góc với độ tương đồng 100%.
* **Tạo mới hoàn toàn từ Mô tả:** Nhập mô tả ngoại hình + chọn Preset phong cách (*3D Pixar / Disney Chibi, Anime Nhật Bản, Điện Ảnh Chân Thực 8K, Cyberpunk*), Muse.ai sẽ tạo nhân vật từ con số 0.

### 4. 🎬 Bàn Dựng Timeline Nâng Cao với Native FFmpeg
* **Render Native GPU:** Gọi trực tiếp FFmpeg 7.1 của hệ điều hành, không bị giới hạn 2GB RAM như WebAssembly trên trình duyệt.
* **Hiệu Ứng Chuyển Cảnh Điện Ảnh (Transitions):** Cắt nối thông thường, chớp đen (Fade), mờ chồng (Dissolve / Crossfade), lia cảnh (Wipe).
* **Lồng Nhạc Nền (BGM Audio Track):** Chọn file nhạc MP3, tự động hòa trộn âm thanh môi trường của clip với nhạc nền bằng bộ lọc `amix`.
* **Trích xuất End-Frame tức thì (~100ms):** Cắt khung hình cuối của video trước để nối mượt vào video sau (Continuity Lock).

### 5. 📁 Quản Lý Dự Án & Thư Viện Mẫu (Presets)
* **Lưu / Mở file `.hosiflow`:** Lưu trữ toàn bộ trạng thái canvas, vị trí node, dây nối, timeline clips để tiếp tục dựng phim bất kỳ lúc nào.
* **Thư viện mẫu có sẵn:**
  * *Review Sản Phẩm TikTok Affiliate (9:16)*
  * *Phim Ngắn Viễn Tưởng Cyberpunk (16:9)*
  * *Phim Tài Liệu & Lịch Sử Hùng Tráng (16:9)*

### 6. 🌐 Cầu Nối Cục Bộ Bảo Mật (HosiFlow Companion)
* Giao tiếp giữa Desktop App và Muse.ai trên Chrome thông qua máy chủ nội bộ `http://127.0.0.1:4826`.
* Không cần API key trả phí, không rò rỉ dữ liệu, hoạt động độc lập và bảo mật 100%.

---

## 📥 Hướng Dẫn Cài Đặt

### Bước 1: Tải & Cài Đặt Phần Mềm HosiFlow Studio
Bạn có thể tải trực tiếp ngay trên trang GitHub này:
* 📥 **[Tải Bản Cài Đặt: HosiFlow Studio Setup.exe (1.8 MB)](./HosiFlow%20Studio%20Setup.exe)** (Khuyên dùng - Bấm chạy là tự cài đặt ra icon Desktop & Taskbar).
* ⚡ **[Tải Bản Chạy Ngay: HosiFlow Studio.exe (5.1 MB)](./HosiFlow%20Studio.exe)** (Bản Portable, click mở là chạy ngay không cần cài đặt).

### Bước 2: Cài Đặt HosiFlow Companion (Chrome Extension)
1. Tải thư mục **`companion-extension`** từ repository này về máy tính.
2. Mở trình duyệt Google Chrome, truy cập địa chỉ: `chrome://extensions`.
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** ➔ Chọn thư mục **`companion-extension`**.
5. Biểu tượng **HosiFlow Companion** sẽ xuất hiện trên thanh công cụ của Chrome.

---

## 🎯 Hướng Dẫn Sử Dụng Nhanh

1. **Khởi động:**
   * Mở ứng dụng **HosiFlow Studio** trên máy tính.
   * Mở trình duyệt Chrome, đăng nhập vào **Muse.ai** trong một tab.
   * Icon tiện ích HosiFlow trên Chrome sẽ chuyển sang màu xanh lá cây `ON` (Sẵn sàng kết nối).

2. **Tạo kịch bản:**
   * Bấm nút **`Kịch Bản`** trên thanh công cụ ➔ Nhập ý tưởng và bấm **`Tạo Kịch Bản`** (Muse.ai sẽ tự động viết phân cảnh).
   * Bấm **`+ Tạo Cảnh Vào Canvas`** để bung toàn bộ mạng lưới node.

3. **Khóa nhân vật:**
   * Bấm vào node **Character Vault** ➔ Bấm **`✨ Muse.ai Tự Động Gen`** để sinh bộ Model Sheet hoặc tải ảnh chân dung có sẵn lên.
   * Bấm **`⚡ Tự Động Nối Sang Mọi Cảnh`** để đồng bộ gương mặt nhân vật xuyên suốt câu chuyện.

4. **Chạy Render & Dựng phim:**
   * Bấm **`Chạy Workflow`** để tự động tạo toàn bộ ảnh và video.
   * Kéo các clip vào thanh **Timeline** ở đáy màn hình, chọn hiệu ứng chuyển cảnh và thêm nhạc nền MP3.
   * Bấm **`Xuất Phim (Native FFmpeg)`** để xuất ra file video MP4 hoàn chỉnh!

---

## 💻 Yêu Cầu Hệ Thống

* **Hệ điều hành:** Windows 10 / Windows 11 (64-bit).
* **Trình duyệt:** Google Chrome (phiên bản mới nhất).
* **FFmpeg:** Khuyên dùng FFmpeg 7.0+ có sẵn trong Windows PATH (để tăng tốc xuất video bằng GPU).
* **RAM:** Tối thiểu 8GB (khuyên dùng 16GB trở lên).

---

## 📄 Bản Quyền & Giấy Phép

Phát hành theo giấy phép **MIT License**. Xem chi tiết tại file [LICENSE](LICENSE).

---

<p align="center">
  Phát triển bởi <strong>HosiFlow Studio Team</strong>
</p>
