/**
 * Đo bộ đọc mô tả trên bộ mẫu (V1a hạng mục 3). GỌI GEMINI API THẬT.
 *
 *   npm run eval:parser
 *   npm run eval:parser -- --model gemini-3.6-flash --only gt001,thermal
 *   npm run eval:parser -- --model gemini-3.5-flash-lite --thinking minimal
 *   npm run eval:parser -- --thinking none          (dùng mặc định của model)
 *
 * Cần GEMINI_API_KEY (đọc từ .env.local hoặc biến môi trường). Gói miễn phí không
 * tốn tiền nhưng có hạn mức lượt gọi: gặp lỗi 429 thì script chờ 60 giây rồi thử lại
 * (tối đa 2 lần). Script in số token để so các model.
 *
 * Mẫu ở scripts/eval/parser-samples.ts do Claude soạn — sạch hơn khách viết thật,
 * nên điểm ở đây là cận trên. Chạy cùng đường xử lý với server: runParser →
 * extractionToFields (kiểm đoạn văn gốc, đổi đơn vị).
 */
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
import { extractionToFields } from '../src/lib/ai/extraction';
import { PARSER_MODEL, runParser, type ParserOptions, type ParserOutcome } from '../src/lib/ai/parserCore';
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
if (!process.env.GEMINI_API_KEY) {
  console.error('Thiếu GEMINI_API_KEY (.env.local hoặc biến môi trường).');
  process.exit(1);
}

const model = arg('--model') ?? process.env.GEMINI_MODEL ?? PARSER_MODEL;
const thinkingArg = (arg('--thinking') ?? 'low').toUpperCase();
const thinking = thinkingArg === 'NONE' ? null : (thinkingArg as NonNullable<ParserOptions['thinking']>);
const only = arg('--only')?.split(',').map((id) => id.trim());
const samples = only ? PARSER_SAMPLES.filter((sample) => only.includes(sample.id)) : PARSER_SAMPLES;

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

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
});

async function parseWithQuotaRetry(text: string): Promise<ParserOutcome> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await runParser(client, text, { model, thinking });
    if (outcome.ok || !outcome.detail?.endsWith(' 429') || attempt === 2) return outcome;
    console.log('  … hết hạn mức phút (429), chờ 60 giây rồi thử lại');
    await sleep(60_000);
  }
}

console.log(`Đo bộ đọc mô tả: model ${model}, thinking ${thinking ?? 'mặc định'}, ${samples.length} mẫu\n`);

let expectedTotal = 0;
let correctTotal = 0;
let wrongTotal = 0;
let extraTotal = 0;
let typeHits = 0;
let failures = 0;
let tokensIn = 0;
let tokensOut = 0;
let latencyTotal = 0;

for (const sample of samples) {
  const started = Date.now();
  const outcome = await parseWithQuotaRetry(sample.text);
  const ms = Date.now() - started;
  latencyTotal += ms;
  const tokens = outcome.usage ? `in ${outcome.usage.inputTokens} / out ${outcome.usage.outputTokens + outcome.usage.thinkingTokens}` : 'token ?';
  tokensIn += outcome.usage?.inputTokens ?? 0;
  tokensOut += (outcome.usage?.outputTokens ?? 0) + (outcome.usage?.thinkingTokens ?? 0);

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
      `thiếu ${missing}  bịa ${extra}  bỏ ${result.dropped.length}  ${tokens}  ${ms} ms` +
      (outcome.model !== model ? `  (model ${outcome.model})` : '')
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
console.log(`Token (vào / ra kể cả thinking): ${tokensIn} / ${tokensOut}`);
console.log(`Thời gian trung bình         : ${Math.round(latencyTotal / Math.max(1, samples.length))} ms / mẫu`);
