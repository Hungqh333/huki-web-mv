/**
 * Đo bộ đọc mô tả trên bộ mẫu (V1a hạng mục 3). GỌI CLAUDE API THẬT — TỐN TIỀN.
 *
 *   npm run eval:parser -- --model claude-opus-5
 *   npm run eval:parser -- --model claude-sonnet-5 --only gt001,thermal
 *   npm run eval:parser -- --model claude-haiku-4-5          (tự bỏ effort)
 *   npm run eval:parser -- --model claude-opus-5 --effort medium
 *
 * Cần ANTHROPIC_API_KEY (đọc từ .env.local hoặc biến môi trường).
 * Ước tính thô: 16 mẫu × ~$0.08 ≈ $1.3 với Opus 5. Số thật in ở cuối.
 *
 * Mẫu ở scripts/eval/parser-samples.ts do Claude soạn — sạch hơn khách viết thật,
 * nên điểm ở đây là cận trên. Chạy cùng đường xử lý với server: runParser →
 * extractionToFields (kiểm đoạn văn gốc, đổi đơn vị).
 */
import { existsSync, readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { extractionToFields } from '../src/lib/ai/extraction';
import { PARSER_MODEL, runParser, type ParserUsage } from '../src/lib/ai/parserCore';
import { PARSER_SAMPLES } from './eval/parser-samples';

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

loadEnvLocal();
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Thiếu ANTHROPIC_API_KEY (.env.local hoặc biến môi trường).');
  process.exit(1);
}

const model = arg('--model') ?? PARSER_MODEL;
const effortArg = arg('--effort');
// Claude Haiku 4.5 không nhận tham số effort.
const effort =
  effortArg === 'none' || (!effortArg && model.startsWith('claude-haiku'))
    ? null
    : ((effortArg ?? 'low') as 'low' | 'medium' | 'high');
const only = arg('--only')?.split(',').map((id) => id.trim());
const samples = only ? PARSER_SAMPLES.filter((sample) => only.includes(sample.id)) : PARSER_SAMPLES;

/** Giá API ($ / 1 triệu token) theo bảng giá hiện hành. Cache đọc ×0,1, cache ghi ×1,25 giá vào. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

function costOf(usage: ParserUsage | undefined, servedBy: string): number {
  const price = PRICES[servedBy] ?? PRICES[model];
  if (!usage || !price) return 0;
  return (
    (usage.inputTokens * price.input +
      usage.cacheWriteTokens * price.input * 1.25 +
      usage.cacheReadTokens * price.input * 0.1 +
      usage.outputTokens * price.output) /
    1_000_000
  );
}

function same(got: unknown, expected: unknown): boolean {
  if (typeof got === 'number' && typeof expected === 'number') {
    return Math.abs(got - expected) <= 1e-6 * Math.max(1, Math.abs(expected));
  }
  if (Array.isArray(got) && Array.isArray(expected)) {
    return got.length === expected.length && [...got].sort().join('|') === [...expected].sort().join('|');
  }
  return got === expected;
}

const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

const client = new Anthropic({ timeout: 60_000, maxRetries: 2 });

console.log(`Đo bộ đọc mô tả: model ${model}, effort ${effort ?? 'không gửi'}, ${samples.length} mẫu\n`);

let expectedTotal = 0;
let correctTotal = 0;
let wrongTotal = 0;
let extraTotal = 0;
let typeHits = 0;
let failures = 0;
let costTotal = 0;
let latencyTotal = 0;

for (const sample of samples) {
  const started = Date.now();
  const outcome = await runParser(client, sample.text, { model, effort });
  const ms = Date.now() - started;
  latencyTotal += ms;
  costTotal += costOf(outcome.usage, outcome.model);

  if (!outcome.ok) {
    failures++;
    expectedTotal += Object.keys(sample.expect).length;
    console.log(`✗ ${sample.id}  THẤT BẠI: ${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ''}  ${ms} ms`);
    continue;
  }

  const result = extractionToFields(outcome.extraction, sample.text);
  const got = new Map(result.fields.map((field) => [field.path, field.value]));
  const lines: string[] = [];

  let correct = 0;
  let wrong = 0;
  let missing = 0;
  for (const [path, expected] of Object.entries(sample.expect)) {
    if (!got.has(path)) {
      missing++;
      lines.push(`    thiếu  ${path}: cần ${show(expected)}`);
    } else if (same(got.get(path), expected)) {
      correct++;
    } else {
      wrong++;
      lines.push(`    sai    ${path}: cần ${show(expected)}, đọc ra ${show(got.get(path))}`);
    }
  }

  let extra = 0;
  for (const [path, value] of got) {
    if (path in sample.expect) continue;
    if (sample.optional && path in sample.optional && same(value, sample.optional[path])) continue;
    extra++;
    lines.push(`    bịa    ${path}: ${show(value)}`);
  }

  const typeOk =
    result.applicationType === sample.applicationType ||
    (result.applicationType !== null && (sample.acceptableTypes ?? []).includes(result.applicationType));
  if (typeOk) typeHits++;
  else lines.push(`    loại   cần ${show(sample.applicationType)}, đọc ra ${show(result.applicationType)}`);

  for (const drop of result.dropped) lines.push(`    bỏ     ${drop.key} (${drop.reason})`);

  expectedTotal += Object.keys(sample.expect).length;
  correctTotal += correct;
  wrongTotal += wrong;
  extraTotal += extra;

  const clean = typeOk && wrong === 0 && missing === 0 && extra === 0;
  console.log(
    `${clean ? '✓' : '✗'} ${sample.id}  đúng ${correct}/${Object.keys(sample.expect).length}  sai ${wrong}  ` +
      `thiếu ${missing}  bịa ${extra}  bỏ ${result.dropped.length}  $${costOf(outcome.usage, outcome.model).toFixed(4)}  ${ms} ms` +
      (outcome.model !== model ? `  (phục vụ bởi ${outcome.model})` : '')
  );
  for (const line of lines) console.log(line);
}

const precisionBase = correctTotal + wrongTotal + extraTotal;
console.log('\n──────── Tổng ────────');
console.log(`Độ phủ (đúng / cần)          : ${correctTotal}/${expectedTotal} = ${((100 * correctTotal) / Math.max(1, expectedTotal)).toFixed(1)}%`);
console.log(
  `Độ chính xác (đúng / đọc ra) : ${correctTotal}/${precisionBase} = ${((100 * correctTotal) / Math.max(1, precisionBase)).toFixed(1)}%`
);
console.log(`Ô sai giá trị / ô bịa        : ${wrongTotal} / ${extraTotal}`);
console.log(`Loại ứng dụng đúng           : ${typeHits}/${samples.length - failures}`);
console.log(`Lượt thất bại                : ${failures}`);
console.log(`Chi phí ước tính             : $${costTotal.toFixed(4)} (≈ $${(costTotal / Math.max(1, samples.length)).toFixed(4)} / mẫu)`);
console.log(`Thời gian trung bình         : ${Math.round(latencyTotal / Math.max(1, samples.length))} ms / mẫu`);
