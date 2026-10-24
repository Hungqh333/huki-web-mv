import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { chosenTrial, rankExperimentItems, verifiedCounts } from '@/lib/vision/experimentMatch';
import type { LightSelection } from '@/lib/vision/lightSelector';
import type { SampleQuery } from '@/lib/vision/sampleMatch';

/**
 * Thực nghiệm chiếu sáng của phòng Vision (chốt 2026-10-24) — 4 bảng + kho riêng
 * `light-experiments` (migration 20261024000001). Đọc bằng client của NGƯỜI XEM: RLS cho
 * Member+ thấy bản đã công bố, Admin thấy cả bản nháp; người không đủ quyền nhận rỗng.
 */
export const EXPERIMENTS_BUCKET = 'light-experiments';
/** Link ký tên sống 1 giờ — đủ cho một phiên xem trang. */
const SIGNED_URL_SECONDS = 3600;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ExperimentRow = {
  id: string;
  code: string;
  title: string;
  product_name: string | null;
  product_width_mm: number | null;
  product_height_mm: number | null;
  model_count: number | null;
  min_defect_mm: number | null;
  engineer: string | null;
  tested_on: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  feature_color: string | null;
  background_color: string | null;
  conclusion_vi: string | null;
  conclusion_en: string | null;
  product_image_path: string | null;
  report_path: string | null;
  report_name: string | null;
  report_url: string | null;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
};

export type ItemRow = {
  id: string;
  experiment_id: string;
  sort_order: number;
  name_vi: string;
  name_en: string | null;
  requirement: string | null;
  task: string | null;
  feature: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  created_at: string;
};

export type TrialRow = {
  id: string;
  experiment_id: string;
  item_id: string;
  sort_order: number;
  label: string | null;
  is_chosen: boolean;
  light_type: string;
  light_color: string | null;
  light_model: string | null;
  angle_note: string | null;
  distance_mm: number | null;
  backdrop: string | null;
  camera: string | null;
  lens: string | null;
  accessory: string | null;
  capture_ms: number | null;
  process_ms: number | null;
  verdict: 'pass' | 'conditional' | 'fail' | null;
  measured_error_mm: number | null;
  note: string | null;
  ok_samples: number | null;
  ng_samples: number | null;
  tp: number | null;
  tn: number | null;
  fp: number | null;
  fn: number | null;
  created_at: string;
};

export type ImageRow = {
  id: string;
  experiment_id: string;
  trial_id: string;
  kind: 'raw' | 'processed';
  storage_path: string;
  caption_vi: string | null;
  caption_en: string | null;
  sort_order: number;
  created_at: string;
};

const NUMERIC: Record<string, true> = {
  product_width_mm: true,
  product_height_mm: true,
  min_defect_mm: true,
  distance_mm: true,
  capture_ms: true,
  process_ms: true,
  measured_error_mm: true,
};
/** PostgREST trả numeric dạng chuỗi — đổi về số. */
function numbers<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of Object.keys(out)) if (NUMERIC[key] && out[key] !== null && out[key] !== undefined) out[key] = Number(out[key]);
  return out as T;
}

export type ExperimentTree = {
  experiments: ExperimentRow[];
  items: ItemRow[];
  trials: TrialRow[];
  images: ImageRow[];
};

/** Mọi lần thực nghiệm người xem được thấy (hoặc một lần, theo `id`) kèm hạng mục, phương án, ảnh. Lỗi đọc → rỗng. */
export async function loadExperimentTree(supabase: Supabase, opts: { id?: string; withImages?: boolean } = {}): Promise<ExperimentTree> {
  let expQ = supabase.from('light_experiments').select('*');
  let itemQ = supabase.from('light_experiment_items').select('*');
  let trialQ = supabase.from('light_experiment_trials').select('*');
  let imageQ = supabase.from('light_experiment_images').select('*');
  if (opts.id) {
    expQ = expQ.eq('id', opts.id);
    itemQ = itemQ.eq('experiment_id', opts.id);
    trialQ = trialQ.eq('experiment_id', opts.id);
    imageQ = imageQ.eq('experiment_id', opts.id);
  }
  const [exp, items, trials, images] = await Promise.all([
    expQ.order('tested_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    itemQ.order('sort_order').order('created_at'),
    trialQ.order('sort_order').order('created_at'),
    opts.withImages === false ? Promise.resolve({ data: [], error: null }) : imageQ.order('sort_order').order('created_at'),
  ]);
  const failed = [exp, items, trials, images].find((r) => r.error);
  if (failed?.error) {
    console.warn('[light-experiments]', failed.error.code, failed.error.message);
    return { experiments: [], items: [], trials: [], images: [] };
  }
  return {
    experiments: ((exp.data ?? []) as ExperimentRow[]).map(numbers),
    items: (items.data ?? []) as ItemRow[],
    trials: ((trials.data ?? []) as TrialRow[]).map(numbers),
    images: (images.data ?? []) as ImageRow[],
  };
}

/** Link ký tên cho các đường dẫn trong kho thực nghiệm; file không ký được (đã xoá) thì vắng mặt. */
export async function signExperimentPaths(supabase: Supabase, paths: readonly (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.storage.from(EXPERIMENTS_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  const urls = new Map<string, string>();
  for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  return urls;
}

/** Tải báo cáo về đúng tên gốc thay vì tên mã ngẫu nhiên trong kho. */
export async function signReport(supabase: Supabase, path: string, name: string | null): Promise<string | null> {
  const { data } = await supabase.storage.from(EXPERIMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, name ? { download: name } : undefined);
  return data?.signedUrl ?? null;
}

/**
 * Dự án thực nghiệm khớp bài toán cho trang Chọn đèn (chốt 2026-10-24): huy hiệu cho kiểu đèn
 * gợi ý / thay thế và số dự án có hạng mục trùng "cần thấy gì" (hiện trên nút mở trang riêng).
 * Kiểu đèn của hạng mục = phương án được chọn.
 */
export async function experimentsForQuery(supabase: Supabase, q: SampleQuery): Promise<LightSelection['experiments']> {
  if (!q.feature) return { verified: [], matched: 0 };
  const tree = await loadExperimentTree(supabase, { withImages: false });
  const expOf = new Map(tree.experiments.map((e) => [e.id, e]));
  const labelled = tree.items.flatMap((item) => {
    const exp = expOf.get(item.experiment_id);
    const chosen = chosenTrial(tree.trials.filter((t) => t.item_id === item.id));
    if (!exp || !chosen) return [];
    return [
      {
        experimentId: exp.id,
        task: item.task,
        feature: item.feature,
        material: item.material ?? exp.material,
        finish: item.finish ?? exp.finish,
        shape: item.shape ?? exp.shape,
        lightType: chosen.light_type,
        verdict: chosen.verdict,
      },
    ];
  });
  const exact = rankExperimentItems(labelled, q).filter((i) => i.match.kind === 'exact');
  return {
    verified: q.lightTypes.map((lightType) => ({ lightType, ...verifiedCounts(exact, lightType) })),
    matched: new Set(exact.map((i) => i.experimentId)).size,
  };
}
