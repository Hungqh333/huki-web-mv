'use server';

import { z } from 'zod';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { loadPcCatalog } from '@/lib/pc/catalog';
import { readPcSeed } from '@/lib/pc/devSeed';
import { PC_INTERFACE_KEYS, PC_RESOLUTION_KEYS } from '@/lib/pc/options';
import { suggestPc, type PcSuggestInput, type PcSuggestResult } from '@/lib/pc/suggest';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';

/**
 * Tab Gợi ý cấu hình của PC Vision tính trên MÁY CHỦ, cùng cách trang Chọn đèn: trình duyệt chỉ
 * gửi ô nhập, nhận kết quả. Công thức và ngưỡng không xuống trình duyệt. Chỉ tính để xem, không lưu.
 */

export type PcSuggestResponse = { status: 'ok'; result: PcSuggestResult } | { status: 'denied' | 'invalid' | 'failed' };

const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const format = z.enum(['raw', 'png', 'jpeg']);
const INPUT = z.object({
  cameras: z
    .array(
      z.object({
        resolution: z.enum(PC_RESOLUTION_KEYS as [string, ...string[]]),
        bit: z.union([z.literal(8), z.literal(10), z.literal(12), z.literal(16)]),
        color: z.boolean(),
        poe: z.boolean(),
        fps: num(0, 100_000),
        iface: z.enum(PC_INTERFACE_KEYS),
        inspectPerSec: num(0, 100_000),
      })
    )
    .max(64),
  ai: z.enum(['none', 'inference', 'training']),
  line247: z.boolean(),
  storage: z
    .object({
      hoursPerDay: num(0, 24),
      ngPercent: num(0, 100),
      ngDays: num(0, 3650),
      ngFormat: format,
      okDays: num(0, 3650),
      okEveryN: num(1, 1_000_000),
      okFormat: format,
    })
    .nullable(),
});

const parse = (raw: unknown) => INPUT.safeParse(raw) as { success: true; data: PcSuggestInput } | { success: false };

export async function suggestPcAction(raw: unknown): Promise<PcSuggestResponse> {
  const session = await getSessionContext();
  if (!session || !canUseSelector(session.profile?.role)) return { status: 'denied' };
  const parsed = parse(raw);
  if (!parsed.success) return { status: 'invalid' };

  const supabase = await createClient();
  const [catalog, engine] = await Promise.all([loadPcCatalog(supabase), loadEngineParams(supabase)]);
  if (catalog.error) return { status: 'failed' };
  return { status: 'ok', result: suggestPc(parsed.data, catalog.frames, catalog.configs, engine.params) };
}

/** Trang xem trước /dev/pc-vision — CHỈ máy local: danh mục từ seed_pc.sql, ngưỡng mặc định. */
export async function suggestPcDevAction(raw: unknown): Promise<PcSuggestResponse> {
  if (process.env.NODE_ENV === 'production') return { status: 'denied' };
  const parsed = parse(raw);
  if (!parsed.success) return { status: 'invalid' };
  const { frames, configs } = readPcSeed();
  return { status: 'ok', result: suggestPc(parsed.data, frames, configs, DEFAULT_ENGINE_PARAMS) };
}
