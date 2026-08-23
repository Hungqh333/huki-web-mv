# Chuỗi prompt cho Claude Code — Machine Vision Hub

## Cách dùng
1. Tạo repo/thư mục dự án, copy file `01-spec-tong-machine-vision-hub.md` vào gốc repo, đổi tên thành `CLAUDE.md`. Claude Code sẽ tự đọc file này làm ngữ cảnh mỗi phiên.
2. Chạy **lần lượt từng prompt bên dưới**, theo đúng thứ tự — không gộp lại thành 1 prompt duy nhất.
3. Sau mỗi prompt: chạy thử (`npm run dev`), kiểm tra kỹ, `git commit` khi ổn, rồi mới sang prompt tiếp theo.
4. Nếu 1 bước bị lỗi/không như ý: sửa ngay ở bước đó trước khi đi tiếp — đừng để lỗi dồn sang bước sau, Claude Code sẽ càng lúc càng khó sửa vì phải suy luận ngược từ code sai.

---

## Prompt 0 — Scaffold dự án
```
Đọc kỹ file CLAUDE.md ở gốc repo trước khi làm bất cứ điều gì.

Khởi tạo dự án Next.js (App Router, TypeScript, Tailwind CSS) theo đúng tech stack
trong CLAUDE.md. Setup kết nối Supabase (đọc biến môi trường từ .env.local, tạo
file .env.example với các key cần thiết). Setup i18n (next-intl) với 2 ngôn ngữ
vi/en, vi là mặc định. Tạo layout tổng: header (logo, menu, nút đăng nhập/tài
khoản, chọn ngôn ngữ), footer.

KHÔNG code tính năng nghiệp vụ ở bước này. Chỉ setup scaffold + layout rỗng,
đảm bảo chạy được `npm run dev` không lỗi.
```

## Prompt 1 — Data model + Auth + Phân quyền
```
Đọc CLAUDE.md, mục 2 (vai trò người dùng) và mục 7 (data model).

Tạo migration Supabase cho các bảng: users (mở rộng bảng auth.users có sẵn của
Supabase bằng bảng profiles chứa role/company), task_types, selector_rules,
selector_history, articles, categories — đúng theo schema trong CLAUDE.md.

Thiết lập Row Level Security cho từng bảng theo đúng ma trận phân quyền ở mục 2:
- articles: Guest/Registered chỉ đọc được bài access_tier public/registered,
  Member đọc thêm tier member, VIP đọc tất cả.
- selector_rules, selector_history: chỉ Member trở lên mới đọc/ghi được.

Code trang /dang-ky, /dang-nhap, /tai-khoan. Khi user tự đăng ký → mặc định
role = registered. Role member/vip chỉ admin gán được (chưa cần code admin UI
ở bước này, chỉ cần seed 1 tài khoản admin thủ công qua Supabase dashboard để
test).

Test: tạo 1 user registered và xác nhận không truy cập được nội dung member/vip.
```

## Prompt 2 — Module Bộ chọn thiết bị
```
Đọc CLAUDE.md mục 4 (Module 1). Chỉ làm cho 3 bài toán: Alignment, Kiểm tra
ngoại quan, Đo lường 2D.

Trang /cong-cu-chon-thiet-bi: nếu user chưa phải Member/VIP/Admin → hiển thị
trang giới thiệu tính năng + nút "Liên hệ để được tư vấn", KHÔNG cho vào form.
Nếu đủ quyền → hiển thị 3 thẻ bài toán, click vào 1 thẻ sang trang form riêng.

Với mỗi bài toán, tạo form nhập các tham số liên quan (theo mục 4 của CLAUDE.md)
và implement engine tính toán dựa trên bảng selector_rules trong database — đọc
luật từ DB, không hard-code luật trong component. Với Đo lường 2D, dùng công
thức tính resolution mẫu trong CLAUDE.md làm điểm khởi đầu.

Hiển thị kết quả: loại camera, ánh sáng, lens, rule-based hay cần AI (kèm lý
do), ghi chú rủi ro. Lưu lịch sử vào selector_history khi Member+ chạy tính
toán. Nút "Xuất PDF" hiển thị nhưng có thể để dạng placeholder (chưa cần hoàn
thiện xuất PDF thật ở bước này) — đánh dấu rõ trong code bằng TODO.

Seed sẵn 5-10 dòng dữ liệu mẫu vào selector_rules cho từng bài toán để test
được ngay (tôi sẽ cung cấp bảng luật đầy đủ sau, đây chỉ là dữ liệu tạm).
```

## Prompt 3 — Module Cẩm nang
```
Đọc CLAUDE.md mục 5. Trang /cam-nang: danh sách bài viết, filter theo category,
badge hiển thị access_tier. Bài bị khoá với user hiện tại → hiển thị tiêu đề +
đoạn mở đầu (2-3 câu đầu content) + nút "Đăng nhập để xem đầy đủ" thay vì ẩn
hoàn toàn.

Trang /cam-nang/[slug]: hiển thị đầy đủ nếu đủ quyền, redirect về trang khoá
nếu không. Hỗ trợ song ngữ — chuyển đổi vi/en hiển thị đúng content_vi/content_en.

Seed 5 bài viết mẫu (2 public, 2 member, 1 vip) để test gating hoạt động đúng.
```

## Prompt 4 — Admin dashboard
```
Đọc CLAUDE.md mục 6. Trang /admin (chỉ role admin truy cập được, redirect nếu
không đủ quyền):
- Quản lý user: xem danh sách, đổi role (registered/member/vip/admin)
- Quản lý bài viết: CRUD, rich text editor (Tiptap) cho content_vi/content_en
- Quản lý bảng luật gợi ý thiết bị: CRUD dạng bảng cho selector_rules, có
  validate condition_json cơ bản trước khi lưu
```

## Prompt 5 — Polish + Deploy
```
Rà lại toàn bộ: responsive trên mobile (đặc biệt trang /cong-cu-chon-thiet-bi
và /admin), loading state, error handling khi gọi Supabase, kiểm tra RLS một
lần nữa bằng cách thử truy cập trực tiếp URL API với user không đủ quyền.

Chuẩn bị deploy lên Vercel: kiểm tra biến môi trường, viết README hướng dẫn
setup local + deploy.
```
