# 🎬 HosiFlow Studio — AI Film & Workflow Workstation

<p align="center">
  <img src="./companion-extension/icons/hosiflow_logo.png" width="105" height="105" alt="HosiFlow Studio Logo" />
</p>

<p align="center">
  <strong>Trạm Làm Phim, MV Ca Nhạc & Video Affiliate AI Độc Lập Chuyên Nghiệp — Tự Động Hóa Kịch Bản, Khóa Nhân Vật, Bóc Tách Sản Phẩm Shopee/TikTok & Bàn Dựng Timeline Điện Ảnh</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-v0.1.5-8b5cf6?style=for-the-badge&logo=rocket" alt="Version v0.1.5" />
  <img src="https://img.shields.io/badge/Companion-v1.6.0-06b6d4?style=for-the-badge&logo=googlechrome" alt="Companion v1.6.0" />
  <img src="https://img.shields.io/badge/Zero%20API%20Cost-100%25%20Free-10b981?style=for-the-badge" alt="Zero API Cost" />
  <img src="https://img.shields.io/badge/Engine-Native%20Rust%20%26%20FFmpeg%207.1-f59e0b?style=for-the-badge" alt="Native Engine" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <a href="./HosiFlow%20Studio_Setup.exe"><strong>📥 Tải Bản Cài Đặt (Setup .exe - 2.4 MB)</strong></a> •
  <a href="./HosiFlow-Studio.exe"><strong>⚡ Tải Bản Chạy Ngay (Portable .exe - 9.9 MB)</strong></a> •
  <a href="./companion-extension.zip"><strong>📦 Tải Tiện Ích Companion (.zip)</strong></a>
</p>

<p align="center">
  <a href="#-có-gì-mới-trong-bản-v015">Có Gì Mới v0.1.5</a> •
  <a href="#-tính-năng-cốt-lõi">Tính Năng Cốt Lõi</a> •
  <a href="#-hướng-dẫn-làm-video-affiliate-shopee--tiktok-shop-3-bước">Video Affiliate</a> •
  <a href="#-hướng-dẫn-làm-mv-ca-nhạc-hoàn-chỉnh">Làm MV Ca Nhạc</a> •
  <a href="#-quà-tặng-tân-thủ--credits-miễn-phí">Quà Tân Thủ</a> •
  <a href="#-hướng-dẫn-cài-đặt">Cài Đặt</a> •
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
4. **Node Tạo Nhạc Nền BGM Điện Ảnh & Sáng Tác Bài Hát MV với Google Flow Music**.
5. **Trạm Sản Xuất Video Affiliate Shopee & TikTok Shop** — Tự động cào dữ liệu sản phẩm, bóc tách giá bán và sinh kịch bản review 9:16 chuẩn TikTok.
6. **Bàn dựng Timeline 2 Rãnh (Track Video & Track BGM Nhạc) với Native FFmpeg tốc độ cao**.
7. **HosiFlow Companion Extension (v1.6.0)** — Cầu nối vệ tinh đa nền tảng điều khiển song song **Muse.ai**, **Google Flow Music** và bóc tách dữ liệu E-Commerce.

### 💡 Điểm Đột Phá: Cơ Chế "Zero API Cost" — Tiết Kiệm Tối Đa Chi Phí
* **Hoàn Toàn Không Cần API Key:** Không bắt buộc bạn phải đăng ký tài khoản lập trình viên, không cần thẻ tín dụng quốc tế, không lo mua token API hàng tháng đắt đỏ.
* **Tận Dụng Phiên Đăng Nhập Sẵn Có:** Tự động điều khiển và thực thi trực tiếp trên phiên làm việc Muse.ai và FlowMusic.app sẵn có của bạn trên trình duyệt Chrome thông qua tiện ích mở rộng HosiFlow Companion.
* **Sáng Tạo Không Giới Hạn:** Tận dụng triệt để tài nguyên có sẵn để viết kịch bản, tạo ảnh khung đầu, sinh video, tạo nhạc nền và dựng phim liên tục.
* **Bảo Mật Cục Bộ 100%:** Toàn bộ kịch bản, ảnh nhân vật, video và file âm thanh được xử lý và lưu trữ ngay trên ổ cứng máy tính của bạn qua cổng kết nối nội bộ `127.0.0.1:4826`, không qua bất kỳ máy chủ trung gian nào.

