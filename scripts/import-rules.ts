/**
 * Chuyển bảng luật từ file Excel / CSV thành SQL.
 *
 *   npm run import:rules -- duong-dan/bang-luat.xlsx
 *   npm run import:rules -- bang-luat.xlsx --out luat.sql
 *
 * Kiểm tra từng dòng trước khi sinh SQL: mã trùng, bài toán không tồn tại,
 * JSON sai cú pháp, và quan trọng nhất — điều kiện tham chiếu tới trường không
 * có trong bài toán đó. Lỗi cuối cùng nguy hiểm nhất vì luật vẫn lưu được vào
 * database nhưng không bao giờ khớp, không có thông báo nào cả.
 *
 * Danh sách bài toán và trường của từng bài đọc từ Supabase thật (bảng
 * task_types cho phép đọc công khai), nên phản ánh cả những bài toán đội kỹ
 * thuật thêm qua trang quản trị.
 *
 * Lấy file mẫu: npm run import:rules:template
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseRules, readRows, toSql, type TaskContext } from './lib/rules-io';

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

async function fetchTasks(): Promise<TaskContext | null> {
  loadEnvLocal();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  try {
    const res = await fetch(`${base}/rest/v1/task_types?select=slug,input_fields`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;

    const rows = (await res.json()) as { slug: string; input_fields: unknown }[];
    const map: TaskContext = new Map();
    for (const row of rows) {
      map.set(row.slug, new Set(Array.isArray(row.input_fields) ? (row.input_fields as string[]) : []));
    }
    return map;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((arg) => !arg.startsWith('--'));

  if (!filePath) {
    console.error('Thiếu đường dẫn file.\n');
    console.error('  npm run import:rules -- bang-luat.xlsx');
    console.error('  npm run import:rules -- bang-luat.xlsx --out luat.sql\n');
    console.error('Chưa có file mẫu? Chạy: npm run import:rules:template');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Không tìm thấy file: ${filePath}`);
    process.exit(1);
  }

  const outIndex = args.indexOf('--out');
  const outPath = outIndex !== -1 ? args[outIndex + 1] : null;

  const tasks = await fetchTasks();
  console.log(
    tasks
      ? `Đọc được ${tasks.size} bài toán từ Supabase: ${[...tasks.keys()].join(', ')}\n`
      : 'Không kết nối được Supabase — bỏ qua bước kiểm tra tên bài toán và tên trường.\n'
  );

  const rows = await readRows(filePath);
  console.log(`Đọc ${rows.length} dòng từ ${filePath}\n`);

  const { rules, problems } = parseRules(rows, tasks);

  if (problems.length > 0) {
    console.error(`Tìm thấy ${problems.length} lỗi:\n`);
    for (const problem of problems) {
      console.error(`  Dòng ${problem.row}, cột "${problem.column}": ${problem.message}`);
    }
    console.error('\nKhông sinh SQL. Sửa file rồi chạy lại.');
    process.exit(1);
  }

  const sql = toSql(rules);
  const target = outPath ?? filePath.replace(/\.(xlsx|csv)$/i, '') + '.sql';
  writeFileSync(target, sql, 'utf8');

  const byTask = new Map<string, number>();
  for (const rule of rules) byTask.set(rule.task_slug, (byTask.get(rule.task_slug) ?? 0) + 1);

  console.log(`${rules.length} luật hợp lệ:`);
  for (const [slug, count] of [...byTask].sort()) {
    console.log(`  ${slug.padEnd(24)} ${count} luật`);
  }

  console.log(`\nĐã ghi SQL: ${target}`);
  console.log('\nÁp dụng: mở Supabase → SQL Editor → dán nội dung file → Run.');
  console.log('Copy đúng cách trên Windows (đừng dùng clip từ Git Bash):');
  console.log(`  Get-Content -Raw -Encoding UTF8 "${target}" | Set-Clipboard`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
