/**
 * Bộ diễn giải "Vì sao chọn?" — LLM điểm 2 (spec V1.1 §1), V1c mục C7.
 *
 * Nhận dữ kiện ĐÃ tính (lib/vision/whyFacts, dạng chữ), trả 1–4 đoạn văn. Không
 * tạo số mới: mọi con số và mã luật trong đoạn văn phải có sẵn trong dữ kiện,
 * có số lạ thì bỏ cả đoạn văn (chốt Q5) — không gọi lại, không tự sửa.
 *
 * Nhận client từ ngoài như parserCore: server (explainer.ts) truyền client thật,
 * unit test truyền client giả. File này không đọc biến môi trường.
 */
import { z } from 'zod';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { PARSER_FALLBACK_MODEL, PARSER_MODEL, type ParserClient, type ParserUsage } from './parserCore';

export const EXPLAINER_MODEL = PARSER_MODEL;
export const EXPLAINER_FALLBACK_MODEL = PARSER_FALLBACK_MODEL;

export const EXPLANATION_PARAGRAPHS_MAX = 4;
/** ~60 từ một đoạn (chốt Q6), chừa rộng cho tiếng Việt nhiều dấu. */
export const EXPLANATION_PARAGRAPH_CHARS_MAX = 700;

const EXPLANATION_SCHEMA = z.object({
  paragraphs: z.array(z.string().min(1).max(EXPLANATION_PARAGRAPH_CHARS_MAX)).min(1).max(EXPLANATION_PARAGRAPHS_MAX),
});

export const EXPLAINER_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    paragraphs: {
      type: 'array',
      minItems: 1,
      maxItems: EXPLANATION_PARAGRAPHS_MAX,
      items: { type: 'string' },
      description: 'Các đoạn văn giải thích, mỗi đoạn tối đa khoảng 60 từ.',
    },
  },
  required: ['paragraphs'],
};

export const EXPLAINER_SYSTEM_PROMPT = `Bạn diễn giải kết quả thiết kế hệ thống machine vision cho kỹ sư và khách hàng.
Đầu vào là DỮ KIỆN đã được engine tính sẵn cho một phương án thiết bị. Viết 2–4 đoạn văn ngắn (mỗi đoạn tối đa khoảng 60 từ) giải thích vì sao phương án này được chọn.

Trọng tâm, theo thứ tự: (a) độ phân giải cần (mm/px) và nhánh quyết định, so với mm/px thực của camera và hệ số dư; (b) những kiểm tra quan trọng của ống kính, đèn, máy tính — không cần kể hết mọi kiểm tra đạt; (c) giả định chưa được khách xác nhận; (d) yếu tố giới hạn và rủi ro. Viết tự nhiên như kỹ sư giải thích cho đồng nghiệp, không chép lại tên kiểm tra máy móc.

Quy tắc bắt buộc:
1. CHỈ dùng những con số có trong dữ kiện, chép NGUYÊN VĂN như trong dữ kiện. Không tính toán, không làm tròn, không đổi đơn vị, không quy ra phần trăm, không cộng trừ nhân chia.
2. Không tự thêm số thứ tự, số đếm hay năm nếu dữ kiện không có. Muốn liệt kê thì dùng chữ.
3. Khi nhắc tới một kiểm tra, ghi mã luật trong ngoặc, đúng như dữ kiện, ví dụ (OPT-001). Không bịa mã luật.
4. Không đề xuất thiết bị khác, không nhắc giá, không đánh giá thương hiệu.
5. Nêu rõ giả định chưa được khách xác nhận và yếu tố giới hạn nếu dữ kiện có.
6. Văn bản thường, không markdown, không gạch đầu dòng.
7. Viết bằng ngôn ngữ được yêu cầu trong tin nhắn.`;

export function buildExplainerMessage(factsText: string, locale: string): string {
  const language = locale === 'en' ? 'English' : 'tiếng Việt';
  return `Ngôn ngữ trả lời: ${language}.\n\nDỮ KIỆN:\n${factsText}`;
}

/* ── Bộ kiểm số ─────────────────────────────────────────────────────────── */

const RULE_ID = /\b[A-Z]{2,3}-\d{3}\b/g;
/** Số như bộ đọc mô tả: dấu chấm hoặc phẩy thập phân. */
const NUMBER = /\d+(?:[.,]\d+)?/g;

export function ruleIdsIn(text: string): string[] {
  return [...text.matchAll(RULE_ID)].map((m) => m[0]);
}

/** Số trong đoạn văn, bỏ phần số của mã luật (OPT-001 không phải số 1). */
export function numbersIn(text: string): string[] {
  return [...text.replace(RULE_ID, ' ').matchAll(NUMBER)].map((m) => m[0].replace(',', '.'));
}

const decimalsOf = (written: string) => (written.includes('.') ? written.split('.')[1].length : 0);
const significantDigits = (written: string) => written.replace('.', '').replace(/^0+/, '').length;

/**
 * Số trong đoạn văn có "có sẵn trong dữ kiện" không.
 * - Cùng giá trị, khác cách viết: 0,060 = 0.06 = 0.060.
 * - Làm tròn bớt một số có sẵn (0.0483 → 0.048) cũng qua, NHƯNG chỉ khi số viết
 *   ra còn từ 2 chữ số có nghĩa — "1" hay "0.1" khớp với quá nhiều số để tin được.
 */