---

## 🚀 Có Gì Mới Trong Bản v0.1.5? — Trạm Sản Xuất Video Affiliate Shopee & TikTok Shop

* 🛍️ **Node Sản Phẩm Affiliate Chuyên Dụng (`ProductAffiliateNode`):**
  * Nút chức năng mới **"🛍️ Sản Phẩm"** nổi bật trên thanh công cụ Studio Toolbar.
  * Giao diện phong cách E-Commerce chuyên nghiệp, quản lý hình ảnh sản phẩm trực quan, thẻ tag USP tự động và chọn ảnh bìa đại diện (Hero Image).
* 🕷️ **Tự Động Bóc Tách Link Shopee & TikTok Shop Siêu Tốc (Zero Token API):**
  * Hỗ trợ đầy đủ các định dạng link: `shopee.vn`, link chia sẻ rút gọn `s.shopee.vn`, `tiktok.com` và link app `vt.tiktok.com`.
  * Trích xuất trọn vẹn danh mục ảnh gốc CDN Full HD chất lượng cao, tên sản phẩm chuẩn SEO, danh mục ngành hàng và các điểm bán hàng độc nhất (USP).
  * Thuật toán lọc giá thông minh: Nhận diện chính xác giá bán hiện tại, giá gốc gạch ngang, tỷ lệ giảm giá %, điểm đánh giá sao và số lượng đã bán.
  * Cho phép chỉnh sửa giá trực tiếp trên Node để linh hoạt cập nhật theo các chương trình Flash Sale hoặc mã giảm giá tức thời.
* 🎯 **4 Phong Cách Hook TikTok Viral 3 Giây Đầu:**
  * **📦 Đập Hộp & Ngỡ Ngàng:** Kích thích tò mò, mở seal và zoom cận cảnh chi tiết hoàn thiện sản phẩm.
  * **💥 Sốc Giá & Flash Sale:** Đánh mạnh vào yếu tố tâm lý hời, giảm giá sập sàn, deal hời chớp nhoáng.
  * **❓ Giải Quyết Vấn Đề:** Đặt ra nỗi đau hay gặp hàng ngày và giới thiệu sản phẩm như vị cứu tinh lý tưởng.
  * **🌟 Review Chân Thật:** Soi kỹ chất lượng thực tế, cảm nhận khách quan và độ bền vượt trội.
* 🎬 **Nút 1-Chạm: "Bung Kịch Bản Affiliate Vào Canvas (3 Cảnh 9:16)":**
  * Tự động sinh ngay bộ 3 phân cảnh video tỷ lệ dọc 9:16 chuẩn TikTok / Reels / Shorts:
    * **Cảnh 1 (Hook):** Mở màn gây tò mò, bắt trọn 3s vàng của người xem, tự động kết nối ảnh Hero sản phẩm vào cổng `reference-in`.
    * **Cảnh 2 (Demo Trải Nghiệm):** Thể hiện tính năng thực tế vượt trội và cảm nhận sử dụng.
    * **Cảnh 3 (Báo Giá & Kêu Gọi):** Khai thác giá sốc, khuyến mãi và kêu gọi click giỏ hàng góc trái màn hình.
  * Tự động nối dây Prompt từ kịch bản sang từng cảnh, nối dây ảnh sản phẩm và kích hoạt tính năng **Nối cảnh trước (Continuity)** giữa các cảnh video.
* 🌐 **Nâng Cấp HosiFlow Companion v1.6.0:**
  * Tích hợp engine cào DOM CSR trực tiếp trên phiên duyệt Chrome thông qua tab nền thông minh, bypass triệt để rào cản trang trắng JavaScript mà không tốn 1 đồng chi phí API.

---

## 🛍️ Hướng Dẫn Làm Video Affiliate Shopee & TikTok Shop (3 Bước)

Quy trình cực nhanh để tạo ra 1 video review sản phẩm 9:16 viral trên TikTok:

