/**
 * Bảng chiếu sáng + giả định mặc định sửa qua admin — chốt 2026-10-16 (đợt 2).
 *
 * Mặc định phải TRÙNG bảng trong code (golden test chạy với mặc định); dòng lỗi bị
 * bỏ riêng dòng đó; sửa một dòng đổi đúng kết luận / giả định tương ứng; phiên bản
 * bộ luật đổi theo bảng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GOLDEN_CASES } from './golden/cases';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { FIELD_DEFAULTS } from '../src/lib/requirement/defaults';
import { resolveAssumptions } from '../src/lib/requirement/assumptions';
import { RULESET_VERSION } from '../src/lib/vision/bom';
import { DEFAULT_ENGINE_PARAMS, rulesetVersionFor } from '../src/lib/vision/engineParams';
import {
  DEFAULT_ENGINE_TABLES,
  DEFAULT_ROW_DEFS,
  LIGHTING_ROW_KEYS,
  engineTablesFingerprint,
  parseTableForm,
  resolveEngineTables,
  type EngineTables,
} from '../src/lib/vision/engineTables';
import { DEFAULT_LIGHTING_ROWS, suggestLighting } from '../src/lib/vision/lighting';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';

const caseOf = (id: string) => {
  const gt = GOLDEN_CASES.find((c) => c.id === id)!;
  return Object.entries(gt.input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(gt.applicationType));
};
const tablesWith = (rows: { table_key: string; row_key: string; data: unknown }[]): EngineTables => resolveEngineTables(rows).tables;

test('mặc định trùng đúng bảng trong code (lighting.ts, requirement/defaults.ts)', () => {
  for (const key of LIGHTING_ROW_KEYS) {
    const code = DEFAULT_LIGHTING_ROWS[key];
    assert.deepEqual(DEFAULT_ENGINE_TABLES.lighting[key], {
      lightType: code.lightType,
      alternativeType: code.alternativeType ?? null,
      reasonVi: null,
      reasonEn: null,
    }, key);
  }
  for (const def of DEFAULT_ROW_DEFS) {
    assert.equal(DEFAULT_ENGINE_TABLES.defaults[def.key].value, FIELD_DEFAULTS.find((d) => d.path === def.path)!.value, def.key);
  }
  // Mọi giả định mặc định trong code đều sửa được ở trang admin — không sót dòng nào.
  assert.deepEqual(new Set(FIELD_DEFAULTS.map((d) => d.path)), new Set(DEFAULT_ROW_DEFS.map((d) => d.path)));
  assert.equal(engineTablesFingerprint(DEFAULT_ENGINE_TABLES), null);
  assert.equal(rulesetVersionFor(RULESET_VERSION, DEFAULT_ENGINE_PARAMS, DEFAULT_ENGINE_TABLES), RULESET_VERSION);
  // Truyền bảng mặc định cho suggestLighting = không truyền.
  assert.deepEqual(suggestLighting({ defectType: 'print_color', surface: null }, DEFAULT_ENGINE_TABLES.lighting), suggestLighting({ defectType: 'print_color', surface: null }));
});

test('đọc bảng: dòng lạ bỏ qua, dòng lỗi bỏ RIÊNG dòng đó, dòng hợp lệ áp dụng', () => {
  const resolved = resolveEngineTables([
    { table_key: 'lighting', row_key: 'scratch', data: { lightType: 'ring', alternativeType: null } },
    { table_key: 'lighting', row_key: 'glossy_curved', data: { lightType: 'laser' } },
    { table_key: 'lighting', row_key: 'print_color', data: { lightType: 'bar', alternativeType: 'bar' } },
    { table_key: 'defaults', row_key: 'workingDistance', data: { value: 9999 } },
    { table_key: 'defaults', row_key: 'heightVariation', data: { value: 5, basisVi: '  Đo tại máy.  ' } },
    { table_key: 'lighting', row_key: 'khongCo', data: { lightType: 'ring' } },
    { table_key: 'khac', row_key: 'scratch', data: {} },
  ]);
  assert.equal(resolved.tables.lighting.scratch.lightType, 'ring');
  assert.deepEqual(resolved.tables.lighting.glossy_curved, DEFAULT_ENGINE_TABLES.lighting.glossy_curved, 'kieu den la → mac dinh');
  assert.deepEqual(resolved.tables.lighting.print_color, DEFAULT_ENGINE_TABLES.lighting.print_color, 'den thay the trung den chinh → mac dinh');
  assert.equal(resolved.tables.defaults.workingDistance.value, 300, 'ngoai gioi han → mac dinh');
  assert.deepEqual(resolved.tables.defaults.heightVariation, { value: 5, basisVi: 'Đo tại máy.', basisEn: null });
  assert.deepEqual(resolved.rejected.map((r) => `${r.table}.${r.row}:${r.code}`).sort(), [
    'defaults.workingDistance:outOfRange',
    'lighting.glossy_curved:lightType',
    'lighting.print_color:sameType',
  ]);
  assert.equal(resolveEngineTables([]).tables, DEFAULT_ENGINE_TABLES, 'khong sua gi → dung object mac dinh');
});

test('phiên bản bộ luật đổi theo bảng, ổn định, gộp được với ngưỡng', () => {
  const a = tablesWith([{ table_key: 'lighting', row_key: 'scratch', data: { lightType: 'ring' } }]);
  const b = tablesWith([{ table_key: 'lighting', row_key: 'scratch', data: { lightType: 'bar' } }]);
  const va = rulesetVersionFor(RULESET_VERSION, DEFAULT_ENGINE_PARAMS, a);
  assert.match(va, /\+t[0-9a-z]+$/);
  assert.equal(va, rulesetVersionFor(RULESET_VERSION, DEFAULT_ENGINE_PARAMS, a));
  assert.notEqual(va, rulesetVersionFor(RULESET_VERSION, DEFAULT_ENGINE_PARAMS, b));
  assert.match(rulesetVersionFor(RULESET_VERSION, { ...DEFAULT_ENGINE_PARAMS, processMs: 450 }, a), /\+p[0-9a-z]+\+t[0-9a-z]+$/);
});

test('form admin: chỉ ghi dòng khác mặc định, câu trống = mặc định, báo lỗi theo dòng', () => {
  const form: Record<string, string> = {
    scratch__lightType: 'ring', scratch__alternativeType: '', scratch__reasonVi: '', scratch__reasonEn: '',
    print_color__lightType: 'coaxial', print_color__alternativeType: 'bar', print_color__reasonVi: 'Lý do riêng', print_color__reasonEn: '',
  };
  for (const key of LIGHTING_ROW_KEYS) {
    if (form[`${key}__lightType`]) continue;
    form[`${key}__lightType`] = DEFAULT_ENGINE_TABLES.lighting[key].lightType;
    form[`${key}__alternativeType`] = DEFAULT_ENGINE_TABLES.lighting[key].alternativeType ?? '';
  }
  const parsed = parseTableForm('lighting', (row, field) => form[`${row}__${field}`] ?? null);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.upserts.map((u) => u.row).sort(), ['print_color', 'scratch']);
  assert.equal(parsed.deletes.length, LIGHTING_ROW_KEYS.length - 2);

  const bad = parseTableForm('defaults', (row, field) => (row === 'workingDistance' && field === 'value' ? '5' : null));
  assert.deepEqual(bad.errors.map((e) => `${e.row}:${e.code}`), ['workingDistance:outOfRange']);
  const comma = parseTableForm('defaults', (row, field) => (row === 'heightVariation' && field === 'value' ? '2,5' : null));
  assert.deepEqual(comma.upserts, [{ row: 'heightVariation', data: { value: 2.5, basisVi: null, basisEn: null } }]);
});

test('sửa bảng chiếu sáng đổi đúng kết luận LGT; câu lý do riêng đi qua khoá "custom"', () => {
  const s11 = caseOf('S-11'); // bề mặt kim loại → dòng "bề mặt bóng / kim loại"
  const lgt = (tables?: EngineTables) => analyseRequirement(s11, DEFAULT_ENGINE_PARAMS, tables);
  assert.deepEqual(lgt().lighting!.types, ['dome', 'backlight']);
  const tables = tablesWith([
    { table_key: 'lighting', row_key: 'surface_reflective', data: { lightType: 'coaxial', alternativeType: null, reasonVi: 'Mặt kim loại phẳng: đồng trục.', reasonEn: 'Flat metal: coaxial.' } },
  ]);
  const changed = lgt(tables);
  assert.deepEqual(changed.lighting!.types, ['coaxial']);
  const result = changed.results.find((r) => r.key === 'lightingSuggestion')!;
  assert.equal(result.ruleId, 'LGT-001', 'ma luat giu theo dong, khong theo kieu den');
  assert.equal(result.noteKey, 'lightingReason.custom');
  assert.deepEqual(result.noteValues, { textVi: 'Mặt kim loại phẳng: đồng trục.', textEn: 'Flat metal: coaxial.' });
});

test('sửa giả định mặc định đổi đúng giá trị + câu giải thích ở panel Giả định', () => {
  // Bài chưa nêu khoảng cách làm việc → ô đó lấy giả định mặc định.
  const req = [
    ['object.sizeX', 100],
    ['object.sizeY', 100],
    ['detection.0.minSize', 0.4],
  ].reduce((r, [path, value]) => withFieldValue(r, path as string, value), emptyRequirement('AppearanceInspection'));
  const wd = (tables?: EngineTables) =>
    resolveAssumptions(req, DEFAULT_ENGINE_PARAMS, tables).assumptions.find((a) => a.path === 'system.workingDistance');
  const base = wd()!;
  assert.equal(base.value, 300);
  const tables = tablesWith([{ table_key: 'defaults', row_key: 'workingDistance', data: { value: 450, basisVi: 'Theo khung máy chuẩn.' } }]);
  const changed = wd(tables)!;
  assert.equal(changed.value, 450);
  assert.equal(changed.vi, 'Theo khung máy chuẩn.');
  assert.equal(changed.en, 'Theo khung máy chuẩn.', 'thieu cau tieng Anh thi dung cau tieng Viet');
  assert.equal(changed.level, base.level, 'muc canh bao co dinh');
});

test('nhãn trang admin + khoá "custom" đủ vi/en', () => {
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(`src/messages/${locale}.json`, 'utf8'));
    const t = m.admin.tables;
    for (const key of LIGHTING_ROW_KEYS) assert.ok(t.lighting.rows[key], `${locale}: lighting.rows.${key}`);
    for (const def of DEFAULT_ROW_DEFS) assert.ok(t.defaults.rows[def.key], `${locale}: defaults.rows.${def.key}`);
    for (const code of ['fix', 'lightType', 'alternativeType', 'sameType', 'outOfRange', 'choice', 'text', 'saved']) assert.ok(t.errors[code], `${locale}: errors.${code}`);
    assert.ok(m.selector.vision.lightingReason.custom, `${locale}: lightingReason.custom`);
    assert.ok(m.admin.nav.lighting && m.admin.nav.defaults, `${locale}: nav`);
  }
});
