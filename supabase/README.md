# Supabase — cách áp dụng schema

## 1. Tạo project và lấy khoá

Supabase Dashboard → **Project Settings → API**, copy vào `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## 2. Áp dụng migration

**Cách A — SQL Editor (nhanh nhất, không cần cài gì):**
mở Dashboard → SQL Editor → dán toàn bộ `migrations/20260823000001_init_schema.sql` → Run.

**Cách B — Supabase CLI:**

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 3. Nạp dữ liệu tham chiếu

Dán `seed.sql` vào SQL Editor và chạy. File này idempotent, chạy lại nhiều lần không sao.

Nội dung: 3 bài toán MVP (alignment, appearance-inspection, 2d-measurement) và 4 nhóm
cẩm nang. Bảng luật `selector_rules` và bài viết mẫu sẽ được seed ở các bước sau.

## 4. Tạo tài khoản admin đầu tiên

Không có cách nào tự đăng ký thành admin — đúng theo thiết kế. Làm thủ công:

1. Đăng ký bình thường qua `/dang-ky` bằng email của bạn.
2. Vào SQL Editor chạy:

```sql
update public.profiles set role = 'admin' where email = 'hungnv@soragroup.vn';
```

Câu lệnh này chạy được vì trong SQL Editor không có JWT (`auth.uid()` là NULL), nên
trigger `enforce_profile_role_change` cho phép. Cùng câu lệnh đó gọi từ phía client
bằng anon key sẽ bị từ chối.

Gán Member/VIP cho người khác cũng vậy:

```sql
update public.profiles set role = 'member' where email = 'ky-su@congty.com';
```

## 5. Kiểm chứng phân quyền

### Cách nhanh — chạy ngay ở máy local, không cần Docker

```bash
npm run test:db
```

Script dựng một Postgres thật chạy in-process (PGlite, WebAssembly), tạo stub schema
`auth` của Supabase, áp dụng toàn bộ migration, nạp seed hai lần để kiểm tra tính
idempotent, rồi chạy bộ test RLS. Không đụng gì tới database thật.

Chạy cái này TRƯỚC khi dán SQL lên Supabase Dashboard — bắt được lỗi cú pháp và lỗi
logic phân quyền sớm hơn nhiều.

Kiểm tra xem bộ test có thực sự bắt được lỗ hổng không (không phải chạy suông):

```bash
npm run test:db:mutate
```

Script cố tình phá từng luật bảo mật rồi chạy lại bộ test. Mọi mutation đều phải bị
bắt; dòng `BỎ SÓT` nghĩa là bộ test có điểm mù cần bổ sung assert. Chạy lại mỗi khi
sửa policy.

Khác biệt duy nhất giữa SQL chạy ở local và trên Supabase: PGlite không có extension
`pgcrypto` nên dòng `create extension` bị bỏ qua — `gen_random_uuid()` vốn là hàm lõi
từ PostgreSQL 13 nên kết quả không đổi.

### Cách chạy trên database thật

Dán `tests/rls_smoke_test.sql` vào SQL Editor và chạy. Script tự tạo 4 user thử
nghiệm cho 4 vai trò, giả lập JWT của từng người, assert kết quả rồi `ROLLBACK` —
không ghi gì vĩnh viễn vào database.

Chạy xong không có dòng ERROR nào = tất cả luật đúng. Xem chi tiết ở tab **Notices**.

Các điểm được kiểm chứng:

| Vai trò | Bài viết đọc được | selector_rules | selector_history |
|---|---|---|---|
| Guest | chỉ `public` | không có quyền | không |
| Registered | `public` + `registered` | 0 dòng | không ghi được |
| Member | + `member` | đọc được | ghi được |
| VIP | tất cả | đọc được | chỉ của mình |
| Admin | tất cả + bản nháp | đọc/ghi | tất cả |

Ngoài ra script còn kiểm tra hai đường leo thang quyền:

- Đăng ký với `raw_user_meta_data = {"role":"admin"}` → vẫn ra `registered`.
- User tự chạy `update profiles set role='admin'` trên dòng của mình → bị chặn.

## Ghi chú thiết kế

- **`article_previews`** là view chạy với quyền owner (đi vòng qua RLS của `articles`)
  để trang danh sách cẩm nang vẫn hiện được tiêu đề + teaser của bài bị khoá phục vụ
  marketing (CLAUDE.md mục 5). View chỉ để lộ teaser đã cắt 300 ký tự — toàn văn luôn
  phải đọc từ bảng `articles` và bị RLS chặn.
- **`task_types` đọc công khai** để trang giới thiệu bộ chọn thiết bị (dành cho
  Guest/Registered) liệt kê được tên các bài toán. Dữ liệu nhạy cảm nằm ở
  `selector_rules`, bảng này chỉ Member+ đọc được.
- **`articles.category_id`** là khoá ngoại tới `categories` thay vì cột text `category`
  như trong CLAUDE.md mục 7, vì bảng `categories` đã tồn tại trong cùng data model.