1. **Bóc Tách Dữ Liệu Sản Phẩm:**
   * Bấm nút **`🛍️ Sản Phẩm`** trên thanh công cụ để thêm Node Sản Phẩm vào Canvas.
   * Dán đường link sản phẩm Shopee (vd: `https://s.shopee.vn/...`) hoặc TikTok Shop (vd: `https://vt.tiktok.com/...`) vào ô nhập link.
   * Bấm nút **`✨ Bóc Tách`** ➔ Hệ thống tự động cào tên, giá, số lượt bán và toàn bộ ảnh sản phẩm Full HD trong vài giây.

2. **Chọn Phong Cách Hook & Bung Kịch Bản:**
   * Nhấp chọn 1 trong các ảnh sản phẩm làm ảnh đại diện **Hero** (dùng làm ảnh tham chiếu sinh video).
   * Bạn có thể nhấp vào ô giá để sửa giá bán tùy ý nếu đang có flash sale.
   * Chọn 1 trong 4 phong cách Hook: *Đập Hộp & Ngỡ Ngàng*, *Sốc Giá & Flash Sale*, *Giải Quyết Vấn Đề*, hoặc *Review Chân Thật*.
   * Bấm nút cam **`📦🎬 Bung Kịch Bản Affiliate Vào Canvas (3 Cảnh 9:16)`**. Hệ thống sẽ tự động vẽ 3 phân cảnh 9:16 kèm kịch bản prompt chi tiết nối dây sẵn sàng!

3. **Render Video & Xuất Thành Phẩm:**
   * Bạn có thể nối thêm Node Nhạc BGM sôi động nếu muốn.
   * Bấm **`Chạy Workflow`** hoặc bấm tạo từng cảnh trên Muse.ai.
   * Kéo các cảnh vào bàn dựng Timeline và xuất ra video 9:16 hoàn chỉnh sẵn sàng đăng TikTok / Shorts / Reels kiếm hoa hồng affiliate!

---

---

## 🚀 Có Gì Mới Trong Bản v0.1.4?

* 🎼 **Preset Mới: "MV Ca Nhạc V-Pop Điện Ảnh" (Thư Viện Mẫu Workflow):**
  * Tích hợp mẫu quy trình hoàn chỉnh chuyên biệt cho MV ca nhạc ở ô số 4 trong thư viện Presets.
  * Thiết lập sẵn **Character Vault** (khóa mặt ca sĩ Hà An), **Node Sáng Tác Ca Khúc V-Pop** (có lời, ~2-3 phút) và **4 phân cảnh video Muse.ai** kết nối liền mạch (Continuity Lock).
* 🔗 **Cổng Nhận Âm Thanh (`audio-in`) & Nối Dây Âm Nhạc Trực Quan Trên Canvas:**
  * Bổ sung cổng Handle màu tím **`audio`** trên Node Video (`GenerateVideoNode`), cho phép nối trực tiếp dây âm thanh từ Node Nhạc sang phân cảnh video.
  * **Tự động điều phối thứ tự thực thi (Topological Sort):** Khi bấm **"Chạy Workflow"**, hệ thống tự động nhận diện quan hệ phụ thuộc để ưu tiên tạo bài hát trên FlowMusic trước $\rightarrow$ nạp bài hát vào Timeline $\rightarrow$ rồi mới lần lượt chạy các cảnh video trên Muse.ai.
* 🎞️ **Bàn Dựng 2 Rãnh & Xuất Phim Hoàn Chỉnh Có Nhạc (Native FFmpeg):**
  * Tự động đồng bộ **Track 1 (Video)** và **Track 2 (BGM Audio)** trên Timeline Dock.
  * Xuất ra **1 file video MP4 duy nhất** đã được hòa âm (mixdown & audio sync) đồng bộ cả hình ảnh lẫn lời bài hát/âm nhạc chất lượng cao, không cần công cụ ghép video bên ngoài.
