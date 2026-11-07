import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { compareConfigs, type PcConfig, type PcFrame, type PcLine, type PcStatus } from './code';
import { parsePcFrameSpec } from './specSheet';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Dòng pc_frames / pc_configs (migration 20261103000001) → kiểu của trang. */
type FrameRow = {
  id: string; slug: string; tier: string; name_vi: string; name_en: string | null;
  chassis_pn: string; cpu: string; gpu: string; vram_gb: number; psu_w: number; os: string;
  ram_line: PcLine; ssd_line: PcLine; card_slots: number; lan_ports: number; peak_load_w: number;
  use_for_vi: string | null; use_for_en: string | null; not_for_vi: string | null; not_for_en: string | null;
  note_vi: string | null; note_en: string | null; status: PcStatus; sort_order: number; spec: unknown;
};
type ConfigRow = {
  id: string; frame_id: string; short_name: string; ram_gb: number; ssd_gb: number;
  data_kind: 'D' | 'H' | null; data_gb: number | null; data_line: 'I' | 'C' | null; code: string; status: PcStatus;
};

const FRAME_COLUMNS =
  'id, slug, tier, name_vi, name_en, chassis_pn, cpu, gpu, vram_gb, psu_w, os, ram_line, ssd_line, card_slots, lan_ports, peak_load_w, use_for_vi, use_for_en, not_for_vi, not_for_en, note_vi, note_en, status, sort_order, spec';
const CONFIG_COLUMNS = 'id, frame_id, short_name, ram_gb, ssd_gb, data_kind, data_gb, data_line, code, status';

const toFrame = (r: FrameRow): PcFrame => ({
  id: r.id, slug: r.slug, tier: r.tier, nameVi: r.name_vi, nameEn: r.name_en,
  chassisPn: r.chassis_pn, cpu: r.cpu, gpu: r.gpu, vramGb: r.vram_gb, psuW: r.psu_w, os: r.os,
  ramLine: r.ram_line, ssdLine: r.ssd_line, cardSlots: r.card_slots, lanPorts: r.lan_ports, peakLoadW: r.peak_load_w,
  useForVi: r.use_for_vi, useForEn: r.use_for_en, notForVi: r.not_for_vi, notForEn: r.not_for_en,
  noteVi: r.note_vi, noteEn: r.note_en, status: r.status, sortOrder: r.sort_order, spec: parsePcFrameSpec(r.spec),
});
const toConfig = (r: ConfigRow): PcConfig => ({
  id: r.id, frameId: r.frame_id, shortName: r.short_name, ramGb: r.ram_gb, ssdGb: r.ssd_gb,
  dataKind: r.data_kind, dataGb: r.data_gb, dataLine: r.data_line, code: r.code, status: r.status,
});

export type PcCatalog = { frames: PcFrame[]; configs: PcConfig[]; error: boolean };

/** Đọc danh mục bằng client của người xem — RLS: Member+ thấy, còn lại rỗng. */
export async function loadPcCatalog(supabase: Supabase): Promise<PcCatalog> {
  const [frames, configs] = await Promise.all([
    supabase.from('pc_frames').select(FRAME_COLUMNS).order('sort_order').order('created_at'),
    supabase.from('pc_configs').select(CONFIG_COLUMNS),
  ]);
  if (frames.error || configs.error) {
    console.warn('[pc-catalog]', frames.error?.code ?? configs.error?.code, frames.error?.message ?? configs.error?.message);
    return { frames: [], configs: [], error: true };
  }
  return {
    frames: ((frames.data ?? []) as FrameRow[]).map(toFrame),
    configs: ((configs.data ?? []) as ConfigRow[]).map(toConfig).sort(compareConfigs),
    error: false,
  };
}

/** Mã đã từng cấp (kể cả cấu hình Ngừng dùng, mã cũ có '?') — để form báo trùng. Chỉ Admin đọc được. */
export async function loadIssuedCodes(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase.from('pc_issued_codes').select('code');
  return ((data ?? []) as { code: string }[]).map((row) => row.code);
}

export type PcHistoryEntry = {
  id: number;
  table: 'pc_frames' | 'pc_configs';
  action: 'insert' | 'update' | 'delete';
  at: string;
  actor: string | null;
  /** Tên ngắn cấu hình / tên khung để đọc cho dễ. */
  label: string;
  /** Tên khung tiếng Anh (nếu có) — trang tiếng Anh dùng thay label. */
  labelEn: string | null;
  /** Trường đổi: [tên, trước, sau]. Thêm mới → chỉ có "sau". */
  changes: { field: string; before: unknown; after: unknown }[];
};

const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'frame_id', 'slug', 'sort_order']);

/** Lịch sử sửa gần nhất (chỉ Admin đọc được bảng này). */
export async function loadPcHistory(supabase: Supabase, limit = 30): Promise<PcHistoryEntry[]> {
  const { data, error } = await supabase
    .from('pc_change_log')
    .select('id, table_name, row_id, action, actor_id, changed_at, before, after')
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as {
    id: number; table_name: PcHistoryEntry['table']; action: PcHistoryEntry['action']; actor_id: string | null;
    changed_at: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  }[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => id !== null))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', actorIds);
    for (const p of (profiles ?? []) as { id: string; name: string | null; email: string }[]) names.set(p.id, p.name || p.email);
  }

  return rows.map((r) => {
    const after = r.after ?? {};
    const before = r.before ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !HIDDEN_FIELDS.has(k));
    const changes = keys
      .filter((k) => r.action === 'insert' || JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => ({ field: k, before: r.action === 'insert' ? undefined : before[k], after: after[k] }));
    const source = r.after ?? r.before ?? {};
    return {
      id: r.id,
      table: r.table_name,
      action: r.action,
      at: r.changed_at,
      actor: r.actor_id ? (names.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : null,
      label: String(source.short_name ?? source.name_vi ?? ''),
      labelEn: typeof source.short_name === 'string' ? null : typeof source.name_en === 'string' && source.name_en ? source.name_en : null,
      changes: r.action === 'insert' ? changes.filter((c) => c.field === 'code' || c.field === 'name_vi' || c.field === 'chassis_pn') : changes,
    };
  });
}
