'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { dbError } from '@/lib/db-error';
import { loadIssuedCodes } from '@/lib/pc/catalog';
import {
  PC_DATA_DRIVE_CODES,
  PC_GPUS,
  PC_OS,
  PC_TIERS,
  composePcCode,
  parseDataDrive,
  pcCodeErrors,
  type PcCodeError,
  type PcFrameKey,
} from '@/lib/pc/code';
import { PC_SPEC_KEYS, parsePcFrameSpec } from '@/lib/pc/specSheet';
import { createClient } from '@/lib/supabase/server';

/**
 * PC Vision — thêm / sửa khung và cấu hình. Chỉ Admin (chốt 2026-11-03 Q3).
 *
 * Ba lớp kiểm: (1) form hiện lỗi ngay, (2) action chạy lại pcCodeErrors + zod, (3) CSDL:
 * RLS, CHECK regex, trigger ghép mã / khoá trường tạo mã / chống cấp lại mã. Action không
 * gửi mã xuống CSDL — trigger tự ghép.
 */

const PAGE = '/cong-cu-may-tinh';

export type PcActionError = PcCodeError | 'locked' | 'frameNew' | 'notAllowed' | 'invalid' | 'db';
export type PcActionResult = { ok: true; code?: string } | { ok: false; errors: PcActionError[]; message?: string };

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => (v ? v : null));

const frameKeySchema = z.object({
  chassisPn: text(60).transform((v) => v.toUpperCase()),
  cpu: text(20).transform((v) => v.toUpperCase()),
  gpu: z.enum(PC_GPUS),
  vramGb: z.number().int().min(0).max(99),
  psuW: z.number().int().min(100).max(9999),
  os: z.enum(PC_OS),
  ramLine: z.enum(['I', 'C']),
  ssdLine: z.enum(['I', 'C']),
});

const frameInfoSchema = z.object({
  tier: z.enum(PC_TIERS),
  nameVi: text(80).min(1),
  nameEn: optionalText(80),
  cardSlots: z.number().int().min(0).max(12),
  lanPorts: z.number().int().min(0).max(12),
  peakLoadW: z.number().int().min(0).max(9999),
  useForVi: optionalText(300),
  useForEn: optionalText(300),
  notForVi: optionalText(300),
  notForEn: optionalText(300),
});

const addSchema = z.object({
  frame: frameKeySchema,
  config: z.object({
    shortName: text(20).min(1),
    ramGb: z.number().int().min(1).max(999),
    ssdGb: z.number().int().min(100).max(99 * 1024),
    dataDrive: z.enum(PC_DATA_DRIVE_CODES).nullable(),
    dataLine: z.enum(['I', 'C']).nullable(),
  }),
  /** Chỉ có khi phần khung chưa khớp khung nào. */
  newFrame: frameInfoSchema.nullable(),
});

async function adminClient() {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return null;
  return createClient();
}

/** Lỗi Postgres → mã lỗi form. Trigger khoá dùng 55000, chống cấp lại mã dùng 23505. */
async function fromDb(error: { code?: string; message: string }, where: string): Promise<PcActionResult> {
  if (error.code === '23505') return { ok: false, errors: ['duplicate'] };
  if (error.code === '55000') return { ok: false, errors: ['locked'] };
  if (error.code === '42501') return { ok: false, errors: ['notAllowed'] };
  if (error.message?.includes('pc_frame_new_required')) return { ok: false, errors: ['frameNew'] };
  return { ok: false, errors: ['db'], message: await dbError(error, where) };
}