* 🎤 **Nâng Cấp Toàn Diện Node Sáng Tác Ca Khúc & MV Ca Nhạc:**
  * **Chế độ 1 — Bài Hát MV (Ca Nhạc / Full Song):** Cho phép tạo ca khúc hoàn chỉnh độ dài đầy đủ ~2-3 phút, giữ trọn vẹn bản thu gốc từ FlowMusic mà không bị ép cắt ngắn về 5 giây.
  * **Soạn thảo Lời Bài Hát (Lyrics / Verse - Chorus):** Khung nhập ca từ chuyên dụng có thể gõ hoặc dán lời bài hát tiếng Việt / tiếng Anh kèm cấu trúc phân đoạn `[Verse 1]`, `[Chorus]`, `[Outro]`.
  * **Tùy Chọn Giọng Hát (Vocals):** Chọn linh hoạt giữa **Có lời (Vocal)** với chất giọng `👩 Giọng Nữ`, `👨 Giọng Nam`, `👫 Song Ca` hoặc **Không lời (Instrumental)**.
  * **12 Thể Loại Âm Nhạc & Chế Độ Tự Viết (Custom):** Bổ sung phong phú các phong cách: *V-Pop, Pop Ballad, EDM Dance, R&B Soul, Acoustic Guitar, Rap/Hip-Hop, Indie Rock, Anime J-Pop, Bolero Trữ Tình...* cùng tùy chọn `✨ Tự Viết / Tùy Chỉnh` tự do sáng tạo không bao giờ bị ghi đè.
* 🎬 **Nút Chức Năng Đột Phá: "Phân Cảnh MV Vào Canvas":**
  * Tự động sinh chuỗi 5 Node Cảnh Video (*Intro, Đoạn hát 1, Điệp khúc cao trào, Cao trào cốt truyện, Đoạn kết Outro*) trên Canvas tương ứng với nhịp bài hát, nối sẵn Continuity để bạn gửi lệnh render sang Muse.ai.
* 🌐 **HosiFlow Companion v1.5.8:**
  * Đồng bộ thông số thời lượng thông minh: Hỗ trợ chế độ Full Length (`duration = 0`), bảo toàn 100% độ dài và chất lượng bài hát gốc khi tải về máy.

---

## 🎤 Hướng Dẫn Sáng Tác MV Ca Nhạc Hoàn Chỉnh

Quy trình 4 bước đơn giản để tạo ra một MV ca nhạc AI chất lượng cao từ con số 0:

1. **Tạo Bài Hát với Google Flow Music:**
   * Bấm nút **`Bài Hát & Nhạc`** trên thanh công cụ để thêm Node âm thanh vào Canvas.
   * Chọn chế độ **`Bài Hát MV (Ca Nhạc)`**.
   * Chọn thể loại ca khúc (vd: *V-Pop Nhạc Trẻ*, *Pop Ballad*, *EDM*...) hoặc chọn *Tự Viết / Tùy Chỉnh*.
   * Chọn giọng hát mong muốn (*Nữ, Nam, hoặc Song ca*).
   * Dán lời bài hát (Lyrics) và mô tả giai điệu nhạc cụ vào ô soạn thảo.
   * Để thời lượng là **`⭐ Nguyên bài gốc (~2-3 phút, không cắt)`** và bấm **`Tạo Bài Hát Ca Nhạc (Google Flow Music)`**.

2. **Bung Phân Cảnh MV Sang Canvas:**
   * Khi bài hát đã tạo xong, bấm nút **`🎬 Phân Cảnh MV Vào Canvas (+5 Cảnh Video)`**.
   * Hệ thống tự động tạo 5 phân cảnh video ăn khớp (*Mở đầu Intro, Đoạn Hát 1, Điệp Khúc Bùng Nổ, Cốt Truyện Kịch Tính, Đoạn Kết Outro*) nối sẵn Continuity.

3. **Khóa Nhân Vật Ca Sĩ / Diễn Viên MV:**
   * Thêm Node **Character Vault**, nạp ảnh chân dung ca sĩ / diễn viên chính của bạn và bấm **`⚡ Tự Động Nối Sang Mọi Cảnh`** để gương mặt đồng nhất trên toàn bộ video.

