/**
 * Kiểm tra biến môi trường trước khi build.
 *
 *   npm run check:env
 *
 * Chạy tự động trong `npm run build`. Mục đích: thiếu biến thì hỏng ngay lúc
 * build với thông báo rõ ràng, thay vì deploy xong mới sập lúc người dùng thật
 * bấm vào trang.
 *
 * Bỏ qua khi chạy `npm run dev` — lúc đó app cố tình vẫn chạy được ở chế độ
 * khách và hiện panel "Chưa cấu hình Supabase".
 */
import { existsSync, readFileSync } from 'node:fs';

/**
 * Next.js tự đọc .env.local, nhưng script chạy bằng `node` thuần thì không.
 * Nạp thủ công khi file tồn tại (máy local). Trên Vercel không có file này —
 * biến đến từ Project Settings → Environment Variables, và các biến đã có sẵn
 * trong process.env luôn được ưu tiên.
 */
function loadEnvLocal(path = '.env.local') {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const REQUIRED = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    check: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v),
    hint: 'Dạng https://<project-ref>.supabase.co (Project Settings → API)',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    check: (v) => v.length > 20,
    hint: 'Anon/publishable key (Project Settings → API). KHÔNG dùng service_role key ở đây.',
  },
];

const OPTIONAL = [
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    check: (v) => /^https?:\/\//.test(v),
    hint: 'URL gốc của site, dùng cho link xác nhận email. Trên Vercel đặt là https://<domain>.',
  },
];

const problems = [];
const warnings = [];

for (const { name, check, hint } of REQUIRED) {
  const value = process.env[name];
  if (!value) problems.push(`  ✗ ${name} — chưa được đặt.\n      ${hint}`);
  else if (!check(value)) problems.push(`  ✗ ${name} — giá trị trông không hợp lệ.\n      ${hint}`);
}

for (const { name, check, hint } of OPTIONAL) {
  const value = process.env[name];
  if (!value) warnings.push(`  ! ${name} chưa đặt — link xác nhận email sẽ trỏ về localhost.\n      ${hint}`);
  else if (!check(value)) warnings.push(`  ! ${name} trông không hợp lệ.\n      ${hint}`);
}

// Bảo vệ: service_role key lọt vào biến NEXT_PUBLIC_ sẽ bị nhúng vào JavaScript
// gửi xuống trình duyệt, đồng nghĩa bỏ qua toàn bộ RLS cho bất kỳ ai xem source.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('NEXT_PUBLIC_') && typeof value === 'string' && value.includes('service_role')) {
    problems.push(`  ✗ ${key} chứa service_role key. Key này bypass toàn bộ RLS và sẽ lộ ra client.`);
  }
}

if (warnings.length > 0) {
  console.warn('Cảnh báo biến môi trường:');
  console.warn(warnings.join('\n'));
}

if (problems.length > 0) {
  console.error('\nThiếu hoặc sai biến môi trường:');
  console.error(problems.join('\n'));
  console.error('\nXem .env.example. Trên Vercel: Project Settings → Environment Variables.\n');
  process.exit(1);
}

console.log('Biến môi trường hợp lệ.');
