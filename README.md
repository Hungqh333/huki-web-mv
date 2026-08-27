# Machine Vision Hub

Nền tảng web nội bộ cho bộ phận Vision: bộ chọn thiết bị theo bài toán, cẩm nang kỹ
thuật song ngữ, và hệ thống phân quyền 5 cấp.

Đặc tả đầy đủ nằm ở [CLAUDE.md](CLAUDE.md) — file đó là nguồn sự thật cho data model,
quy ước đặt tên và phạm vi dự án.

## Tech stack

| Thành phần | Lựa chọn |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 |
| Backend / DB / Auth | Supabase (Postgres + Auth + Row Level Security) |
| i18n | next-intl — Việt (mặc định) / Anh, chọn qua cookie `NEXT_LOCALE` |
| Rich text | Tiptap |
| Hosting | Vercel |

## Nguyên tắc bảo mật cốt lõi

**Phân quyền được thực thi ở tầng database bằng Row Level Security, không phải ở
giao diện.** Việc ẩn/hiện nút trong React chỉ để trải nghiệm dễ chịu; nếu ai đó lấy
anon key từ mã nguồn trang và gọi thẳng REST API thì RLS vẫn chặn.

Kiểm chứng điều này bất cứ lúc nào:

```bash
npm run probe:rls
```

## Chạy ở máy local

### 1. Cài đặt

```bash
npm install
```

### 2. Tạo project Supabase

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → chọn region
**Southeast Asia (Singapore)**.

### 3. Cấu hình biến môi trường

```bash
cp .env.example .env.local
```

Điền hai giá trị lấy từ **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

> `SUPABASE_SERVICE_ROLE_KEY` bypass toàn bộ RLS. Chỉ điền khi thật sự cần cho tác vụ
> phía server, và **tuyệt đối không** đặt tiền tố `NEXT_PUBLIC_` cho nó — biến có tiền
> tố đó bị nhúng vào JavaScript gửi xuống trình duyệt. `npm run check:env` có bẫy
> phát hiện nhầm lẫn này.

### 4. Dựng schema

Kiểm tra SQL trước khi đụng vào database thật (chạy trên Postgres in-process, không
cần Docker):

```bash
npm run test:db
```

Rồi áp lên Supabase — **SQL Editor** → dán từng file → Run, theo đúng thứ tự:

1. `supabase/migrations/20260823000001_init_schema.sql`
2. `supabase/migrations/20260824000001_selector_engine.sql`
3. `supabase/seed.sql`

> **Windows: đừng dùng `clip` từ Git Bash để copy file SQL.** `clip.exe` diễn giải byte
> theo codepage OEM chứ không phải UTF-8, làm `Đo lường 2D` thành `─Éo l╞░ß╗¥ng 2D`.
> Dùng PowerShell:
> ```powershell
> Get-Content -Raw -Encoding UTF8 "supabase\seed.sql" | Set-Clipboard
> ```
> Hoặc mở file trong VS Code rồi Ctrl+A / Ctrl+C.

Chi tiết thêm ở [supabase/README.md](supabase/README.md).

### 5. Tạo tài khoản admin đầu tiên

Không có đường tự đăng ký thành admin — đúng theo thiết kế. Đăng ký bình thường qua
`/dang-ky`, rồi chạy trong SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'email-cua-ban@example.com';
```

Câu lệnh chạy được ở đây vì SQL Editor không có JWT (`auth.uid()` là NULL) nên trigger
`enforce_profile_role_change` cho qua. Cùng câu lệnh đó gọi từ trình duyệt bằng anon
key sẽ bị từ chối.

### 6. Chạy

```bash
npm run dev
```

## Các lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Build production (tự kiểm biến môi trường trước) |
| `npm run lint` | ESLint |
| `npm run check:env` | Kiểm biến môi trường |
| `npm run test:unit` | Unit test engine chọn thiết bị, xử lý nội dung, nhất quán dữ liệu seed |
| `npm run test:pdf` | Kiểm tra PDF xuất ra mã hoá đúng tiếng Việt |
| `npm run test:db` | Áp migration + seed + test RLS trên Postgres in-process |
| `npm run test:db:mutate` | Cố tình phá từng luật bảo mật, kiểm bộ test có bắt được không |
| `npm run probe:rls` | Dò RLS qua REST API thật với vai khách |
| `npm run test:all` | Chạy tất cả trừ `probe:rls` |
| `npm run import:rules:template` | Sinh file Excel mẫu cho đội kỹ thuật điền bảng luật |
| `npm run import:rules -- <file>` | Kiểm tra file Excel rồi chuyển thành SQL |

### Vì sao có `test:db:mutate`

Một bộ test bảo mật luôn báo pass thì vô dụng. Script này phá từng luật RLS một
(bỏ gating theo tier, bỏ trigger chặn nâng quyền, cho mọi tài khoản ghi bài viết…)
rồi chạy lại bộ test. **Mọi lỗ hổng đều phải bị bắt.** Dòng `BỎ SÓT` nghĩa là bộ test
có điểm mù cần bổ sung assert.

Chạy lại mỗi khi sửa policy trong migration.

## Cấu trúc

```
src/
  app/
    admin/                    Trang quản trị (chỉ role admin)
    cam-nang/                 Cẩm nang: danh sách + chi tiết
    cong-cu-chon-thiet-bi/    Bộ chọn thiết bị
    actions/                  Server actions (auth, selector, admin)
  lib/
    auth.ts                   Đọc phiên + helper phân quyền cho UI
    selector/                 Engine rule-based (không chứa luật nào)
    html.ts                   Làm sạch HTML bằng allowlist
    supabase/                 Client cho browser / server / proxy
  messages/                   Chuỗi dịch vi + en