export function numberAllowed(written: string, facts: readonly number[]): boolean {
  const value = Number(written);
  if (!Number.isFinite(value)) return false;
  if (facts.some((f) => Math.abs(f - value) < 1e-9)) return true;
  if (significantDigits(written) < 2) return false;
  const digits = decimalsOf(written);
  return facts.some((f) => {
    if (decimalsOf(String(f)) <= digits) return false;
    return Math.abs(Number(f.toFixed(digits)) - value) < 1e-9;
  });
}

export type GuardResult = { ok: true } | { ok: false; strayNumbers: string[]; strayRuleIds: string[] };

export function checkExplanation(paragraphs: readonly string[], factsText: string): GuardResult {
  const factNumbers = [...new Set(numbersIn(factsText).map(Number))];
  const factRules = new Set(ruleIdsIn(factsText));
  const text = paragraphs.join('\n');
  const strayNumbers = [...new Set(numbersIn(text).filter((n) => !numberAllowed(n, factNumbers)))];
  const strayRuleIds = [...new Set(ruleIdsIn(text).filter((id) => !factRules.has(id)))];
  return strayNumbers.length === 0 && strayRuleIds.length === 0 ? { ok: true } : { ok: false, strayNumbers, strayRuleIds };
}

/* ── Lời gọi API ────────────────────────────────────────────────────────── */

export type ExplainerOutcome =
  | { ok: true; paragraphs: string[]; model: string; usage?: ParserUsage }
  | {
      ok: false;
      /** 'stray' = đoạn văn có số / mã luật không có trong dữ kiện → đã bỏ. */
      reason: 'refusal' | 'truncated' | 'invalid' | 'apiError' | 'stray';
      model: string;
      usage?: ParserUsage;
      /** Mã lỗi để ghi log và hiện cho người dùng. Không chứa dữ kiện. */
      detail?: string;
    };

const BLOCKED_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE']);
const FALLBACK_STATUSES = [' 503', ' 429'];
const FALLBACK_WITHIN_MS = 10_000;

export type ExplainerOptions = { model?: string; fallbackModel?: string; now?: () => number };

export async function runExplainer(
  client: ParserClient,
  factsText: string,
  locale: string,
  options: ExplainerOptions = {}
): Promise<ExplainerOutcome> {
  const model = options.model ?? EXPLAINER_MODEL;
  const now = options.now ?? Date.now;
  const started = now();
  const first = await callModel(client, factsText, locale, model);
  const { fallbackModel } = options;
  if (
    first.ok ||
    first.reason !== 'apiError' ||
    !fallbackModel ||
    fallbackModel === model ||
    !FALLBACK_STATUSES.some((status) => first.detail?.endsWith(status)) ||
    now() - started > FALLBACK_WITHIN_MS
  ) {
    return first;
  }
  return callModel(client, factsText, locale, fallbackModel);
}

function usageOf(response: GenerateContentResponse): ParserUsage | undefined {
  const usage = response.usageMetadata;
  if (!usage) return undefined;
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    thinkingTokens: usage.thoughtsTokenCount ?? 0,
    cachedTokens: usage.cachedContentTokenCount ?? 0,
  };
}

async function callModel(client: ParserClient, factsText: string, locale: string, requested: string): Promise<ExplainerOutcome> {
  try {
    const response = await client.models.generateContent({
      model: requested,
      contents: buildExplainerMessage(factsText, locale),
      config: {
        systemInstruction: EXPLAINER_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: EXPLAINER_RESPONSE_SCHEMA,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingLevel: 'LOW' },
      } as GenerateContentParameters['config'],
    });

    const model = response.modelVersion ?? requested;
    const usage = usageOf(response);
    if (response.promptFeedback?.blockReason) return { ok: false, reason: 'refusal', model, usage, detail: String(response.promptFeedback.blockReason) };
    const finish = response.candidates?.[0]?.finishReason;
    if (finish && BLOCKED_FINISH.has(finish)) return { ok: false, reason: 'refusal', model, usage, detail: finish };
    if (finish === 'MAX_TOKENS') return { ok: false, reason: 'truncated', model, usage };

    let json: unknown;
    try {
      json = JSON.parse(response.text ?? '');
    } catch {
      return { ok: false, reason: 'invalid', model, usage, detail: 'json' };
    }
    const parsed = EXPLANATION_SCHEMA.safeParse(json);
    if (!parsed.success) return { ok: false, reason: 'invalid', model, usage, detail: 'schema' };

    const paragraphs = parsed.data.paragraphs.map((p) => p.trim()).filter(Boolean);
    const guard = checkExplanation(paragraphs, factsText);
    if (!guard.ok) {
      // Ghi SỐ lạ vào mã lỗi (không phải đoạn văn): đủ để biết model bịa gì.
      const stray = [...guard.strayNumbers, ...guard.strayRuleIds].slice(0, 5).join(' ');
      return { ok: false, reason: 'stray', model, usage, detail: `stray ${stray}` };
    }
    return { ok: true, paragraphs, model, usage };
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, reason: 'apiError', model: requested, detail: typeof status === 'number' ? `${name} ${status}` : name };
  }
}
