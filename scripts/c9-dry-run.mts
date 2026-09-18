/**
 * Chạy thử C9 trọn luồng trên dự án MẪU SOẠN S-11 (V1c mục C9) — ở máy, không đụng production.
 *
 *   npm run dryrun:c9 -- <thư-mục-ra>
 *
 * Mô tả bằng lời → bộ đọc Gemini (nếu có GEMINI_API_KEY) → so với bảng yêu cầu chuẩn
 * S-11 → phân tích → lọc thiết bị → 3 mức → BOM → Concept Report PDF + BOM Excel →
 * khối "Vì sao chọn?" (+ đoạn diễn giải nếu có key). In nhật ký và ghi file ra thư mục.
 *
 * .mts vì @react-pdf chỉ chạy ESM (xem test-export-pdf.mts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { GoogleGenAI } from '@google/genai';
import { createTranslator } from 'next-intl';

import { extractionToFields } from '../src/lib/ai/extraction';
import { runExplainer } from '../src/lib/ai/explainerCore';
import { runParser } from '../src/lib/ai/parserCore';
import { buildBomWorkbook } from '../src/lib/export/bomWorkbook';
import { buildConceptDocument, type Translate } from '../src/lib/export/conceptDocument';
import { ConceptReport } from '../src/lib/pdf/concept/ConceptReport';
import { applyParsedFields, emptyRequirement, readField, withFieldValue } from '../src/lib/requirement/fields';
import { RULESET_VERSION, buildBom } from '../src/lib/vision/bom';
import { emptySelection } from '../src/lib/vision/bomSelection';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { assessFeasibility } from '../src/lib/vision/feasibility';
import { renderFormula } from '../src/lib/vision/formulaTerms';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { buildSolutionLevels } from '../src/lib/vision/solutionLevels';
import { buildWhyFacts, whyFactsToText } from '../src/lib/vision/whyFacts';
import { GOLDEN_CASES } from './golden/cases';
import { SAMPLE_DESCRIPTION, SAMPLE_PROJECT_NAME, sampleCatalog } from './c9/sample';

const outDir = process.argv[2];
if (!outDir) {
  console.error('Cần thư mục ra: npm run dryrun:c9 -- <thư-mục>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const log: string[] = [];
const say = (line = '') => {
  log.push(line);
  console.log(line);
};

function loadEnvLocal(path = '.env.local') {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
  }
}
loadEnvLocal();

const messages = JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', 'vi.json'), 'utf8'));
const tr = createTranslator({ locale: 'vi', messages, getMessageFallback: ({ key }) => `!!${key}` });
const t: Translate = (key, values) => tr(key as never, values as never);

const s11 = GOLDEN_CASES.find((c) => c.id === 'S-11')!;
const reference = Object.entries(s11.input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(s11.applicationType));

// ── 1. Bộ đọc mô tả ──────────────────────────────────────────────────────────
say('== 1. Bộ đọc mô tả (LLM điểm 1) ==');
const client = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } })
  : null;
if (!client) {
  say('Bỏ qua: không có GEMINI_API_KEY.');
} else {
  const outcome = await runParser(client, SAMPLE_DESCRIPTION, { fallbackModel: 'gemini-3.6-flash' });
  if (!outcome.ok) {
    say(`LỖI bộ đọc: ${outcome.reason} ${outcome.detail ?? ''} (${outcome.model})`);
  } else {
    const { applicationType, fields, dropped } = extractionToFields(outcome.extraction, SAMPLE_DESCRIPTION);
    const parsed = applyParsedFields(emptyRequirement(s11.applicationType), fields).requirement;
    say(`Model ${outcome.model} · loại ứng dụng đọc được: ${applicationType ?? '—'} · ${fields.length} ô · bỏ ${dropped.length}`);
    let same = 0;
    for (const [path, expected] of Object.entries(s11.input)) {
      const got = readField(parsed, path)?.value ?? null;
      const ok = JSON.stringify(got) === JSON.stringify(expected);
      if (ok) same++;
      say(`  ${ok ? '✓' : got === null ? '·' : '✗'} ${path}: đọc ${JSON.stringify(got)} · chuẩn ${JSON.stringify(expected)}`);
    }
    say(`Khớp ${same}/${Object.keys(s11.input).length} ô (· = không đọc được, người dùng tự điền; ✗ = đọc SAI).`);
  }
}

// ── 2. Phân tích ─────────────────────────────────────────────────────────────
say('\n== 2. Phân tích kỹ thuật (bảng yêu cầu chuẩn S-11) ==');
const analysis = analyseRequirement(reference);
const feasibility = assessFeasibility(analysis.results);
const formula = (f: string) => renderFormula(f, (key) => t(`selector.vision.formulaTerms.${key}`));
say(`Khả thi: ${feasibility.status} · điểm ${feasibility.overall} · giới hạn: ${feasibility.limitingFactors.join(', ')}`);
say(`mm/px quyết định ${analysis.governingMmPerPx} · ${analysis.megapixelsPerCamera} MP/camera · giả định ${analysis.assumptions.length}`);
for (const r of analysis.results) say(`  ${r.ruleId} ${r.status} ${formula(r.formula)}`);

// ── 3. Thiết bị + 3 mức ──────────────────────────────────────────────────────
say('\n== 3. Lọc thiết bị + ba mức (kho seed thật + giá ƯỚC TÍNH) ==');
const catalog = sampleCatalog();
const filter = filterEquipment(analysis, catalog);
say(`Camera đạt ${filter.cameras.accepted.length} / loại ${filter.cameras.excluded.length} · đèn đạt ${filter.lights.accepted.length} / loại ${filter.lights.excluded.length} · PC đạt ${filter.pcs.accepted.length}`);
for (const cam of filter.cameras.accepted) {
  say(`  ${cam.component.brand} ${cam.component.model}: ống đạt ${cam.lenses.accepted.map((l) => l.component.model).join(', ') || '—'} · chưa kiểm được ${cam.unchecked.length}`);
}
const solutions = buildSolutionLevels(analysis, filter, catalog);
for (const level of solutions.levels) {
  say(
    `  [${level.key}] ${level.status}` +
      (level.camera ? ` · ${level.camera.component.model} + ${level.lens!.component.model} · dư ${level.margin?.toFixed(2)}× · điểm ${level.score?.total} · ${level.cost?.total?.toLocaleString('vi-VN') ?? `thiếu giá ${level.cost?.missingPrices}`} ₫` : '') +
      (level.blockReasons.length ? ` · chặn bởi ${level.blockReasons.map((r) => r.ruleId).join(', ')}` : '') +
      (level.risks.length ? ` · rủi ro ${level.risks.map((r) => r.ruleId).join(', ')}` : '')
  );
}
const chosen = solutions.levels.find((l) => l.key === 'recommended' && l.status === 'ok') ?? solutions.levels.find((l) => l.status === 'ok');
if (!chosen) {
  say('KHÔNG có phương án nào — dừng.');
  writeFileSync(join(outDir, 'nhat-ky-chay-thu-c9.txt'), log.join('\n'));
  process.exit(0);
}
say(`→ Chọn mức ${chosen.key}`);

// ── 4. BOM ───────────────────────────────────────────────────────────────────
say('\n== 4. BOM ==');
const bom = buildBom(analysis, solutions, catalog, emptySelection(chosen.key))!;
for (const line of bom.lines) {
  say(`  ${line.category}/${line.key} · ${line.placeholder ?? `${line.brand} ${line.model}`} × ${line.qty} · ${line.unitPrice?.toLocaleString('vi-VN') ?? '—'} ₫ · ${line.ruleIds.join(', ') || 'thủ công'}${line.unverified ? ' · *chưa kiểm chứng' : ''}`);
}
say(`Tổng: ${bom.total?.toLocaleString('vi-VN') ?? `chưa đủ (thiếu giá ${bom.missingPrices} dòng)`} ₫`);

// ── 5. Xuất file ─────────────────────────────────────────────────────────────
say('\n== 5. Xuất Concept Report PDF + BOM Excel ==');
const doc = buildConceptDocument({
  projectName: SAMPLE_PROJECT_NAME,
  revision: { rev_label: 'A', requirement: reference, bom, rule_version: RULESET_VERSION, locked_at: null, updated_at: new Date().toISOString() },
  author: 'chay-thu-c9',
  now: new Date(),
  formatDate: (date) => date.toISOString().slice(0, 16).replace('T', ' '),
  t,
});
writeFileSync(join(outDir, 'chay-thu-c9-bom.xlsx'), Buffer.from(await buildBomWorkbook(doc, t)));
// Phông như test-export-pdf.mts (route thật đăng ký qua lib/pdf/fonts.ts).
const fontDir = join(process.cwd(), 'assets', 'fonts');
Font.register({
  family: 'BeVietnamPro',
  fonts: [
    { src: join(fontDir, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
    { src: join(fontDir, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
const pdf = await renderToBuffer(React.createElement(ConceptReport, { doc, t }) as never);
writeFileSync(join(outDir, 'chay-thu-c9-concept-report.pdf'), pdf);
say(`Đã ghi chay-thu-c9-bom.xlsx và chay-thu-c9-concept-report.pdf (${Math.round(pdf.length / 1024)} KB)`);
say(`Giả định ${doc.assumptions.length} · cảnh báo ${doc.warnings.length} · kế hoạch xác nhận ${doc.validationPlan.length} mục`);

// ── 6. Vì sao chọn? ──────────────────────────────────────────────────────────
say('\n== 6. Vì sao chọn? ==');
const facts = buildWhyFacts({ analysis, level: chosen, locale: 'vi', t })!;
const factsText = whyFactsToText(facts, (status) => t(`selector.vision.status.${status}`));
writeFileSync(join(outDir, 'chay-thu-c9-vi-sao-chon.txt'), factsText);
say(`Dữ kiện: ${facts.sections.map((s) => `${s.id} ${s.rows.length}`).join(' · ')}`);
if (client) {
  const explained = await runExplainer(client, factsText, 'vi', { fallbackModel: 'gemini-3.6-flash' });
  if (explained.ok) {
    say('Diễn giải (đã qua bộ kiểm số):');
    explained.paragraphs.forEach((p) => say(`  ${p}`));
  } else {
    say(`Diễn giải không dùng được: ${explained.reason} ${explained.detail ?? ''}`);
  }
}

writeFileSync(join(outDir, 'nhat-ky-chay-thu-c9.txt'), log.join('\n'));
say(`\nNhật ký: ${join(outDir, 'nhat-ky-chay-thu-c9.txt')}`);
