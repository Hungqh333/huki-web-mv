# SPEC TỔNG — Machine Vision Hub

> File này là "hiến pháp" của dự án. Đặt tại gốc repo dưới tên `CLAUDE.md` (hoặc dán vào đầu mỗi phiên Claude Code mới) để đảm bảo mọi đoạn code sinh ra nhất quán về data model, quy ước đặt tên, và phạm vi.

## 1. Mục tiêu dự án

Xây dựng nền tảng web nội bộ cho bộ phận Vision, gồm 3 module:
1. **Bộ chọn thiết bị** theo bài toán (equipment selector, rule-based — không dùng AI/LLM để suy luận)
2. **Cẩm nang kỹ thuật** (knowledge hub): kiến thức nền, công nghệ mới, tips dự án thực tế
3. **Hệ thống tài khoản & phân quyền**: Guest / Registered / Member / VIP / Admin

Ngôn ngữ giao diện: **song ngữ Việt – Anh** (i18n ngay từ đầu, không thêm sau).

## 2. Đối tượng & vai trò người dùng

| Vai trò | Ai | Xem được cẩm nang | Dùng bộ chọn thiết bị | Ghi chú |
|---|---|---|---|---|
| **Guest** (chưa đăng nhập) | Khách vãng lai, công cụ tìm kiếm | Trang giới thiệu + bài viết đánh dấu `public` | Không | Mục tiêu SEO/marketing |
| **Registered** (đã đăng ký, chưa được cấp thêm quyền) | Khách hàng/đối tác thường | Bài viết `public` + `registered` | **Không** | Mặc định khi tự đăng ký |
| **Member** | Nhân viên nội bộ (được admin gán khi tạo tài khoản) | Bài viết `public` + `registered` + `member` | **Có — đầy đủ** | Vai trò chuẩn cho kỹ sư công ty |
| **VIP** | Nhân viên senior HOẶC đối tác thân thiết (admin cấp thủ công, không tự đăng ký được) | Tất cả, kể cả `vip` | Có, đầy đủ + tính năng nâng cao (xuất báo cáo, so sánh nhiều phương án) | Không gắn với thanh toán |
| **Admin** | Quản trị hệ thống | Tất cả | Có + quản lý luật gợi ý | Quản lý user, nội dung, rule engine |

**Nguyên tắc gating:** mỗi bài viết và mỗi tính năng có cờ `access_tier`. Không xử lý phân quyền ở giao diện — kiểm tra ở tầng API/database (Row Level Security nếu dùng Postgres).

## 3. Kiến trúc thông tin (site map)

```
/ (landing – public)
/cam-nang (danh sách bài viết, filter theo category + hiển thị khoá theo tier)
/cam-nang/[slug] (chi tiết bài viết)
/cong-cu-chon-thiet-bi (chỉ Member+ ; Registered thấy trang giới thiệu + CTA "liên hệ để được tư vấn")
/cong-cu-chon-thiet-bi/[bai-toan-slug] (form nhập tham số → kết quả gợi ý)
/dang-nhap, /dang-ky
/tai-khoan (thông tin cá nhân, lịch sử dùng công cụ)
/admin (quản lý user, bài viết, luật gợi ý — chỉ Admin)
```

## 4. Module 1 — Bộ chọn thiết bị (MVP: 3 bài toán)

**Bài toán MVP:** Alignment, Kiểm tra ngoại quan (Appearance Inspection), Đo lường 2D.
(Kiến trúc phải cho phép thêm bài toán mới — 3D, OCR/OCV, đọc mã vạch, robot guidance — chỉ bằng cách thêm dữ liệu, không sửa code.)

### Nguyên tắc thiết kế logic (quan trọng)
- Engine là **rule-based / bảng luật lưu trong database**, KHÔNG gọi AI/LLM để suy luận kỹ thuật.
- Thứ tự ưu tiên khi có nhiều phương án thoả điều kiện: **Độ ổn định → Độ chính xác → Tốc độ xử lý → Khả năng bảo trì → Dễ triển khai → Chi phí**.
- Chỉ gợi ý Deep Learning khi rule-based không đáp ứng được (biến thiên hình dạng/màu sắc lớn, không định nghĩa được bằng ngưỡng cố định). Mặc định luôn ưu tiên rule-based/truyền thống trước.

