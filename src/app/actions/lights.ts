'use server';

import { z } from 'zod';
import { canUseSelector, getSessionContext, isAdmin } from '@/lib/auth';
import type { Component } from '@/lib/components/specs';
import { fetchAllRows } from '@/lib/components/fetchAll';
import { seedCatalog } from '@/lib/devSeedCatalog';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { experimentsForQuery } from '@/lib/lightExperiments';
import { loadSampleRows, withSignedUrls } from '@/lib/lightingSamples';
import { rankSamples } from '@/lib/vision/sampleMatch';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ENGINE_TABLES } from '@/lib/vision/engineTables';
import { ALL_FEATURES, COLORS, DENT_DEPTHS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_PURPOSES, LIGHT_SHAPES, LIGHT_TASKS, TASK_FEATURES } from '@/lib/vision/lightOptions';
import { selectLights, withoutFormulas, type LightSelection, type LightSelectorInput } from '@/lib/vision/lightSelector';

/**
 * Trang Chọn đèn tính trên MÁY CHỦ (chốt 2026-10-22 Q1): trình duyệt chỉ gửi ô nhập, nhận
 * kết quả đã tính. Bảng luật, ngưỡng và cách chọn không bao giờ xuống trình duyệt; dòng
 * công thức chỉ gửi cho admin (bảo vệ công thức, chốt 2026-10-21).
 */

export type LightSelectResponse = { status: 'ok'; selection: LightSelection } | { status: 'denied' | 'invalid' };

const size = z.number().positive().max(100_000).nullable();
const INPUT = z
  .object({
    task: z.enum(LIGHT_TASKS).nullable(),
    feature: z.enum(ALL_FEATURES as [string, ...string[]]).nullable(),
    dentDepth: z.enum(DENT_DEPTHS).nullable(),
    backlightable: z.boolean(),
    material: z.enum(LIGHT_MATERIALS as [string, ...string[]]).nullable(),
    finish: z.enum(LIGHT_FINISHES).nullable(),
    shape: z.enum(LIGHT_SHAPES).nullable(),
    cameraColor: z.enum(['color', 'mono']).nullable(),
    featureColor: z.enum(COLORS).nullable(),
    backgroundColor: z.enum(COLORS).nullable(),
    purpose: z.enum(LIGHT_PURPOSES).nullable(),
    fineDetail: z.boolean(),
    ambientVaries: z.boolean(),
    fovWidthMm: size,
    fovHeightMm: size,
  })
  // "Cần thấy gì" phải thuộc đúng bài toán đang chọn.
  .refine((v) => v.feature === null || (v.task !== null && (TASK_FEATURES[v.task] as readonly string[]).includes(v.feature)));

const parse = (raw: LightSelectorInput) => INPUT.safeParse(raw) as { success: true; data: LightSelectorInput } | { success: false };

export async function selectLightsAction(raw: LightSelectorInput): Promise<LightSelectResponse> {
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  if (!session || !canUseSelector(role)) return { status: 'denied' };
  const parsed = parse(raw);
  if (!parsed.success) return { status: 'invalid' };

  const supabase = await createClient();
  const [{ data }, engine] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('components')
        .select('id, code, kind, brand, model, spec, price_vnd, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
        .eq('is_active', true)
        .eq('kind', 'light')
        .order('sort_order')
        .order('id')
        .range(from, to)
    ),
    loadEngineParams(supabase),
  ]);
  const computed = selectLights(parsed.data, (data ?? []) as Component[], engine.tables);
  // Ảnh mẫu khớp bài toán (chốt 2026-10-23 Q2): trùng "cần thấy gì" trước, rồi theo số nhãn trùng;
  // không có thì ảnh cùng vật liệu + bề mặt ("tham khảo chung"). Chỉ ký link cho ảnh được chọn.
  const locale = await getLocale();
  const query = {
    task: parsed.data.task,
    feature: parsed.data.feature,
    material: parsed.data.material,
    finish: parsed.data.finish,
    shape: parsed.data.shape,
    lightTypes: computed.type ? [computed.type.lightType, ...(computed.type.alternativeType ? [computed.type.alternativeType] : [])] : [],
  };
  // Dự án thực nghiệm (chốt 2026-10-24): cùng cách khớp như ảnh mẫu; chỉ đếm, không đổi gợi ý (Q5).
  const [ranked, experiments] = await Promise.all([
    loadSampleRows(supabase).then((rows) => rankSamples(rows.map((r) => ({ ...r, feature: r.defect_type, lightType: r.light_type })), query)),
    experimentsForQuery(supabase, query),
  ]);
  const signed = await withSignedUrls(supabase, ranked);
  const selection = {
    ...computed,
    experiments,
    samples: signed.map((s) => ({
      id: s.id,
      lightType: s.light_type,
      url: s.url,
      caption: (locale === 'en' ? (s.caption_en ?? s.caption_vi) : (s.caption_vi ?? s.caption_en)) ?? null,
      match: s.match,
      labels: { task: s.task, feature: s.defect_type, material: s.material, finish: s.finish, shape: s.shape, featureColor: s.feature_color, backgroundColor: s.background_color },
      settings: {
        lightColor: s.light_color,
        lightModel: s.light_model,
        angle: s.angle_note,
        distanceMm: s.distance_mm,
        exposureUs: s.exposure_us,
        camera: s.camera,
        lens: s.lens,
      },
      source: s.source,
    })),
  };
  return { status: 'ok', selection: isAdmin(role) ? selection : withoutFormulas(selection) };
}

/** Trang xem trước /dev/chon-den — CHỈ máy local: kho mẫu từ seed, bảng mặc định, không cần đăng nhập. */
export async function selectLightsDevAction(showFormulas: boolean, raw: LightSelectorInput): Promise<LightSelectResponse> {
  if (process.env.NODE_ENV === 'production') return { status: 'denied' };
  const parsed = parse(raw);
  if (!parsed.success) return { status: 'invalid' };
  const selection = selectLights(parsed.data, seedCatalog(), DEFAULT_ENGINE_TABLES);
  return { status: 'ok', selection: showFormulas ? selection : withoutFormulas(selection) };
}
