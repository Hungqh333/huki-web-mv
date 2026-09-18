import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import type { Component, ComponentKind, ComponentSource } from '@/lib/components/specs';
import { RequirementSummary } from '@/components/requirement/RequirementSummary';
import { isApplicationType } from '@/lib/requirement/draft';

/**
 * Catalog mẫu đọc thẳng từ supabase/seed_components.sql — để thử khối Thiết bị
 * phù hợp (V1c C3) mà không cần database. Chỉ đọc các cột đầu của mỗi dòng
 * insert; đủ cho bộ lọc, không dùng cho gì khác.
 */
function seedCatalog(): Component[] {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'seed_components.sql'), 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  const unquote = (value: string) => value.replace(/''/g, "'");
  return [...sql.matchAll(row)].map((match, index) => ({
    id: match[1],
    code: match[1],
    kind: match[2] as ComponentKind,
    brand: unquote(match[3]),
    model: unquote(match[4]),
    spec: JSON.parse(unquote(match[5])) as Record<string, unknown>,
    price_vnd: null,
    datasheet_url: null,
    source: match[6] as ComponentSource,
    notes_vi: null,
    notes_en: null,
    is_active: true,
    sort_order: index,
  }));
}

/**
 * Xem trước bảng tóm tắt yêu cầu — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập.
 *
 * Trang thật /thiet-ke-he-thong/yeu-cau nằm sau cổng Member. Component giống
 * hệt, không đọc database; bản nháp chỉ ở sessionStorage của trình duyệt.
 * Thử: /dev/yeu-cau?app=AppearanceInspection
 */
export default async function DevRequirementPreviewPage({ searchParams }: PageProps<'/dev/yeu-cau'>) {
  // Chặn ở production. Trang này là công cụ phát triển, không phải tính năng.
  if (process.env.NODE_ENV === 'production') notFound();

  const { app } = await searchParams;
  const appParam = Array.isArray(app) ? app[0] : app;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, không đọc database.
      </p>
      <RequirementSummary initialApp={isApplicationType(appParam) ? appParam : null} catalog={seedCatalog()} />
    </section>
  );
}