### Input chung (tuỳ bài toán sẽ bật/tắt field phù hợp)
- Kích thước vùng quan sát (FOV): rộng x cao (mm)
- Sai số/dung sai yêu cầu (mm hoặc %)
- Tốc độ dây chuyền / takt time (part/phút hoặc mm/s nếu line scan)
- Khoảng cách làm việc khả dụng (mm)
- Đặc tính bề mặt vật liệu: phản chiếu / trong suốt / kim loại / đa màu / khác
- Môi trường: rung động, bụi, độ ẩm, yêu cầu IP rating

### Logic tính toán mẫu (Đo lường 2D — tham khảo, đội kỹ thuật sẽ hoàn thiện bảng luật đầy đủ trước khi code)
```
Resolution_can_thiet (px) = FOV_mm / (Dung_sai_mm / He_so_an_toan)
He_so_an_toan mặc định = 2–3 px/feature
→ Chọn sensor có độ phân giải ≥ giá trị trên (theo trục dài hơn của FOV)
→ Nếu dung sai < 0.05mm hoặc yêu cầu đo góc/perspective-free → bắt buộc gợi ý telecentric lens
```

### Output
- Loại camera (area scan/line scan; độ phân giải tối thiểu)
- Loại ánh sáng đề xuất (theo bề mặt vật liệu)
- Loại lens (fixed / telecentric)
- Rule-based hay cần Deep Learning (kèm lý do)
- Ghi chú rủi ro/lưu ý triển khai
- Nút "Lưu kết quả" (Member+) và "Xuất báo cáo PDF" (VIP+)

## 5. Module 2 — Cẩm nang

### Nhóm nội dung
1. Fundamentals (nguyên lý optics, lighting, sensor...)
2. Công nghệ mới (3D imaging, AI inspection, embedded vision...)
3. Tips dự án thực tế (bài học từ dự án đã triển khai — nội dung giá trị nhất, mặc định `access_tier = member` trở lên)
4. So sánh/đánh giá thiết bị

### Yêu cầu
- Mỗi bài viết: `title_vi`, `title_en`, `content_vi`, `content_en`, `category`, `access_tier`, `cover_image`, `author`, `published_at`
- Trang danh sách: bài viết bị khoá vẫn hiển thị tiêu đề + đoạn mở đầu (teaser) kèm nút "Đăng nhập/Liên hệ để xem đầy đủ" — phục vụ mục tiêu marketing với khách hàng/đối tác.

## 6. Module 3 — Auth & Admin

- Đăng ký/đăng nhập chuẩn (email + password, có thể thêm Google OAuth sau).
- Admin dashboard: quản lý user (đổi role), quản lý bài viết (CRUD + rich text editor), quản lý bảng luật gợi ý thiết bị (CRUD dạng bảng, không cần sửa code).

## 7. Data model (khởi điểm — Claude Code có thể tinh chỉnh khi code)

```
users            (id, email, password_hash, name, role[registered|member|vip|admin], company, created_at)
task_types       (id, slug, name_vi, name_en, description_vi, description_en)
selector_rules   (id, task_type_id, condition_json, recommended_camera, recommended_lighting,
                  recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority)
selector_history (id, user_id, task_type_id, input_json, result_json, created_at)
articles         (id, slug, title_vi, title_en, content_vi, content_en, category,
                  access_tier[public|registered|member|vip], cover_image, author_id, published_at)
categories       (id, slug, name_vi, name_en)
```

## 8. Tech stack đề xuất

- Frontend: Next.js (App Router) + Tailwind CSS
- Backend/DB/Auth: Supabase (Postgres + Auth + Row Level Security theo role)
- i18n: next-intl hoặc next-i18next
- Hosting: Vercel
- Rich text cho cẩm nang: Tiptap hoặc tương tự

## 9. Yêu cầu phi chức năng

- Responsive (desktop ưu tiên, vì đối tượng dùng chính là kỹ sư/khách hàng B2B, nhưng vẫn phải dùng được trên mobile)
- Row Level Security bắt buộc ở tầng database, không chỉ chặn ở UI
- Toàn bộ bảng luật gợi ý thiết bị phải sửa được qua admin UI, không hard-code

## 10. Ngoài phạm vi MVP (out of scope — không tự ý làm thêm)

- Thanh toán/subscription (VIP cấp thủ công, không cần tích hợp payment)
- Bài toán 3D, OCR/OCV, đọc mã vạch, robot guidance (thêm ở phase 2, nhưng data model phải hỗ trợ mở rộng)
- Tính năng cộng đồng (comment, Q&A)
- Mobile app riêng
