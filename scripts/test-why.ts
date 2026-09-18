/**
 * "Vì sao chọn?" — V1c mục C7. Chốt Q1–Q10 ngày 2026-09-18.
 *
 * Ba phần: dữ kiện engine (whyFacts), bộ kiểm số chặn số bịa, lời gọi Gemini
 * bằng client giả. Dữ kiện dựng bằng câu chữ THẬT (messages vi/en).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import { GOLDEN_CASES } from './golden/cases';
import {
  EXPLAINER_FALLBACK_MODEL,
  EXPLAINER_SYSTEM_PROMPT,
  checkExplanation,
  numberAllowed,
  numbersIn,
  runExplainer,
} from '../src/lib/ai/explainerCore';
import type { ParserClient } from '../src/lib/ai/parserCore';
import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import type { ApplicationType } from '../src/lib/visionEntry';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { buildSolutionLevels } from '../src/lib/vision/solutionLevels';
import { buildWhyFacts, whyFactsToText, type WhyTranslate } from '../src/lib/vision/whyFacts';

const messages = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${locale}.json`), 'utf8'));
const missing: string[] = [];
const translator = (locale: 'vi' | 'en'): WhyTranslate => {
  const t = createTranslator({
    locale,
    messages: messages(locale),
    onError: (error) => missing.push(`${locale}: ${error.message}`),
    getMessageFallback: ({ key }) => `!!${key}`,
  });
  return (key, values) => t(key as never, values as never);
};

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, extra: Partial<Component> = {}): Component => ({
  id: `c${++id}`, code: model.toUpperCase(), kind, brand: 'Hãng', model, spec, price_vnd: 12_345_678, datasheet_url: null,
  source: 'datasheet', notes_vi: null, notes_en: null, is_active: true, sort_order: id, lead_time_days: 7, supplier: 'Nhà phân phối Việt', ...extra,
});
const CATALOG: Component[] = [
  make('camera', 'cam', {
    camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
    mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
  }),
  make('lens', 'f20', { lens_type: 'fixed', focal_length_mm: 20, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160 }),
  make('light', 'dome', { light_type: 'dome', color: 'white', size_mm: 100 }),
  make('controller', 'pc', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }),
];

const requirementOf = (type: ApplicationType, input: Record<string, unknown>) =>
  Object.entries(input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(type));
const BASE = requirementOf('AppearanceInspection', {
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'measurement.0.tolerance': 0.5, 'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
});

const factsFor = (requirement: ReturnType<typeof requirementOf>, catalog: Component[], locale: 'vi' | 'en' = 'vi') => {
  const analysis = analyseRequirement(requirement);
  const solutions = buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog);
  return solutions.levels.map((level) => buildWhyFacts({ analysis, level, locale, t: translator(locale) }));
};
const statusLabel = (locale: 'vi' | 'en') => (status: string) => translator(locale)(`selector.vision.status.${status}`);

test('dữ kiện: đủ 5 phần của màn 6 + xếp hạng, số lấy từ engine, không có giá / nhà cung cấp', () => {
  const [economy, recommended, high] = factsFor(BASE, CATALOG);
  assert.equal(economy, null, 'muc khong co phuong an → khong co khoi Vi sao chon');
  assert.equal(high, null);
  assert.ok(recommended);
  assert.deepEqual(recommended.sections.map((s) => s.id), ['requirement', 'camera', 'lens', 'light', 'pc', 'assumptions', 'limits', 'ranking']);
  assert.equal(recommended.title, 'Vì sao chọn phương án Đề xuất?');

  const section = (id: string) => recommended.sections.find((s) => s.id === id)!;
  assert.ok(section('requirement').rows.some((r) => r.ruleId === 'RES-003'), 'luat quyet dinh do phan giai');
  const cameraHead = section('camera').rows[0];
  assert.equal(cameraHead.label, 'Hãng cam');
  assert.match(cameraHead.detail, /2448 × 2048 px → 0\.0483 mm\/px thực, dư 1\.38× so với mục tiêu 0\.06667 mm\/px/);
  assert.ok(section('lens').rows.some((r) => r.ruleId === 'OPT-001' && r.status === 'pass'));
  assert.ok(section('pc').rows.filter((r) => r.ruleId === 'THR-004').length === 3);
  assert.ok(section('assumptions').rows.length > 0 && section('assumptions').rows.every((r) => r.label && r.note));
  assert.ok(section('limits').rows.some((r) => r.ruleId === 'LGT-001'), 'chieu sang be mat bong la rui ro');
  assert.equal(section('ranking').rows[0].detail, '47/100');
  assert.ok(section('ranking').rows.some((r) => r.detail === 'chưa có dữ liệu (trọng số 0.1)'));

  const text = whyFactsToText(recommended, statusLabel('vi'));
  assert.doesNotMatch(text, /12345678|12\.345\.678|Nhà phân phối/, 'chot Q3: khong gui gia / nha cung cap');
  assert.match(text, /\[OPT-001\] \(ĐẠT\)/);
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('dữ kiện tiếng Anh đủ câu chữ', () => {
  const [, recommended] = factsFor(BASE, CATALOG, 'en');
  assert.equal(recommended?.title, 'Why the Recommended solution?');
  assert.ok(!whyFactsToText(recommended!, statusLabel('en')).includes('!!'));
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('GT-002 (dự án thật, nghiêng 30°) trên seed thật: chưa có phương án → không có dữ kiện gửi AI', () => {
  // Mâu thuẫn độ sâu trường ảnh (OPT-005 cần ~F/78, knownGaps của GT-002 — Hưng chốt "để sau")
  // loại mọi ống kính. Khi sửa công thức vòng tròn nhoè, test này đỏ: đổi sang kiểm khối dữ kiện đủ phần.
  const gt = GOLDEN_CASES.find((c) => c.id === 'GT-002')!;
  const sql = readFileSync('supabase/seed_components.sql', 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  const seed = [...sql.matchAll(row)].map((m) => make(m[2] as ComponentKind, m[4], JSON.parse(m[5].replace(/''/g, "'")), { source: m[6] as Component['source'] }));
  assert.ok(seed.length >= 70);
  assert.deepEqual(factsFor(requirementOf(gt.applicationType, gt.input), seed), [null, null, null]);
});

// ─────────────────────────────── Bộ kiểm số ───────────────────────────────

const FACTS = '[RES-003] min(0.06667, 0.3) = 0.06667 mm/px · [OPT-001] 0.0483 mm/px, dư 1.38× · 2448 × 2048 px · [LGT-001] (Cảnh báo) · 65% · F/5.14';

test('bộ kiểm số: khác cách viết cùng một số thì qua', () => {
  assert.deepEqual(numbersIn('OPT-001 cho 0,0483 mm/px'), ['0.0483'], 'so cua ma luat khong tinh');
  assert.ok(numberAllowed('0.060', [0.06]));
  assert.ok(numberAllowed('0.06', [0.06]));
  assert.ok(checkExplanation(['Camera 2448 × 2048 px cho 0,0483 mm/px, dư 1,38× (OPT-001).'], FACTS).ok);
  assert.ok(checkExplanation(['Chiếm 65% ngân sách, khẩu độ tối đa F/5.14 (RES-003).'], FACTS).ok);
});

test('bộ kiểm số: làm tròn bớt số có sẵn thì qua nếu còn ≥ 2 chữ số có nghĩa', () => {
  assert.ok(numberAllowed('0.048', [0.0483]));
  assert.ok(numberAllowed('5.1', [5.14]));
  assert.ok(!numberAllowed('0.05', [0.0483]), '1 chu so co nghia — qua long');
  assert.ok(!numberAllowed('1', [1.38]));
});

test('bộ kiểm số: số mới, phần trăm tự quy đổi, mã luật bịa → bỏ', () => {
  const pct = checkExplanation(['Dư 38% độ phân giải (OPT-001).'], FACTS);
  assert.deepEqual(pct, { ok: false, strayNumbers: ['38'], strayRuleIds: [] });
  const newNumber = checkExplanation(['Camera cần 5 MP.'], FACTS);
  assert.equal(newNumber.ok, false);
  const fakeRule = checkExplanation(['Theo luật (OPT-042) thì đạt.'], FACTS);
  assert.deepEqual(fakeRule, { ok: false, strayNumbers: [], strayRuleIds: ['OPT-042'] });
  assert.equal(checkExplanation(['Thứ nhất, 3 lý do.'], FACTS).ok, false, 'so dem tu them cung bi chan');
});

// ─────────────────────────────── Lời gọi SDK (client giả) ───────────────────────────────

function fakeClient(replies: unknown[]) {
  const calls: GenerateContentParameters[] = [];
  const client: ParserClient = {
    models: {
      generateContent: async (params) => {
        calls.push(params);
        const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
        if (reply instanceof Error) throw reply;
        return reply as GenerateContentResponse;
      },
    },
  };
  return { client, calls };
}
const reply = (paragraphs: unknown, overrides: Record<string, unknown> = {}) => ({
  modelVersion: 'gemini-3.5-flash-lite',
  candidates: [{ finishReason: 'STOP' }],
  text: JSON.stringify({ paragraphs }),
  ...overrides,
});
const apiError = (status: number) => Object.assign(new Error('boom'), { name: 'ApiError', status });

test('lời gọi: system prompt riêng, JSON schema, dữ kiện + ngôn ngữ trong tin nhắn; đoạn văn sạch thì trả về', async () => {
  const { client, calls } = fakeClient([reply(['Camera cho 0,0483 mm/px, dư 1,38× (OPT-001).'])]);
  const outcome = await runExplainer(client, FACTS, 'en');
  assert.deepEqual(outcome, { ok: true, paragraphs: ['Camera cho 0,0483 mm/px, dư 1,38× (OPT-001).'], model: 'gemini-3.5-flash-lite', usage: undefined });
  const config = calls[0].config as Record<string, unknown>;
  assert.equal(config.systemInstruction, EXPLAINER_SYSTEM_PROMPT);
  assert.equal(config.responseMimeType, 'application/json');
  assert.match(String(calls[0].contents), /English[\s\S]*0\.0483/);
});

test('lời gọi: số bịa → bỏ cả đoạn văn, mã lỗi ghi số lạ; không gọi lại', async () => {
  const { client, calls } = fakeClient([reply(['Dư 38% (OPT-001).'])]);
  const outcome = await runExplainer(client, FACTS, 'vi', { fallbackModel: EXPLAINER_FALLBACK_MODEL });
  assert.equal(outcome.ok, false);
  assert.equal(!outcome.ok && outcome.reason, 'stray');
  assert.equal(!outcome.ok && outcome.detail, 'stray 38');
  assert.equal(calls.length, 1);
});

test('lời gọi: 503 nhanh → đọc lại bằng model dự phòng; hết token / JSON hỏng / bị chặn → báo lỗi', async () => {
  const fallback = fakeClient([apiError(503), reply(['Đạt (OPT-001).'])]);
  const outcome = await runExplainer(fallback.client, FACTS, 'vi', { fallbackModel: EXPLAINER_FALLBACK_MODEL });
  assert.equal(outcome.ok, true);
  assert.deepEqual(fallback.calls.map((c) => c.model), ['gemini-3.5-flash-lite', EXPLAINER_FALLBACK_MODEL]);

  const cases: [unknown, string][] = [
    [reply([], { candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'truncated'],
    [reply([], { text: '{"paragraphs": [' }), 'invalid'],
    [reply([]), 'invalid'],
    [reply(['x'], { candidates: [{ finishReason: 'SAFETY' }] }), 'refusal'],
    [apiError(400), 'apiError'],
  ];
  for (const [response, reason] of cases) {
    const result = await runExplainer(fakeClient([response]).client, FACTS, 'vi', { fallbackModel: EXPLAINER_FALLBACK_MODEL });
    assert.equal(!result.ok && result.reason, reason);
  }
});
