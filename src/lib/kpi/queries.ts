import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_KPI_CONFIG,
  type KpiConfig,
  type Modifier,
  type ProblemType,
  type TighteningFactor,
} from './types';

export type KpiData = {
  problemTypes: ProblemType[];
  modifiers: Modifier[];
  config: KpiConfig;
  tighteningFactors: TighteningFactor[];
};

const PROBLEM_COLUMNS =
  'id, slug, problem_group, level, name_vi, name_en, miss_min, miss_max, ' +
  'false_reject_week1_min, false_reject_week1_max, false_reject_min, false_reject_max, ' +
  'recheck_min, recheck_max, total_burden_max, ramp_up_weeks_min, ramp_up_weeks_max, ' +
  'deep_learning, special_kpi, note_vi, note_en, data_source';

/**
 * Đọc toàn bộ dữ liệu của bộ tính chỉ tiêu.
 *
 * RLS chỉ trả về cho Member trở lên — đây là dữ liệu thương mại nhạy cảm, nó
 * nói lên công ty cam kết được tới đâu. Không đủ quyền thì các mảng trả về rỗng
 * và trang sẽ hiện thông báo tương ứng.
 */
export async function getKpiData(): Promise<KpiData> {
  const supabase = await createClient();

  const [problems, modifiers, config, tightening] = await Promise.all([
    supabase.from('kpi_problem_types').select(PROBLEM_COLUMNS).eq('is_active', true).order('sort_order'),
    supabase
      .from('kpi_modifiers')
      .select('id, slug, name_vi, name_en, factor_min, factor_max, direction, data_source')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('kpi_config').select('key, value'),
    supabase
      .from('kpi_tightening_factors')
      .select('miss_ratio, burden_k, label_vi, label_en')
      .order('sort_order'),
  ]);

  // Cột numeric của Postgres về JS dưới dạng chuỗi qua PostgREST ở một số kiểu —
  // ép số ở đây để phần tính toán không phải phòng thủ ở mọi chỗ.
  const num = (value: unknown) => (typeof value === 'number' ? value : Number(value));

  // Danh sách cột truyền dạng chuỗi nên supabase-js không suy ra được kiểu —
  // ép qua unknown rồi tự chuẩn hoá bên dưới.
  const problemRows = (problems.data ?? []) as unknown as Record<string, unknown>[];
  const modifierRows = (modifiers.data ?? []) as unknown as Record<string, unknown>[];
  const tighteningRows = (tightening.data ?? []) as unknown as Record<string, unknown>[];
  const configRows = (config.data ?? []) as unknown as { key: string; value: unknown }[];

  const problemTypes = problemRows.map((row) => {
    const r = row;
    return {
      ...r,
      level: num(r.level),
      miss_min: num(r.miss_min),
      miss_max: num(r.miss_max),
      false_reject_week1_min: num(r.false_reject_week1_min),
      false_reject_week1_max: num(r.false_reject_week1_max),
      false_reject_min: num(r.false_reject_min),
      false_reject_max: num(r.false_reject_max),
      recheck_min: num(r.recheck_min),
      recheck_max: num(r.recheck_max),
      total_burden_max: num(r.total_burden_max),
      ramp_up_weeks_min: num(r.ramp_up_weeks_min),
      ramp_up_weeks_max: num(r.ramp_up_weeks_max),
    } as ProblemType;
  });

  const modifierList = modifierRows.map(
    (r) => ({ ...r, factor_min: num(r.factor_min), factor_max: num(r.factor_max) }) as Modifier
  );

  // Thiếu khoá nào thì lấy mặc định — trang vẫn chạy khi ai đó lỡ xoá một dòng.
  const resolved: KpiConfig = { ...DEFAULT_KPI_CONFIG };
  for (const row of configRows) {
    const key = row.key as keyof KpiConfig;
    if (key in resolved) resolved[key] = num(row.value);
  }

  const tighteningFactors = tighteningRows.map(
    (r) => ({ ...r, miss_ratio: num(r.miss_ratio), burden_k: num(r.burden_k) }) as TighteningFactor
  );

  return { problemTypes, modifiers: modifierList, config: resolved, tighteningFactors };
}
