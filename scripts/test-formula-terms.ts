/**
 * Công thức engine không còn chữ tiếng Việt cứng — V1c mục C9 (chốt Q4).
 *
 * Chạy mọi ca golden qua tầng Yêu cầu, lọc thiết bị và tầng Cấu hình trên kho
 * seed thật: công thức chỉ được có số, ký hiệu và thẻ ⟦…⟧; thẻ nào cũng có từ
 * vi/en; bản tiếng Anh sau khi dịch không còn chữ Việt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GOLDEN_CASES } from './golden/cases';
import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { FORMULA_TERMS, renderFormula } from '../src/lib/vision/formulaTerms';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
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