supabase/
  migrations/                 Schema + RLS
  seed.sql                    Dữ liệu tham chiếu + bảng luật + bài viết mẫu
  tests/rls_smoke_test.sql    Kiểm chứng RLS cho cả 4 vai trò
scripts/                      Test và công cụ kiểm tra
```

### Engine chọn thiết bị

Engine **không chứa luật kỹ thuật nào**. Toàn bộ luật nằm ở bảng `selector_rules`
trong database và sửa được qua `/admin/luat-goi-y`. Code chỉ làm hai việc: tính các
đại lượng suy ra theo công thức ở CLAUDE.md mục 4, và ghép kết quả từ những luật khớp
theo thứ tự ưu tiên.

Kết quả tính toán được đưa ngược vào ngữ cảnh đánh giá luật, nên luật viết được điều
kiện kiểu `required_resolution_px > 5000 → line scan`. Nhờ vậy ngưỡng chọn cảm biến
vẫn do admin sửa, còn công thức thì ở trong code.

Thêm bài toán mới = thêm dòng vào `task_types` kèm `input_fields`, không sửa code —
miễn là dùng lại các trường đã có trong catalog `src/lib/selector/fields.ts`. Bảy bài
toán hiện có (3 bài MVP + 3D, OCR/OCV, đọc mã vạch, dẫn hướng robot) đều được thêm
theo đúng cách này.

Đổi lại, gõ sai một tên trường sẽ **không gây lỗi ở đâu cả** — form lặng lẽ bỏ qua,
hoặc luật không bao giờ khớp. Vì vậy `npm run test:unit` có bộ kiểm tra đối chiếu dữ
liệu seed với catalog, bắt các trường hợp: trường lạ, trường không thuộc bài toán đó,
bài toán thiếu luật nền.

### Nhập bảng luật từ Excel

Đội kỹ thuật điền bảng luật trong Excel thay vì gõ tay từng dòng vào trang quản trị:

```bash
npm run import:rules:template          # sinh file mẫu, gửi cho đội kỹ thuật
npm run import:rules -- bang-luat.xlsx # kiểm tra rồi chuyển thành SQL
```

File mẫu có sẵn sheet hướng dẫn liệt kê toàn bộ trường dùng được, cú pháp điều kiện,
và cách engine ghép kết quả theo thứ tự ưu tiên.

Công cụ kiểm tra từng dòng **trước khi** sinh SQL: mã trùng, bài toán không tồn tại,
JSON sai cú pháp, và quan trọng nhất — điều kiện tham chiếu tới trường không thuộc
bài toán đó. Lỗi cuối nguy hiểm nhất vì luật vẫn lưu được nhưng không bao giờ khớp,
không có thông báo nào. Danh sách bài toán đọc từ Supabase thật nên phản ánh cả những
bài đội kỹ thuật thêm qua trang quản trị.

SQL sinh ra idempotent theo cột `code`: chạy lại thì cập nhật luật cũ chứ không nhân
bản, và luật đang có trong database mà không nằm trong file thì giữ nguyên.

## Deploy lên Vercel

### 1. Đẩy code lên Git

```bash
git remote add origin <url-repo-cua-ban>
git push -u origin main
```

### 2. Import vào Vercel

[vercel.com/new](https://vercel.com/new) → chọn repo. Next.js được nhận diện tự động,
không cần chỉnh build command.

### 3. Đặt biến môi trường

**Project Settings → Environment Variables**, đặt cho cả ba môi trường (Production,
Preview, Development):

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain-cua-ban>` |

`NEXT_PUBLIC_SITE_URL` quyết định link trong email xác nhận trỏ về đâu. Đặt sai thì
người dùng bấm link xong bị đưa về `localhost`.

Build sẽ dừng ngay với thông báo rõ ràng nếu thiếu biến — đó là việc của
`npm run check:env`, chạy tự động trước `next build`.

### 4. Khai báo URL với Supabase

**Authentication → URL Configuration**:

- **Site URL**: `https://<domain-cua-ban>`
- **Redirect URLs**: thêm `https://<domain-cua-ban>/auth/callback`

Thiếu bước này thì xác nhận email và đăng nhập sẽ hỏng trên production.

### 5. Kiểm tra sau khi deploy

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
npm run probe:rls
```

Và chạy `supabase/tests/rls_smoke_test.sql` trong SQL Editor của project production —
script tự tạo user thử nghiệm cho cả 4 vai trò rồi `ROLLBACK`, không ghi gì vĩnh viễn.

## Ngoài phạm vi MVP

Xem CLAUDE.md mục 10. Tóm tắt: không có thanh toán (VIP cấp thủ công), chưa làm bài
toán 3D / OCR / barcode / robot guidance, không có tính năng cộng đồng, không có app
mobile riêng.

### Việc còn dở

- **Bảng luật gợi ý** hiện là dữ liệu tạm để engine chạy được ngay. Đội kỹ thuật thay
  bằng bảng đầy đủ qua `/admin/luat-goi-y`, hoặc nhập hàng loạt từ Excel bằng
  `npm run import:rules`.
