/**
 * Đọc và kiểm tra bảng luật gợi ý thiết bị từ file Excel / CSV.
 *
 * Tách riêng khỏi script chạy lệnh để test được.
 */
import ExcelJS from 'exceljs';
import { validateCondition } from '../../src/lib/selector/conditions';
import { DERIVED_FIELD_KEYS } from '../../src/lib/selector/derivedKeys';
import { FIELD_CATALOG } from '../../src/lib/selector/fields';

export const COLUMNS = [
  'code',
  'task_slug',
  'priority',
  'condition_json',
  'recommended_camera',
  'recommended_lighting',
  'recommended_lens',
  'ai_or_rule_based',
  'notes_vi',
  'notes_en',
  'is_active',
] as const;

export type ColumnName = (typeof COLUMNS)[number];

const APPROACHES = ['rule_based', 'hybrid', 'deep_learning'];

export type RawRow = Partial<Record<ColumnName, string>> & { __row: number };

export type ParsedRule = {
  row: number;
  code: string;
  task_slug: string;
  priority: number;
  condition_json: unknown;
  recommended_camera: string | null;
  recommended_lighting: string | null;
  recommended_lens: string | null;
  ai_or_rule_based: string;
  notes_vi: string | null;
  notes_en: string | null;
  is_active: boolean;
};

export type Problem = { row: number; column: string; message: string };

/** Bài toán nào có sẵn, và mỗi bài dùng những trường nào. */
export type TaskContext = Map<string, Set<string>>;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Ô công thức: lấy kết quả. Ô rich text: nối các đoạn lại.
    if ('result' in value && value.result !== undefined) return String(value.result).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    return '';
  }
  return String(value).trim();
}

export async function readRows(filePath: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();

  if (filePath.toLowerCase().endsWith('.csv')) {
    // ExcelJS đọc CSV theo UTF-8 nên tiếng Việt không bị hỏng như khi tự tách chuỗi.
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('File không có sheet nào.');

  const headerRow = sheet.getRow(1);
  const headerToIndex = new Map<string, number>();
  headerRow.eachCell((cell, index) => {
    const name = cellText(cell.value).toLowerCase().replace(/\s+/g, '_');
    if (name) headerToIndex.set(name, index);
  });

  const missing = COLUMNS.filter((column) => !headerToIndex.has(column));
  if (missing.length > 0) {
    throw new Error(
      `Thiếu cột: ${missing.join(', ')}.\n` +
        `Dòng đầu tiên phải là tiêu đề cột. Chạy "npm run import:rules:template" để lấy file mẫu.`
    );
  }

  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const entry = { __row: rowNumber } as RawRow;
    let hasContent = false;
    for (const column of COLUMNS) {
      const text = cellText(row.getCell(headerToIndex.get(column)!).value);
      entry[column] = text;
      if (text !== '') hasContent = true;
    }

    if (hasContent) rows.push(entry);
  });

  return rows;
}

