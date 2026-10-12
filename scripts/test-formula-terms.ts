/**
 * Công thức engine không còn chữ tiếng Việt cứng — V1c mục C9 (chốt Q4).
 *
 * Chạy mọi ca golden qua tầng Yêu cầu, lọc thiết bị và tầng Cấu hình trên kho
 * seed thật, CỘNG bộ chọn thiết bị cũ (area + line scan + bảng "Các phép tính"):
 * công thức chỉ được có số, ký hiệu và thẻ ⟦…⟧; thẻ nào cũng có từ vi/en; bản
 * tiếng Anh sau khi dịch không còn chữ Việt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { GOLDEN_CASES } from './golden/cases';
import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { FORMULA_TERMS, renderFormula } from '../src/lib/vision/formulaTerms';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { DEFAULT_APPEARANCE_INPUT, analyseAppearance, type AppearanceInput } from '../src/lib/vision';
import { deriveMetrics } from '../src/lib/selector/derive';
import type { SelectorInput } from '../src/lib/selector/types';
import type { CameraLike } from '../src/lib/vision/types';
import { buildSolutionLevels } from '../src/lib/vision/solutionLevels';

const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const terms = (locale: string) => JSON.parse(readFileSync(`src/messages/${locale}.json`, 'utf8')).selector.vision.formulaTerms as Record<string, string>;

const seed = (() => {
  const sql = readFileSync('supabase/seed_components.sql', 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  return [...sql.matchAll(row)].map(
    (m, i): Component => ({
      id: `s${i}`, code: m[1], kind: m[2] as ComponentKind, brand: m[3], model: m[4], spec: JSON.parse(m[5].replace(/''/g, "'")),
      source: m[6] as Component['source'], price_vnd: null, datasheet_url: null, notes_vi: null, notes_en: null, is_active: true, sort_order: i,
    })
  );
})();

/** Mọi công thức engine sinh ra cho các ca golden: tầng Yêu cầu + mọi thiết bị đạt / bị loại + phương án. */
const formulas = (() => {
  const out = new Set<string>();
  for (const gt of GOLDEN_CASES) {
    const requirement = Object.entries(gt.input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(gt.applicationType));
    const analysis = analyseRequirement(requirement);
    analysis.results.forEach((r) => out.add(r.formula));
    const filter = filterEquipment(analysis, seed);
    const candidates = [...filter.cameras.accepted, ...filter.cameras.excluded, ...filter.lights.accepted, ...filter.lights.excluded, ...filter.pcs.accepted, ...filter.pcs.excluded];
    for (const c of candidates) c.results.forEach((r) => out.add(r.formula));
    for (const camera of filter.cameras.accepted) [...camera.lenses.accepted, ...camera.lenses.excluded].forEach((l) => l.results.forEach((r) => out.add(r.formula)));
    for (const level of buildSolutionLevels(analysis, filter, seed).levels) level.pc?.results.forEach((r) => out.add(r.formula));
  }
  // Bộ chọn cũ: cùng kiểu Check, hiện ở khối kiểm tra và báo cáo PDF cũ.
  const camera: CameraLike = { widthPx: 2592, heightPx: 1944, pixelSizeUm: 3.45, sensorFormat: '2/3', interfaceName: 'GigE' };
  const appearance = (over: Partial<AppearanceInput> = {}): AppearanceInput => ({
    ...DEFAULT_APPEARANCE_INPUT,
    fovWidthMm: 100, fovHeightMm: 75, defectMinSizeMm: 0.2, defectType: 'scratch', surface: 'matte',
    heightToleranceMm: 2, workingDistanceMm: 300, throughputPpm: 60, speedMmS: 100, totalLengthMm: null, fNumber: 5.6,
    ...over,
  });
  const oldScenarios: AppearanceInput[] = [
    appearance(),
    appearance({ captureMode: 'line_scan', encoderResolutionUm: 20, measurementToleranceMm: 0.1 }),
    appearance({ fovWidthMm: 400, fovHeightMm: 300, totalLengthMm: 1000, measurementToleranceMm: 0.05 }),
  ];
  const lineCamera: CameraLike = { ...camera, cameraType: 'line', lineWidthPx: 2048, maxLineRateKhz: 48, pixelSizeUm: 7 };
  for (const input of oldScenarios) {
    const own = input.captureMode === 'line_scan' ? lineCamera : camera;
    for (const section of analyseAppearance(input, own, { imageCircleFormat: '2/3' }).sections) {
      section.checks.forEach((c) => out.add(c.formula));
    }
  }

  // Bảng "Các phép tính" của bộ chọn cũ: nhãn và vế chia nằm GIỮA công thức.
  const selectorInputs: SelectorInput[] = [
    { fov_width_mm: 100, fov_height_mm: 80, defect_min_size_mm: 0.2, working_distance_mm: 300, throughput_ppm: 60 },
    { fov_width_mm: 100, fov_height_mm: 80, tolerance_mm: 0.05, measurement_tolerance_mm: 0.1, throughput_ppm: 30 },
    { fov_width_mm: 80, fov_height_mm: 60, character_height_mm: 2, throughput_ppm: 20 },
    { fov_width_mm: 80, fov_height_mm: 60, module_size_mm: 0.3, measurement_tolerance_mm: 0.2 },
    { fov_width_mm: 120, fov_height_mm: 90, tolerance_mm: 0.1, throughput_ppm: 40 },
  ];
  for (const input of selectorInputs) {
    for (const slug of [null, 'alignment']) {
      deriveMetrics(input, 3, slug).metrics.forEach((m) => out.add(m.formula));
    }
  }
  return [...out];
})();

