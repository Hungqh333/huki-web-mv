/**
 * Chạy THẬT bộ diễn giải "Vì sao chọn?" (V1c C7) trên một phương án mẫu, để đo
 * model có giữ đúng luật "không tạo số mới" không trước khi đổi model / prompt.
 *
 *   npm run eval:explainer -- [--rounds 3] [--model gemini-3.6-flash]
 *
 * Cần GEMINI_API_KEY (đọc từ .env.local hoặc biến môi trường). Mỗi vòng gọi 2
 * lượt (vi + en). In đoạn văn, lý do lỗi và số lạ nếu bộ kiểm số chặn.
 * Dữ kiện là thiết bị giả — không gửi dữ liệu dự án thật nào lên API.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { createTranslator } from 'next-intl';
import { EXPLAINER_MODEL, runExplainer } from '../src/lib/ai/explainerCore';
import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { buildSolutionLevels } from '../src/lib/vision/solutionLevels';
import { buildWhyFacts, whyFactsToText } from '../src/lib/vision/whyFacts';

function loadEnvLocal(path = '.env.local') {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>): Component => ({
  id: `c${++id}`, code: model.toUpperCase(), kind, brand: 'Mẫu', model, spec, price_vnd: 1_000_000, datasheet_url: null,
  source: 'datasheet', notes_vi: null, notes_en: null, is_active: true, sort_order: id, lead_time_days: 7, supplier: null,
});
const CATALOG = [
  make('camera', 'CAM-5MP', {
    camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
    mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
  }),
  make('lens', 'LENS-20', { lens_type: 'fixed', focal_length_mm: 20, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160 }),
  make('light', 'DOME-100', { light_type: 'dome', color: 'white', size_mm: 100 }),
  make('controller', 'IPC-8', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }),
];
const REQUIREMENT = Object.entries({
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'measurement.0.tolerance': 0.5, 'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
}).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'));

function factsText(locale: 'vi' | 'en'): string {
  const messages = JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${locale}.json`), 'utf8'));
  const tr = createTranslator({ locale, messages });
  const t = (key: string, values?: Record<string, string | number>) => tr(key as never, values as never);
  const analysis = analyseRequirement(REQUIREMENT);
  const solutions = buildSolutionLevels(analysis, filterEquipment(analysis, CATALOG), CATALOG);
  const level = solutions.levels.find((l) => l.status === 'ok');
  if (!level) throw new Error('Phương án mẫu không dựng được — kiểm lại fixture.');
  const facts = buildWhyFacts({ analysis, level, locale, t })!;
  return whyFactsToText(facts, (status) => t(`selector.vision.status.${status}`));
}

async function main() {
  loadEnvLocal();
  if (!process.env.GEMINI_API_KEY) {
    console.error('Thiếu GEMINI_API_KEY (.env.local hoặc biến môi trường).');
    process.exit(1);
  }
  const rounds = Number(arg('--rounds') ?? 3);
  const model = arg('--model') ?? process.env.GEMINI_MODEL ?? EXPLAINER_MODEL;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } });

  const tally = { ok: 0, stray: 0, other: 0 };
  for (let round = 1; round <= rounds; round++) {
    for (const locale of ['vi', 'en'] as const) {
      const outcome = await runExplainer(client, factsText(locale), locale, { model });
      console.log(`\n── vòng ${round} · ${locale} · ${outcome.model} ──`);
      if (outcome.ok) {
        tally.ok++;
        outcome.paragraphs.forEach((p) => console.log(p));
      } else {
        tally[outcome.reason === 'stray' ? 'stray' : 'other']++;
        console.log(`LỖI ${outcome.reason} ${outcome.detail ?? ''}`);
      }
      if (outcome.usage) console.log(`tokens: vào ${outcome.usage.inputTokens} · ra ${outcome.usage.outputTokens} · nghĩ ${outcome.usage.thinkingTokens}`);
    }
  }
  console.log(`\nTổng: ${tally.ok} đạt · ${tally.stray} bị chặn vì số lạ · ${tally.other} lỗi khác`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