4. **Render Video & Dựng MV Trên Timeline:**
   * Bấm **`Chạy Workflow`** (hoặc bấm tạo từng cảnh) để Muse.ai render các đoạn clip MV.
   * Mở **Timeline Dock** ở đáy màn hình: Bài hát sẽ nằm ở rãnh **BGM Track**, còn các video clip nằm ở rãnh **Video Track**.
   * Bấm **`Xuất Phim (Native FFmpeg)`** để xuất ra file MV ca nhạc hoàn chỉnh chất lượng cao!

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

### v0.1.5 (11/11/2026)
* **Trạm Sản Xuất Video Affiliate Shopee & TikTok Shop:** Thêm Node Sản Phẩm chuyên dụng (`ProductAffiliateNode`) với giao diện Thương mại điện tử trực quan.
* **Tự Động Bóc Tách Link Shopee & TikTok Shop:** Hỗ trợ mọi định dạng link (bao gồm link rút gọn `s.shopee.vn`, `vt.tiktok.com`), cào trọn bộ ảnh gốc Full HD từ CDN, tiêu đề sản phẩm, USP và danh mục ngành hàng.
* **Thuật Toán Bóc Tách Giá & Thống Kê Thông Minh:** Nhận diện chính xác giá bán hiện tại, giá gốc gạch ngang, tỷ lệ giảm giá, điểm số đánh giá và số lượng đã bán. Hỗ trợ sửa giá trực tiếp trên Node.
* **4 Phong Cách Hook TikTok 3 Giây Đầu Chuẩn Viral:** Đập Hộp & Ngỡ Ngàng, Sốc Giá & Flash Sale, Giải Quyết Vấn Đề và Review Chân Thật.
* **Nút 1-Chạm Bung Kịch Bản 3 Phân Cảnh (9:16):** Tự động sinh chuỗi 3 cảnh video dọc chuẩn TikTok (Hook $\rightarrow$ Trải Nghiệm $\rightarrow$ Báo Giá & Kêu Gọi) nối sẵn dây Prompt, dây ảnh Hero tham chiếu và bật Continuity liền mạch.
* **HosiFlow Companion v1.6.0:** Nâng cấp tiện ích mở rộng với engine trích xuất DOM tab nền trên Chrome, giải quyết bài toán CSR của Shopee/TikTok mà không cần token API.

### v0.1.4 (10/11/2026)
* **Preset "MV Ca Nhạc V-Pop Điện Ảnh":** Bổ sung preset quy trình MV hoàn chỉnh (Character Vault khóa mặt + Node tạo bài hát FlowMusic + 4 cảnh video Muse.ai kết nối Continuity).
* **Cổng Nhận Âm Thanh (`audio-in`) & Nối Dây Âm Nhạc:** Bổ sung handle nhận âm thanh màu tím trên Node Video, cho phép nối dây trực tiếp và tự động ưu tiên tạo bài hát trước khi render video khi chạy toàn bộ Workflow.
* **Bàn Dựng 2 Rãnh & Xuất Video Có Nhạc Hoàn Chỉnh:** Ghép nối tự động Track 1 (Video) và Track 2 (BGM Audio) thành 1 file MP4 hoàn chỉnh qua Native FFmpeg.
* **Nâng cấp Music Video (MV) Workstation:** Bổ sung chế độ sáng tác Bài Hát MV (Full Song) hoàn chỉnh ~2-3 phút, giữ trọn vẹn bản thu gốc, không bị ép cắt ngắn về 5s.
* **Soạn thảo Ca từ (Lyrics) & Vocals:** Hỗ trợ nhập lời bài hát, phân đoạn `[Verse]`, `[Chorus]`, tùy chọn giọng hát Nữ / Nam / Song Ca hoặc Không lời (Instrumental).
* **Bổ sung 12 Preset Thể Loại & Tùy Chỉnh:** V-Pop, Ballad, EDM, R&B, Rock, Rap, Anime, Bolero... và chế độ Tự Viết Tùy Chỉnh (Custom).
* **Tính năng Phân Cảnh MV Vào Canvas:** Tự động tạo 5 Node Cảnh Video tương ứng với bài hát nối sẵn Continuity để render trên Muse.ai.
* **HosiFlow Companion v1.5.8:** Hỗ trợ chế độ tải Full Track (`duration = 0`) bảo toàn 100% độ dài và chất lượng file âm thanh gốc.

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
