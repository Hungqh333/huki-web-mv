/**
 * Dò Row Level Security qua REST API thật của Supabase, với vai KHÁCH.
 *
 *   npm run probe:rls
 *
 * Đây là kiểm tra bỏ qua hoàn toàn giao diện: gọi thẳng endpoint bằng anon key,
 * đúng như một người ngoài có thể làm khi mở DevTools và lấy key ra khỏi mã
 * nguồn trang. Nếu RLS chỉ được cài đặt ở tầng UI thì script này sẽ phát hiện.
 *
 * Không kiểm được vai Member/VIP vì cần token đăng nhập. Phần đó do
 * supabase/tests/rls_smoke_test.sql lo — script SQL đó giả lập JWT của cả bốn
 * vai trò rồi ROLLBACK, chạy trực tiếp trong Supabase SQL Editor.
 */
import { existsSync, readFileSync } from 'node:fs';

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

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BASE || !KEY) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const results = [];

function record(ok, label, detail) {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? 'ok   ' : 'THỦNG'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* không phải JSON */
  }
  return { status: res.status, body };
}

console.log(`Dò RLS với vai khách trên ${BASE}\n`);

console.log('Bảng phải CHẶN hoàn toàn với khách:');
for (const table of ['profiles', 'selector_rules', 'selector_history']) {
  const { status, body } = await get(`${table}?select=*&limit=5`);
  const denied = status === 401 || status === 403;
  const emptied = status === 200 && Array.isArray(body) && body.length === 0;
  record(denied || emptied, table, denied ? `HTTP ${status}, từ chối quyền` : `HTTP ${status}, ${Array.isArray(body) ? body.length : '?'} dòng`);
}

console.log('\nBảng cho khách đọc, nhưng phải lọc theo tier:');
{
  const { status, body } = await get('articles?select=slug,access_tier,content_vi');
  const rows = Array.isArray(body) ? body : [];
  const leaked = rows.filter((r) => r.access_tier !== 'public');
  record(status === 200 && leaked.length === 0, 'articles', `HTTP ${status}, ${rows.length} dòng, ${leaked.length} dòng vượt tier`);
}
{
  const { body } = await get('article_previews?select=*&limit=1');
  const row = Array.isArray(body) ? body[0] : null;
  const hasFullContent = row ? 'content_vi' in row || 'content_en' in row : false;
  record(!hasFullContent, 'article_previews không để lộ cột content', row ? Object.keys(row).join(', ') : 'không có dòng nào');
}

console.log('\nKhách phải KHÔNG ghi được gì:');
for (const [table, payload] of [
  ['articles', { slug: `probe-${Date.now()}`, title_vi: 'x', title_en: 'x', access_tier: 'public' }],
  ['selector_rules', { task_type_id: '00000000-0000-0000-0000-000000000000', condition_json: {} }],
  ['profiles', { id: '00000000-0000-0000-0000-000000000000', email: 'x@y.z', role: 'admin' }],
]) {
  const res = await fetch(`${BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  record(res.status >= 400, `INSERT ${table}`, `HTTP ${res.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `\n${results.length}/${results.length} phép dò đạt. RLS chặn đúng ở tầng API.`
    : `\n${failed.length} phép dò THỦNG — xem các dòng đánh dấu ở trên.`
);
process.exitCode = failed.length === 0 ? 0 : 1;
