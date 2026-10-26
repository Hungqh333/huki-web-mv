'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { dbError } from '@/lib/db-error';
import { fetchAllRows } from '@/lib/components/fetchAll';
import { parseFrontFocalCsv } from '@/lib/components/frontFocalCsv';
import { specNumber } from '@/lib/components/specs';
import { createClient } from '@/lib/supabase/server';
import { frontFocalFromDatasheet } from '@/lib/vision/configurationRules';

/**
 * Nhập sF hàng loạt cho ống kính (chốt 2026-10-26 Q2): đọc file, tìm ống trong kho theo MÃ trước,
 * không có thì theo MODEL (chỉ khi model đó là duy nhất), tính sF rồi ghi vào spec.front_focal_mm.
 * Chỉ Admin; ghi bằng client của chính admin (RLS là chốt chặn thứ hai).
 */

export type FrontFocalImportResult =
  | { error: 'notAdmin' | 'empty' | 'db' }
  | {
      updated: { line: number; key: string; code: string; sF: number }[];
      skipped: { line: number; key: string | null; reason: 'noKey' | 'noValue' | 'badNumber' | 'notFound' | 'ambiguous' | 'noFocal' | 'outOfRange' | 'db' }[];
    };

/** sF ngoài khoảng này gần như chắc chắn là nhập nhầm (vd đơn vị m thay vì mm). */
const SF_LIMIT_MM = 500;

type LensRow = { id: string; code: string; model: string; spec: Record<string, unknown> };

export async function importFrontFocalAction(text: string): Promise<FrontFocalImportResult> {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return { error: 'notAdmin' };
  const { rows, errors } = parseFrontFocalCsv(text);
  if (rows.length === 0 && errors.length === 0) return { error: 'empty' };

  const supabase = await createClient();
  const { data, error } = await fetchAllRows((from, to) =>
    supabase.from('components').select('id, code, model, spec').eq('kind', 'lens').order('id').range(from, to)
  );
  if (error) {
    await dbError(error, 'importFrontFocal:read');
    return { error: 'db' };
  }
  const lenses = (data ?? []) as LensRow[];
  const byCode = new Map(lenses.map((l) => [l.code.toLowerCase(), l]));
  const byModel = new Map<string, LensRow[]>();
  for (const l of lenses) byModel.set(l.model.toLowerCase(), [...(byModel.get(l.model.toLowerCase()) ?? []), l]);

  const updated: Extract<FrontFocalImportResult, { updated: unknown }>['updated'] = [];
  const skipped: Extract<FrontFocalImportResult, { skipped: unknown }>['skipped'] = errors.map((e) => ({ line: e.line, key: e.key, reason: e.reason }));
  for (const row of rows) {
    const key = row.key.toLowerCase();
    const models = byModel.get(key) ?? [];
    const lens = byCode.get(key) ?? (models.length === 1 ? models[0] : null);
    if (!lens) {
      skipped.push({ line: row.line, key: row.key, reason: models.length > 1 ? 'ambiguous' : 'notFound' });
      continue;
    }
    let sF: number | null;
    if (row.source.kind === 'sf') sF = row.source.sF;
    else {
      const focal = specNumber(lens.spec, 'focal_length_mm');
      sF = focal !== null ? frontFocalFromDatasheet(focal, row.source.wdMm, row.source.beta) : null;
      if (sF === null) {
        skipped.push({ line: row.line, key: row.key, reason: 'noFocal' });
        continue;
      }
    }
    if (!(Math.abs(sF) <= SF_LIMIT_MM)) {
      skipped.push({ line: row.line, key: row.key, reason: 'outOfRange' });
      continue;
    }
    const value = Math.round(sF * 100) / 100;
    const { error: updateError } = await supabase.from('components').update({ spec: { ...lens.spec, front_focal_mm: value } }).eq('id', lens.id);
    if (updateError) {
      await dbError(updateError, 'importFrontFocal:update');
      skipped.push({ line: row.line, key: row.key, reason: 'db' });
      continue;
    }
    updated.push({ line: row.line, key: row.key, code: lens.code, sF: value });
  }

  if (updated.length > 0) {
    revalidatePath('/admin/linh-kien');
    revalidatePath('/chon-ong-kinh');
  }
  return { updated, skipped: skipped.sort((a, b) => a.line - b.line) };
}
