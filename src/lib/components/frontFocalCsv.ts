/**
 * Đọc file nhập sF hàng loạt cho ống kính (chốt 2026-10-26 Q2). Mỗi dòng là MỘT ống (theo mã hoặc
 * model trong kho) và MỘT trong ba cách cho sF:
 *
 *   sf_mm                         sF có sẵn (Basler ghi "front focal length", số dò từ Hikrobot…)
 *   wd_mm + beta                  một cặp trên datasheet: β ở WD đó → sF = WD − f ÷ β
 *   wd_mm + fov_mm + sensor_mm    vùng nhìn ở WD đó và cạnh cảm biến cùng chiều → β = cảm biến ÷ vùng nhìn
 *
 * Cột nhận tên tiếng Anh hoặc tiếng Việt (ma/code/model, sf_mm/sf, wd_mm/wd, beta, fov_mm/fov,
 * sensor_mm/sensor). Ngăn cách bằng dấu phẩy, hoặc chấm phẩy (khi đó số dùng dấu phẩy thập phân).
 * Tính sF cần tiêu cự của ống — việc đó làm ở server action, sau khi tìm ra ống trong kho.
 */

export type FrontFocalSource = { kind: 'sf'; sF: number } | { kind: 'datasheet'; wdMm: number; beta: number };
export type FrontFocalRow = { line: number; key: string; source: FrontFocalSource };
export type FrontFocalError = { line: number; key: string | null; reason: 'noKey' | 'noValue' | 'badNumber' };

const ALIASES: Record<string, string[]> = {
  key: ['ma', 'mã', 'code', 'model', 'lens', 'ong', 'ống'],
  sf: ['sf_mm', 'sf', 'front_focal_mm'],
  wd: ['wd_mm', 'wd'],
  beta: ['beta', 'β', 'magnification'],
  fov: ['fov_mm', 'fov', 'vung_nhin_mm'],
  sensor: ['sensor_mm', 'sensor', 'cam_bien_mm'],
};

export function parseFrontFocalCsv(text: string): { rows: FrontFocalRow[]; errors: FrontFocalError[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex < 0) return { rows: [], errors: [] };
  const semicolon = lines[headerIndex].includes(';');
  const split = (l: string) => l.split(semicolon ? ';' : ',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[headerIndex]).map((h) => h.toLowerCase());
  const col = (name: string) => header.findIndex((h) => ALIASES[name].includes(h));
  const at = { key: col('key'), sf: col('sf'), wd: col('wd'), beta: col('beta'), fov: col('fov'), sensor: col('sensor') };

  const rows: FrontFocalRow[] = [];
  const errors: FrontFocalError[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const cells = split(lines[i]);
    const line = i + 1;
    const key = at.key >= 0 ? (cells[at.key] ?? '').trim() : '';
    if (!key) {
      errors.push({ line, key: null, reason: 'noKey' });
      continue;
    }
    const raw = (index: number) => (index >= 0 ? (cells[index] ?? '').trim() : '');
    let bad = false;
    const num = (index: number) => {
      const v = raw(index);
      if (v === '') return null;
      const n = Number(semicolon ? v.replace(',', '.') : v);
      if (!Number.isFinite(n)) bad = true;
      return Number.isFinite(n) ? n : null;
    };
    const sF = num(at.sf);
    const wd = num(at.wd);
    const beta = num(at.beta);
    const fov = num(at.fov);
    const sensor = num(at.sensor);
    if (bad) {
      errors.push({ line, key, reason: 'badNumber' });
      continue;
    }
    if (sF !== null) rows.push({ line, key, source: { kind: 'sf', sF } });
    else if (wd !== null && wd > 0 && beta !== null && beta > 0) rows.push({ line, key, source: { kind: 'datasheet', wdMm: wd, beta } });
    else if (wd !== null && wd > 0 && fov !== null && fov > 0 && sensor !== null && sensor > 0)
      rows.push({ line, key, source: { kind: 'datasheet', wdMm: wd, beta: sensor / fov } });
    else errors.push({ line, key, reason: 'noValue' });
  }
  return { rows, errors };
}
