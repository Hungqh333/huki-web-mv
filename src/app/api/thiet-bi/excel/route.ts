import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { CATALOG_COLUMNS, parseCodes, type CatalogItem } from '@/lib/catalog/catalog';
import { devCatalog } from '@/lib/catalog/devCatalog';
import { fetchAllRows } from '@/lib/components/fetchAll';
import type { ComponentKind } from '@/lib/components/specs';
import { buildCatalogWorkbook } from '@/lib/export/catalogWorkbook';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/** exceljs cần Node (Buffer, stream) — không chạy được ở Edge. */
export const runtime = 'nodejs';

/**
 * File Excel "Thiết bị đã chọn" của trang Danh mục (chốt 2026-10-27 Q5) — Member trở lên.
 * ?ma=MA1,MA2 (tối đa 200 mã). ?dev=1 chỉ ở máy local: đọc kho mẫu, không cần đăng nhập.
 */
export async function GET(request: NextRequest) {
  const codes = parseCodes(request.nextUrl.searchParams.get('ma'));
  if (!codes.length) return NextResponse.json({ error: 'no codes' }, { status: 400 });

  let items: CatalogItem[];
  if (request.nextUrl.searchParams.get('dev') === '1' && process.env.NODE_ENV !== 'production') {
    items = devCatalog().filter((i) => codes.includes(i.code));
  } else {
    const session = await getSessionContext();
    if (!hasSupabaseEnv() || !canUseSelector(session?.profile?.role ?? null)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const supabase = await createClient();
    // Tối đa 200 mã nên thường chỉ một trang; vẫn đi qua fetchAllRows như mọi chỗ đọc kho.
    const { data, error } = await fetchAllRows((from, to) =>
      supabase.from('components').select(CATALOG_COLUMNS).eq('is_active', true).in('code', codes).order('id').range(from, to)
    );
    if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
    items = (data ?? []) as CatalogItem[];
  }
  // Giữ thứ tự người dùng đã chọn.
  items.sort((a, b) => codes.indexOf(a.code) - codes.indexOf(b.code));

  const t = await getTranslations('catalog');
  const tc = await getTranslations('admin.components');
  const now = new Date();
  const buffer = await buildCatalogWorkbook(
    items,
    {
      kind: (k: ComponentKind) => tc(`kinds.${k}`),
      spec: (key) => (tc.has(`spec.${key}`) ? tc(`spec.${key}`) : key),
      value: (key, v) => (t.has(`values.${key}.${v}`) ? t(`values.${key}.${v}`) : v),
      source: (s) => tc(`sources.${s}`),
      text: (key, values) => t(`excel.${key}`, values),
    },
    now
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="thiet-bi-da-chon-${now.toISOString().slice(0, 10)}.xlsx"`,
      // Có giá và nhà cung cấp — không cho CDN hay proxy lưu lại.
      'Cache-Control': 'private, no-store',
    },
  });
}