export async function addPcConfigAction(input: unknown): Promise<PcActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, errors: ['notAllowed'] };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ['invalid'] };
  const { frame, config, newFrame } = parsed.data;

  const drive = parseDataDrive(config.dataDrive);
  const parts = {
    ramGb: config.ramGb,
    ssdGb: config.ssdGb,
    dataKind: drive?.kind ?? null,
    dataGb: drive?.gb ?? null,
    dataLine: drive ? (config.dataLine ?? 'C') : null,
  };
  const key: PcFrameKey = frame;

  const errors = pcCodeErrors(key, parts, await loadIssuedCodes(supabase));
  if (errors.length > 0) return { ok: false, errors };

  const { data, error } = await supabase.rpc('pc_add_config', {
    frame: {
      chassis_pn: key.chassisPn, cpu: key.cpu, gpu: key.gpu, vram_gb: key.vramGb, psu_w: key.psuW, os: key.os,
      ram_line: key.ramLine, ssd_line: key.ssdLine,
      ...(newFrame
        ? {
            tier: newFrame.tier, name_vi: newFrame.nameVi, name_en: newFrame.nameEn,
            card_slots: newFrame.cardSlots, lan_ports: newFrame.lanPorts, peak_load_w: newFrame.peakLoadW,
            use_for_vi: newFrame.useForVi, use_for_en: newFrame.useForEn,
            not_for_vi: newFrame.notForVi, not_for_en: newFrame.notForEn,
          }
        : {}),
    },
    config: {
      short_name: config.shortName, ram_gb: parts.ramGb, ssd_gb: parts.ssdGb,
      data_kind: parts.dataKind, data_gb: parts.dataGb, data_line: parts.dataLine,
    },
  });
  if (error) return fromDb(error, 'addPcConfig');

  // CSDL là nguồn sự thật; lệch với bản ghép ở đây nghĩa là hai bên đã khác quy tắc.
  const expected = composePcCode(key, parts);
  if (data !== expected) console.error('[pc-vision] ma CSDL khac ma TS', { db: data, ts: expected });

  revalidatePath(PAGE);
  return { ok: true, code: String(data) };
}

const updateConfigSchema = z.object({
  id: z.uuid(),
  shortName: text(20).min(1),
  status: z.enum(['active', 'retired']),
});

/** Q9: chỉ đổi được tên ngắn và trạng thái — RAM / SSD / ổ dữ liệu đã khoá theo mã. */
export async function updatePcConfigAction(input: unknown): Promise<PcActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, errors: ['notAllowed'] };
  const parsed = updateConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ['invalid'] };

  const { error } = await supabase
    .from('pc_configs')
    .update({ short_name: parsed.data.shortName, status: parsed.data.status })
    .eq('id', parsed.data.id);
  if (error) return fromDb(error, 'updatePcConfig');
  revalidatePath(PAGE);
  return { ok: true };
}

const updateFrameSchema = frameInfoSchema.extend({
  id: z.uuid(),
  noteVi: optionalText(300),
  noteEn: optionalText(300),
  status: z.enum(['active', 'retired']),
  /** Chỉ đổi được khi khung đang là '?' (CSDL chặn mọi trường hợp khác). */
  ramLine: z.enum(['I', 'C', '?']),
  ssdLine: z.enum(['I', 'C', '?']),
  /** Chữ cố định cho list thiết bị (form PC gốc) — khoá trong PC_SPEC_KEYS, ô trống thì bỏ. */
  spec: z.record(z.enum(PC_SPEC_KEYS), z.string().max(600)).optional(),
});

export async function updatePcFrameAction(input: unknown): Promise<PcActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, errors: ['notAllowed'] };
  const parsed = updateFrameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ['invalid'] };
  const f = parsed.data;

  const { error } = await supabase
    .from('pc_frames')
    .update({
      tier: f.tier, name_vi: f.nameVi, name_en: f.nameEn, card_slots: f.cardSlots, lan_ports: f.lanPorts,
      peak_load_w: f.peakLoadW, use_for_vi: f.useForVi, use_for_en: f.useForEn, not_for_vi: f.notForVi,
      not_for_en: f.notForEn, note_vi: f.noteVi, note_en: f.noteEn, status: f.status,
      ram_line: f.ramLine, ssd_line: f.ssdLine,
      ...(f.spec ? { spec: parsePcFrameSpec(f.spec) } : {}),
    })
    .eq('id', f.id);
  if (error) return fromDb(error, 'updatePcFrame');
  revalidatePath(PAGE);
  return { ok: true };
}