test('công thức engine chỉ có số, ký hiệu và thẻ — không chữ Việt cứng', () => {
  assert.ok(formulas.length > 50, `chi co ${formulas.length} cong thuc — kich ban qua hep`);
  const leaks = formulas.filter((f) => VIETNAMESE.test(f));
  assert.deepEqual(leaks, []);
  assert.ok(formulas.some((f) => f.includes('⟦')), 'phai co it nhat mot the de test co nghia');
});

test('thẻ nào cũng có từ vi/en; bản tiếng Anh sau khi dịch không còn chữ Việt', () => {
  const vi = terms('vi');
  const en = terms('en');
  for (const key of FORMULA_TERMS) {
    assert.ok(vi[key] && en[key], `thieu tu cho ${key}`);
    assert.doesNotMatch(en[key], VIETNAMESE, key);
  }
  const used = new Set(formulas.flatMap((f) => [...f.matchAll(/⟦(\w+)⟧/g)].map((m) => m[1])));
  for (const key of used) assert.ok((FORMULA_TERMS as readonly string[]).includes(key), `the la ${key}`);
  for (const f of formulas) {
    const english = renderFormula(f, (key) => en[key]);
    assert.doesNotMatch(english, /⟦|⟧/, english);
    assert.doesNotMatch(english, VIETNAMESE, english);
  }
  assert.equal(renderFormula('400 ms vs ⟦takt⟧ 2000 ms', (key) => vi[key]), '400 ms vs nhịp 2000 ms');
  assert.equal(renderFormula('x ⟦unknownTerm⟧', (key) => vi[key]), 'x unknownTerm', 'the la khong nem loi');
});

test('mọi nơi hiển thị công thức đều dịch thẻ (hoặc nhận chữ đã dịch sẵn)', () => {
  // Hai file dưới đây nhận chữ ĐÃ dịch: ConceptReport từ conceptDocument, SelectorReport từ
  // route /api/bao-cao. Thêm nơi hiển thị mới mà quên renderFormula thì test này đỏ.
  const preTranslated = ['src/lib/pdf/concept/ConceptReport.tsx', 'src/lib/pdf/selector/SelectorReport.tsx'];
  // Chỉ quét .tsx (nơi hiển thị). architecture.ts dùng `.formula` làm danh sách kiểu đèn, không phải công thức.
  const files = execSync('git ls-files src', { encoding: 'utf8' }).split('\n').filter((file) => file.endsWith('.tsx'));
  const offenders: string[] = [];
  for (const file of files) {
    if (preTranslated.includes(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (/\{[^}]*\.formula\b[^}]*\}/.test(line) && !line.includes('renderFormula') && !line.includes('formula !==')) {
        offenders.push(`${file}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
  for (const file of preTranslated) assert.ok(readFileSync(file, 'utf8').includes('.formula'), `${file} khong con hien cong thuc — bo khoi danh sach`);
  assert.ok(readFileSync('src/app/api/bao-cao/[historyId]/route.tsx', 'utf8').includes('renderFormula'), 'route bao cao cu phai dich the truoc khi dung PDF');
});
