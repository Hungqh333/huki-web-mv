import 'server-only';

import { getTranslations } from 'next-intl/server';
import { COLORS, LIGHT_COLORS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_SHAPES, LIGHT_TASKS, LIGHT_TYPES_V2, TASK_FEATURES } from '@/lib/vision/lightOptions';

export type Option = { value: string; label: string };

/**
 * Nhãn các lựa chọn của trang Chọn đèn cho trang máy chủ (admin thực nghiệm, trang xem thực
 * nghiệm) — lấy từ messages lightSelector.*, không gõ lại.
 */
export async function lightOptionLabels() {
  const tl = await getTranslations('lightSelector');
  const n = (key: string) => tl(key as never);
  const list = (keys: readonly string[], prefix: string): Option[] => keys.map((v) => ({ value: v, label: n(`${prefix}.${v}`) }));
  return {
    // "Cần thấy gì" theo từng bài toán — giá trị `bài toán:mục` (một mục có thể thuộc nhiều bài toán).
    targets: LIGHT_TASKS.flatMap((task) => TASK_FEATURES[task].map((f) => ({ value: `${task}:${f}`, label: `${n(`tasks.${task}`)} — ${n(`features.${f}`)}` }))),
    lights: list(LIGHT_TYPES_V2, 'types'),
    materials: list(LIGHT_MATERIALS, 'materials'),
    finishes: list(LIGHT_FINISHES, 'finishes'),
    shapes: list(LIGHT_SHAPES, 'shapes'),
    colors: list(COLORS, 'colors13'),
    lightColors: list(LIGHT_COLORS, 'colors'),
  };
}
export type LightOptionLabels = Awaited<ReturnType<typeof lightOptionLabels>>;

export const labelOf = (options: readonly Option[], value: string | null) => (value ? (options.find((o) => o.value === value)?.label ?? value) : null);
