/**
 * Bộ chọn đèn bản 2 (chốt 2026-10-22, docs/NHAP_CHON_DEN_V2.md): thứ tự xét kiểu đèn (LGT-017…023),
 * ma trận lỗi × bề mặt, màu theo chênh lệch chi tiết – nền (LGT-009…016), cỡ tối thiểu, lọc kho,
 * bảng sửa qua admin, bỏ công thức cho người không phải admin, đủ chữ hai thứ tiếng.
 *
 *   npx tsx --test scripts/test-light-selector.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Component } from '../src/lib/components/specs';
import { DEFAULT_ENGINE_TABLES, parseTableForm, resolveEngineTables } from '../src/lib/vision/engineTables';
import { colorTableFromRows, levelUnder, suggestLightColor, type LightColorInput } from '../src/lib/vision/lightColor';
import { minLightSizeMm } from '../src/lib/vision/lighting';
import { MATRIX_ROW_KEYS, pickLightType, type LightTypeInput } from '../src/lib/vision/lightMatrix';
import { COLORS, LIGHT_MATERIALS, LIGHT_TYPES_V2, MATERIALS, TASK_FEATURES } from '../src/lib/vision/lightOptions';
import { reasonKeyFor, selectLights, withoutFormulas, type LightSelectorInput } from '../src/lib/vision/lightSelector';
import vi from '../src/messages/vi.json';
import en from '../src/messages/en.json';

const TYPE: LightTypeInput = { task: 'inspect', feature: 'scratch', dentDepth: null, backlightable: true, finish: null, shape: null };
const BASE: LightSelectorInput = {
  ...TYPE,
  material: null,
  cameraColor: 'mono',
  featureColor: null,
  backgroundColor: null,
  purpose: null,
  fineDetail: false,
  ambientVaries: false,
  fovWidthMm: 60,
  fovHeightMm: 50,
};
const COLOR: LightColorInput = { cameraColor: 'mono', featureColor: null, backgroundColor: null, purpose: null, fineDetail: false, ambientVaries: false };

const pick = (over: Partial<LightTypeInput>) => {
  const p = pickLightType({ ...TYPE, ...over });
  return p ? `${p.ruleId} ${p.rowKey} ${p.lightType}${p.alternativeType ? `/${p.alternativeType}` : ''}` : null;
};

let nextId = 0;
const light = (spec: Record<string, unknown>, model = `D${nextId}`): Component =>
  ({
    id: `light-${nextId++}`,
    code: model,
    kind: 'light',
    brand: 'Test',
    model,
    spec: { color: 'white', ...spec },
    price_vnd: null,
    datasheet_url: null,
    source: 'manual',
    notes_vi: null,
    notes_en: null,
    is_active: true,
    sort_order: 0,
  }) as unknown as Component;

test('thứ tự xét 6.1–6.5: soi xuyên → trong suốt → bóng phẳng → bóng cong → nhiều bậc', () => {
  assert.equal(pick({ task: 'measure', feature: 'outline' }), 'LGT-017 ovr_silhouette backlight');
  assert.equal(pick({ task: 'measure', feature: 'outline', backlightable: false }), 'LGT-023 t_measure_outline ring/coaxial');
  assert.equal(pick({ task: 'align', feature: 'hole', finish: 'mirror_flat' }), 'LGT-017 ovr_silhouette backlight', 'soi xuyen dung truoc be mat');
  assert.equal(pick({ feature: 'void', finish: 'transparent' }), 'LGT-018 ovr_transparent_inside backlight/darkfield');
  assert.equal(pick({ feature: 'scratch', finish: 'transparent' }), 'LGT-018 ovr_transparent_surface darkfield/backlight');
  assert.equal(pick({ feature: 'void', finish: 'translucent' }), 'LGT-018 ovr_transparent_inside backlight/darkfield');
  assert.equal(pick({ feature: 'scratch', finish: 'translucent' }), 'LGT-022 m_scratch_matte darkfield/bar', 'mo duc, loi tren mat → nhu mo');
  assert.equal(pick({ feature: 'stain', finish: 'mirror_flat' }), 'LGT-019 ovr_mirror_flat coaxial/darkfield');
  assert.equal(pick({ feature: 'scratch', finish: 'mirror_flat' }), 'LGT-019 ovr_mirror_flat_bright darkfield/coaxial');
  assert.equal(pick({ task: 'code', feature: 'dpm', finish: 'mirror_flat' }), 'LGT-019 ovr_mirror_flat coaxial/darkfield');
  assert.equal(pick({ feature: 'dent_bump', finish: 'mirror_curved' }), 'LGT-020 ovr_mirror_curved_dent photometric_stereo/structured_stripe');
  assert.equal(pick({ feature: 'print', finish: 'mirror_curved' }), 'LGT-020 ovr_mirror_curved dome');
  assert.equal(pick({ feature: 'solder', finish: 'semi_gloss', shape: 'stepped' }), 'LGT-021 ovr_stepped dome/multi_angle_ring');
  assert.equal(pick({ task: 'align', feature: 'fiducial', shape: 'stepped' }), 'LGT-021 ovr_stepped_fiducial coaxial/ring');
});

test('ma trận lỗi × bề mặt (LGT-022) và bài toán khác (LGT-023)', () => {
  assert.equal(pick({ feature: 'scratch', finish: 'textured' }), 'LGT-022 m_scratch_textured bar/dome', 'vuong goc huong van');
  assert.equal(pick({ feature: 'dent_bump', dentDepth: 'shallow', finish: 'semi_gloss' }), 'LGT-022 m_dent_shallow_semi_gloss photometric_stereo');
  assert.equal(pick({ feature: 'dent_bump', dentDepth: 'visible' }), 'LGT-022 m_dent_bump_matte bar/photometric_stereo');
  assert.equal(pick({ feature: 'stain', finish: 'semi_gloss' }), 'LGT-022 m_stain_semi_gloss dome/coaxial');
  assert.equal(pick({ task: 'presence', feature: 'raised' }), 'LGT-023 t_presence_raised bar/ring');
  assert.equal(pick({ task: 'code', feature: 'ink_label' }), 'LGT-023 t_code_ink_label ring/bar');
  assert.equal(pick({ task: 'color', feature: 'color_match' }), 'LGT-023 t_color_color_match dome/ring');
  assert.equal(pick({ task: null }), null);
  assert.equal(pick({ feature: null }), null);
  // Mọi tổ hợp bài toán × cần thấy gì × bề mặt × hình dạng đều ra một dòng có thật.
  for (const task of Object.keys(TASK_FEATURES) as (keyof typeof TASK_FEATURES)[])
    for (const feature of TASK_FEATURES[task])
      for (const finish of [null, 'matte', 'semi_gloss', 'mirror_flat', 'mirror_curved', 'textured', 'transparent', 'translucent'] as const)
        for (const shape of [null, 'flat', 'curved', 'stepped'] as const)
          for (const backlightable of [true, false]) {
            const p = pickLightType({ task, feature, dentDepth: 'shallow', backlightable, finish, shape });
            assert.ok(p && MATRIX_ROW_KEYS.includes(p.rowKey), `${task} ${feature} ${finish} ${shape}`);
          }
});

test('cỡ đèn tối thiểu: vòng / vòm / góc thấp / vòng nhiều tầng phủ đường chéo, loại khác phủ cạnh dài', () => {
  assert.deepEqual(minLightSizeMm('multi_angle_ring', 60, 50), { mm: Math.hypot(60, 50), diagonal: true });
  assert.deepEqual(minLightSizeMm('line', 60, 50), { mm: 60, diagonal: false });
  const sel = selectLights({ ...BASE, feature: 'scratch', finish: 'matte' }, []);
  assert.deepEqual(sel.sizes, [
    { lightType: 'darkfield', mm: 78.1, diagonal: true },
    { lightType: 'bar', mm: 60, diagonal: false },
  ]);
});

test('màu: chênh lệch chi tiết – nền theo bảng phản xạ (LGT-010 / LGT-011)', () => {
  assert.equal(levelUnder('red', 'red'), 2);
  assert.equal(levelUnder('red', 'white'), 0.67);
  // Chữ đỏ trên nền xanh lục: đèn đỏ / lục cùng chênh 2, hoà → đỏ trước; đèn trắng chênh 0.
  const redOnGreen = suggestLightColor({ ...COLOR, featureColor: 'red', backgroundColor: 'green' });
  assert.deepEqual([redOnGreen.ruleId, redOnGreen.color, redOnGreen.alternative], ['LGT-010', 'red', 'green']);
  assert.equal(redOnGreen.preview?.rows.find((r) => r.light === 'white')?.contrast, 0);
  const blueOnWhite = suggestLightColor({ ...COLOR, featureColor: 'blue', backgroundColor: 'white' });
  assert.deepEqual([blueOnWhite.color, blueOnWhite.alternative], ['red', 'green'], 'xanh lam toi duoi do / luc, nen trang van sang');
  const same = suggestLightColor({ ...COLOR, featureColor: 'red', backgroundColor: 'red' });
  assert.deepEqual([same.ruleId, same.color, same.checks[0].status], ['LGT-011', 'white', 'warn']);
  const neutral = suggestLightColor({ ...COLOR, featureColor: 'black', backgroundColor: 'white' });
  assert.deepEqual([neutral.ruleId, neutral.color, neutral.alternative], ['LGT-011', 'white', 'red']);
  const noBg = suggestLightColor({ ...COLOR, featureColor: 'yellow' });
  assert.deepEqual([noBg.ruleId, noBg.color, noBg.alternative], ['LGT-010', 'red', 'green']);
  // Camera màu, IR, UV, chi tiết nhỏ — như bản 1.
  assert.equal(suggestLightColor({ ...COLOR, cameraColor: 'color', featureColor: 'red', backgroundColor: 'green' }).ruleId, 'LGT-009');
  assert.equal(suggestLightColor({ ...COLOR, purpose: 'seeThrough' }).color, 'ir');
  assert.equal(suggestLightColor({ ...COLOR, cameraColor: 'color', purpose: 'seeThrough' }).checks.find((c) => c.ruleId === 'LGT-016')?.status, 'fail');
  assert.equal(suggestLightColor({ ...COLOR, purpose: 'fluorescent' }).color, 'uv');
  assert.equal(suggestLightColor({ ...COLOR, fineDetail: true }).color, 'blue');
  assert.equal(suggestLightColor({ ...COLOR, featureColor: 'red', backgroundColor: 'green', ambientVaries: true }).checks.find((c) => c.ruleId === 'LGT-015')?.noteKey, 'ambientBandpass');
  assert.equal(suggestLightColor({ ...COLOR, cameraColor: 'color', ambientVaries: true }).checks.find((c) => c.ruleId === 'LGT-015')?.noteKey, 'ambientWhite');
  assert.equal(suggestLightColor({ ...COLOR, cameraColor: 'color', featureColor: 'red' }).preview, null, 'camera mau khong xem truoc');
});

test('bảng sửa qua admin: dòng hợp lệ áp, dòng lỗi bỏ riêng dòng đó; form mặc định không ghi gì', () => {
  const { tables, overridden, rejected } = resolveEngineTables([
    { table_key: 'lightColor', row_key: 'refl_red', data: { r: 2, g: 1, b: 0 } },
    { table_key: 'lightColor', row_key: 'refl_blue', data: { r: 3, g: 0, b: 2 } },
    { table_key: 'lightColor', row_key: 'see_through', data: { color: 'ir', alternative: 'ir' } },
    { table_key: 'lightMatrix', row_key: 'm_scratch_matte', data: { lightType: 'line', alternativeType: null } },
    { table_key: 'lightMatrix', row_key: 'ovr_stepped', data: { lightType: 'laser' } },
  ]);
  assert.deepEqual(overridden, ['lightColor.refl_red', 'lightMatrix.m_scratch_matte']);
  assert.deepEqual(rejected.map((r) => `${r.row}:${r.code}`), ['refl_blue:outOfRange', 'see_through:sameType', 'ovr_stepped:lightType']);
  assert.equal(pickLightType({ ...TYPE, finish: 'matte' }, tables.lightMatrix)?.lightType, 'line');
  assert.equal(levelUnder('red', 'green', colorTableFromRows(tables.lightColor)), 1);
  for (const table of ['lightColor', 'lightMatrix'] as const) {
    const form = parseTableForm(table, (row, field) => {
      const base = (DEFAULT_ENGINE_TABLES[table] as Record<string, Record<string, unknown>>)[row];
      const v = base[field];
      return v === null || v === undefined ? '' : String(v);
    });
    assert.deepEqual([form.errors.length, form.upserts.length], [0, 0], table);
  }
});

test('lọc kho: đúng kiểu, đúng màu, đủ cỡ; xếp đạt trước, cỡ nhỏ nhất vẫn đủ lên đầu', () => {
  const catalog = [
    light({ light_type: 'darkfield', size_mm: 120 }, 'DF120'),
    light({ light_type: 'darkfield', size_mm: 70 }, 'DF70'),
    light({ light_type: 'bar', size_mm: 90 }, 'BAR90'),
    light({ light_type: 'bar', size_mm: 40 }, 'BAR40'),
    light({ light_type: 'ring', size_mm: 100 }, 'RING'),
    light({ light_type: 'bar', size_mm: 100, color: 'red' }, 'BARRED'),
    light({ light_type: 'bar' }, 'BARNOSIZE'),
  ];
  const sel = selectLights({ ...BASE, feature: 'scratch', finish: 'matte' }, catalog);
  const by = Object.fromEntries(sel.candidates.map((c) => [c.model, c.status]));
  assert.deepEqual(by, { DF120: 'pass', DF70: 'fail', BAR90: 'pass', BAR40: 'fail', RING: 'fail', BARRED: 'fail', BARNOSIZE: 'info' });
  assert.deepEqual(sel.candidates.slice(0, 2).map((c) => c.model), ['DF120', 'BAR90'], 'den chinh (goc thap) truoc');
  assert.deepEqual(sel.stock, { total: 7, typeMatch: 6, colorMatch: 6, both: 5 });
  // Cao su → nhắc LGT-005; đo bằng đèn nền → nhắc telecentric.
  assert.ok(selectLights({ ...BASE, material: 'rubber' }, []).checks.some((c) => c.ruleId === 'LGT-005'));
  assert.ok(selectLights({ ...BASE, task: 'measure', feature: 'outline' }, []).checks.some((c) => c.noteKey === 'measureTelecentric'));
  assert.ok(selectLights({ ...BASE, task: 'measure', feature: 'hole', backlightable: false }, []).checks.some((c) => c.noteKey === 'measureNoBacklight'));
});

test('người không phải admin: server bỏ hết dòng công thức, giữ kết quả', () => {
  const sel = selectLights({ ...BASE, featureColor: 'red', backgroundColor: 'green', ambientVaries: true }, [light({ light_type: 'darkfield', size_mm: 90, color: 'red' })]);
  assert.ok(sel.checks.some((c) => c.formula));
  const hidden = withoutFormulas(sel);
  assert.ok(hidden.checks.every((c) => c.formula === null));
  assert.ok(hidden.candidates.every((c) => c.checks.every((k) => k.formula === null)));
  assert.equal(hidden.candidates[0].status, sel.candidates[0].status);
  assert.deepEqual(hidden.type, sel.type);
  assert.deepEqual(hidden.preview, sel.preview);
  assert.deepEqual(sel.samples, [], 'ham thuan khong doc anh mau');
});

test('vật liệu điền sẵn và chữ hai thứ tiếng đủ cho mọi dòng / lựa chọn', () => {
  assert.equal(LIGHT_MATERIALS.length, 20);
  assert.deepEqual(MATERIALS.rubber, { finish: 'matte', shape: null, color: 'black' });
  assert.deepEqual(MATERIALS.pcb, { finish: 'semi_gloss', shape: 'stepped', color: 'green' });
  const missing: string[] = [];
  for (const [lang, m] of [['vi', vi], ['en', en]] as const) {
    const ls = (m as unknown as { lightSelector: Record<string, Record<string, unknown>> }).lightSelector;
    const has = (group: string, key: string) => typeof ls[group]?.[key] === 'string' || missing.push(`${lang} ${group}.${key}`);
    for (const k of MATRIX_ROW_KEYS) has('reasons', reasonKeyFor(k));
    for (const f of Object.values(TASK_FEATURES).flat()) has('features', f);
    for (const x of LIGHT_MATERIALS) has('materials', x);
    for (const x of COLORS) has('colors13', x);
    for (const x of LIGHT_TYPES_V2) has('types', x);
  }
  assert.deepEqual(missing, []);
});
