import 'server-only';

import { getTranslations } from 'next-intl/server';
import { COLOR_ROW_KEYS, isReflectanceKey } from '@/lib/vision/lightColor';
import { MATRIX_ROW_KEYS } from '@/lib/vision/lightMatrix';

/**
 * Nhãn dòng cho hai bảng của trang Chọn đèn ở admin và sổ tay — ghép từ tên lỗi, bề mặt, bài
 * toán đã có trong messages (lightSelector.*), không nhân bản 80 câu. Chỉ chạy ở máy chủ.
 */
export async function lightRowLabels(): Promise<Record<string, string>> {
  const tl = await getTranslations('lightSelector');
  const ta = await getTranslations('admin.tables');
  const n = (key: string) => tl(key as never);
  const labels: Record<string, string> = {};

  for (const row of COLOR_ROW_KEYS) {
    labels[row] = isReflectanceKey(row) ? n(`colors13.${row.slice('refl_'.length)}`) : ta(`lightColor.rows.${row}` as never);
  }
  for (const row of MATRIX_ROW_KEYS) {
    const m = /^m_(.+)_(matte|semi_gloss|textured)$/.exec(row);
    const t = /^t_(presence|align|measure|code|color)_(.+)$/.exec(row);
    labels[row] = m
      ? `${m[1] === 'dent_shallow' ? n('depths.dentShallowLabel') : n(`features.${m[1]}`)} — ${n(`finishes.${m[2]}`)}`
      : t
        ? `${n(`tasks.${t[1]}`)} — ${n(`features.${t[2]}`)}`
        : ta(`lightMatrix.rows.${row}` as never);
  }
  return labels;
}
