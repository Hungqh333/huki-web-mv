import 'server-only';

import { seedCatalog } from '@/lib/devSeedCatalog';
import type { CatalogItem } from './catalog';

/**
 * Kho cho trang xem trước /dev/thiet-bi (chỉ máy local): seed_components.sql, 3 món đầu
 * mỗi loại đánh dấu ★ MẪU để thử chế độ "Thường dùng". Không phải kho thật.
 */
export function devCatalog(): CatalogItem[] {
  const perKind = new Map<string, number>();
  return seedCatalog().map((c) => {
    const n = (perKind.get(c.kind) ?? 0) + 1;
    perKind.set(c.kind, n);
    return { ...c, lead_time_days: null, supplier: null, used_in_projects: 0, is_common: n <= 3 };
  });
}
