import { COLORS, LIGHT_COLORS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_SHAPES, LIGHT_TASKS, LIGHT_TYPES_V2, TASK_FEATURES } from './lightOptions';

/**
 * Đọc file nhãn ảnh mẫu (CSV, cột như docs/tham-khao-hang/anh-tham-khao.csv) cho trang admin nhập
 * hàng loạt (chốt 2026-10-23 Q4). Kiểm từng khoá theo trang Chọn đèn — dòng sai báo lỗi, không đoán.
 * Cột: file, nguon, task, feature, material, finish, shape, feature_color, background_color, light_type,
 *      light_color, light_model, goc_chieu, khoang_cach_mm, phoi_sang_us, camera, ong_kinh, ghi_chu
 */

export type SampleCsvRow = {
  /** Tên file ảnh (bỏ thư mục) — khớp với file người dùng chọn tải lên. */
  file: string;
  task: string | null;
  feature: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  featureColor: string | null;
  backgroundColor: string | null;
  lightType: string;
  lightColor: string | null;
  lightModel: string | null;
  angleNote: string | null;
  distanceMm: number | null;
  exposureUs: number | null;
  camera: string | null;
  lens: string | null;
  source: string | null;
  caption: string | null;
};

export type SampleCsvError = { line: number; field: string };

/** Tách một dòng CSV: hỗ trợ ô có dấu phẩy đặt trong ngoặc kép và "" là dấu ngoặc kép. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const ENUMS: Record<string, readonly string[]> = {
  task: LIGHT_TASKS,
  material: LIGHT_MATERIALS,
  finish: LIGHT_FINISHES,
  shape: LIGHT_SHAPES,
  feature_color: COLORS,
  background_color: COLORS,
  light_type: LIGHT_TYPES_V2,
  light_color: LIGHT_COLORS,
};

export function parseSampleCsv(text: string): { rows: SampleCsvRow[]; errors: SampleCsvError[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const head = splitLine(lines[0] ?? '').map((h) => h.toLowerCase());
  const rows: SampleCsvRow[] = [];
  const errors: SampleCsvError[] = [];
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (raw.trim() === '') return;
    const cells = splitLine(raw);
    const get = (k: string) => {
      const v = cells[head.indexOf(k)];
      return v === undefined || v === '' ? null : v;
    };
    const bad = (field: string) => errors.push({ line, field });
    const before = errors.length;

    const file = get('file')?.split(/[\\/]/).pop() ?? null;
    if (!file) bad('file');
    for (const [k, list] of Object.entries(ENUMS)) {
      const v = get(k);
      if ((v !== null && !list.includes(v)) || (k === 'light_type' && v === null)) bad(k);
    }
    // "Cần thấy gì" phải thuộc bài toán; không ghi bài toán thì lấy bài toán đầu tiên có mục đó.
    let task = get('task');
    const feature = get('feature');
    if (feature !== null) {
      const owners = LIGHT_TASKS.filter((t) => (TASK_FEATURES[t] as readonly string[]).includes(feature));
      if (owners.length === 0 || (task !== null && !owners.includes(task as never))) bad('feature');
      else task ??= owners[0];
    }
    const num = (k: string) => {
      const v = get(k);
      if (v === null) return null;
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) {
        bad(k);
        return null;
      }
      return n;
    };
    const distanceMm = num('khoang_cach_mm');
    const exposureUs = num('phoi_sang_us');
    if (errors.length > before) return;

    rows.push({
      file: file!,
      task,
      feature,
      material: get('material'),
      finish: get('finish'),
      shape: get('shape'),
      featureColor: get('feature_color'),
      backgroundColor: get('background_color'),
      lightType: get('light_type')!,
      lightColor: get('light_color'),
      lightModel: get('light_model'),
      angleNote: get('goc_chieu'),
      distanceMm,
      exposureUs,
      camera: get('camera'),
      lens: get('ong_kinh'),
      source: get('nguon'),
      caption: get('ghi_chu'),
    });
  });
  return { rows, errors };
}