export function parseRules(
  rows: RawRow[],
  tasks: TaskContext | null
): { rules: ParsedRule[]; problems: Problem[] } {
  const problems: Problem[] = [];
  const rules: ParsedRule[] = [];
  const seenCodes = new Map<string, number>();

  const knownFields = new Set<string>([...Object.keys(FIELD_CATALOG), ...DERIVED_FIELD_KEYS]);

  for (const row of rows) {
    const at = (column: string, message: string) =>
      problems.push({ row: row.__row, column, message });

    const code = (row.code ?? '').trim();
    if (!code) at('code', 'Không được để trống.');
    else if (!/^[A-Z0-9][A-Z0-9-]*$/i.test(code))
      at('code', 'Chỉ dùng chữ, số và dấu gạch ngang.');
    else if (seenCodes.has(code))
      at('code', `Trùng với dòng ${seenCodes.get(code)} trong cùng file.`);
    else seenCodes.set(code, row.__row);

    const taskSlug = (row.task_slug ?? '').trim();
    if (!taskSlug) at('task_slug', 'Không được để trống.');
    else if (tasks && !tasks.has(taskSlug))
      at('task_slug', `Không có bài toán "${taskSlug}". Hiện có: ${[...tasks.keys()].join(', ')}`);

    const priorityText = (row.priority ?? '').trim();
    const priority = priorityText === '' ? 100 : Number(priorityText);
    if (!Number.isInteger(priority) || priority < 0)
      at('priority', 'Phải là số nguyên không âm. Số nhỏ = ưu tiên cao.');

    const approach = ((row.ai_or_rule_based ?? '').trim() || 'rule_based').toLowerCase();
    if (!APPROACHES.includes(approach))
      at('ai_or_rule_based', `Phải là một trong: ${APPROACHES.join(', ')}.`);

    const conditionText = (row.condition_json ?? '').trim() || '{}';
    let condition: unknown = {};
    let conditionOk = true;
    try {
      condition = JSON.parse(conditionText);
    } catch {
      conditionOk = false;
      at('condition_json', 'JSON sai cú pháp.');
    }

    if (conditionOk) {
      for (const message of validateCondition(condition)) {
        at('condition_json', message);
      }

      const predicates = (condition as { all?: { field?: unknown }[] } | null)?.all ?? [];
      for (const predicate of predicates) {
        const field = typeof predicate?.field === 'string' ? predicate.field : null;
        if (!field) continue;

        if (!knownFields.has(field)) {
          at('condition_json', `Trường "${field}" không có trong catalog — luật sẽ không bao giờ khớp.`);
          continue;
        }

        const isDerived = (DERIVED_FIELD_KEYS as readonly string[]).includes(field);
        const taskFields = tasks?.get(taskSlug);
        if (!isDerived && taskFields && !taskFields.has(field)) {
          at(
            'condition_json',
            `Bài toán "${taskSlug}" không có trường "${field}" — luật sẽ không bao giờ khớp.`
          );
        }
      }
    }

    const activeText = (row.is_active ?? '').trim().toLowerCase();
    const isActive = !['false', '0', 'no', 'khong', 'không'].includes(activeText);

    const optional = (value: string | undefined) => {
      const text = (value ?? '').trim();
      return text === '' ? null : text;
    };

    rules.push({
      row: row.__row,
      code,
      task_slug: taskSlug,
      priority: Number.isFinite(priority) ? priority : 100,
      condition_json: condition,
      recommended_camera: optional(row.recommended_camera),
      recommended_lighting: optional(row.recommended_lighting),
      recommended_lens: optional(row.recommended_lens),
      ai_or_rule_based: approach,
      notes_vi: optional(row.notes_vi),
      notes_en: optional(row.notes_en),
      is_active: isActive,
    });
  }

  return { rules, problems };
}

const sqlText = (value: string | null) =>
  value === null ? 'null' : `'${value.replace(/'/g, "''")}'`;

export function toSql(rules: ParsedRule[]): string {
  const values = rules
    .map((rule) => {
      const condition = JSON.stringify(rule.condition_json).replace(/'/g, "''");
      return `(${sqlText(rule.code)},
 (select id from public.task_types where slug = ${sqlText(rule.task_slug)}),
 '${condition}'::jsonb,
 ${sqlText(rule.recommended_camera)},
 ${sqlText(rule.recommended_lighting)},
 ${sqlText(rule.recommended_lens)},
 '${rule.ai_or_rule_based}',
 ${sqlText(rule.notes_vi)},
 ${sqlText(rule.notes_en)},
 ${rule.priority},
 ${rule.is_active})`;
    })
    .join(',\n\n');

  return `-- =============================================================================
-- Bảng luật gợi ý thiết bị — sinh tự động từ file Excel.
-- Sinh lúc: ${new Date().toISOString()}
-- Số luật: ${rules.length}
--
-- Idempotent theo cột code: chạy lại sẽ cập nhật luật cũ, không nhân bản.
-- Luật đang có trong database mà KHÔNG nằm trong file này sẽ được giữ nguyên.
-- =============================================================================

insert into public.selector_rules
  (code, task_type_id, condition_json, recommended_camera, recommended_lighting,
   recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority, is_active)
values

${values}

on conflict (code) where code is not null do update set
  task_type_id         = excluded.task_type_id,
  condition_json       = excluded.condition_json,
  recommended_camera   = excluded.recommended_camera,
  recommended_lighting = excluded.recommended_lighting,
  recommended_lens     = excluded.recommended_lens,
  ai_or_rule_based     = excluded.ai_or_rule_based,
  notes_vi             = excluded.notes_vi,
  notes_en             = excluded.notes_en,
  priority             = excluded.priority,
  is_active            = excluded.is_active;
`;
}
