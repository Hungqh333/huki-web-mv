import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Component, ComponentKind, ComponentSource } from '@/lib/components/specs';

/**
 * Catalog mẫu đọc thẳng từ supabase/seed_components.sql — để thử khối Thiết bị
 * phù hợp (V1c C3) mà không cần database. Chỉ đọc các cột đầu của mỗi dòng
 * insert; đủ cho bộ lọc, không dùng cho gì khác.
 */
export function seedCatalog(): Component[] {
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
