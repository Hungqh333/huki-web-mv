/**
 * Lời gọi Gemini API cho bộ đọc mô tả (V1a hạng mục 3).
 *
 * Nhận client từ ngoài: server (lib/ai/parser.ts) tạo client thật với timeout
 * chặt; unit test truyền client giả; script đo (scripts/eval-parser.ts) truyền
 * client riêng và đổi model. File này không đọc biến môi trường.
 *
 * - Gói miễn phí của Google AI Studio (chốt 2026-09-15): Google được dùng nội dung
 *   gửi lên để cải thiện sản phẩm, nên trang chủ nhắc không nhập thông tin mật.
 * - Structured output (`responseJsonSchema`): API trả JSON theo schema; ở đây kiểm
 *   lại bằng zod. Kiểm nội dung (đoạn văn gốc, con số) nằm ở extraction.ts.
 * - Thinking mức thấp: đây là trích xuất, không cần suy luận sâu.
 * - Không gửi temperature: Gemini 3 khuyên giữ mặc định.
 */
import { z } from 'zod';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { EXTRACTION_SCHEMA, PARSER_SYSTEM_PROMPT, buildUserMessage, type Extraction } from './extraction';

/*
 * Chốt 2026-09-15 theo `npm run eval:parser` trên gói miễn phí: 3.5-flash-lite
 * 0/16 lượt lỗi, đúng 63/64 ô; 3.8-flash và 3.7-flash bị 503 "high demand" cả 16
 * lượt; 3.6-flash lỗi 4/16 nhưng đọc tốt khi chạy được — dùng làm dự phòng.
 */
export const PARSER_MODEL = 'gemini-3.5-flash-lite';
export const PARSER_FALLBACK_MODEL = 'gemini-3.6-flash';

/** Lỗi đáng thử model dự phòng: quá tải (503) hoặc hết hạn mức riêng của model (429). */
const FALLBACK_STATUSES = [' 503', ' 429'];
/** Chỉ thử dự phòng khi lượt đầu hỏng nhanh, để cả hai lượt vẫn nằm trong maxDuration 60 giây. */
const FALLBACK_WITHIN_MS = 10_000;

/** Chỉ phần client bộ đọc cần — test truyền object giả có đúng hàm này. */
export type ParserClient = {
  models: { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };
};

export type ParserOptions = {
  model?: string;
  /** `null` = không gửi thinkingConfig (dùng mặc định của model). */
  thinking?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | null;
  /**
   * Model đọc lại khi lượt đầu hỏng nhanh vì 503 / 429. Bỏ trống = không dự phòng
   * (script đo dùng cách này để đo đúng một model).
   */
  fallbackModel?: string;
  /** Đồng hồ, test truyền vào để giả lập lượt đầu hỏng chậm. */
  now?: () => number;
};

export type ParserUsage = {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
};

export type ParserOutcome =
  | { ok: true; extraction: Extraction; model: string; usage?: ParserUsage }
  | {
      ok: false;
      reason: 'refusal' | 'truncated' | 'invalid' | 'apiError';
      model: string;
      usage?: ParserUsage;
      /** Mã / tên lỗi để ghi log. Không bao giờ chứa mô tả của khách. */
      detail?: string;
    };

/** Lý do dừng nghĩa là bộ lọc an toàn của Google chặn — coi như từ chối. */
const BLOCKED_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE']);

/*
 * JSON Schema gửi cho Gemini, dựng một lần từ schema zod. Bỏ `$schema` và cận số
 * nguyên an toàn của JavaScript mà zod tự thêm — không mang nghĩa gì với bộ đọc,
 * bỏ đi cho schema gọn và tránh từ khoá API không nhận.
 */
export const GEMINI_RESPONSE_SCHEMA: Record<string, unknown> = (() => {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === '$schema') continue;
      if ((key === 'minimum' || key === 'maximum') && Math.abs(value as number) === Number.MAX_SAFE_INTEGER) continue;
      out[key] = strip(value);
    }
    return out;
  };
  return strip(z.toJSONSchema(EXTRACTION_SCHEMA)) as Record<string, unknown>;
})();

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

export async function runParser(client: ParserClient, rawText: string, options: ParserOptions = {}): Promise<ParserOutcome> {
  const model = options.model ?? PARSER_MODEL;
  const now = options.now ?? Date.now;
  const started = now();
  const first = await callModel(client, rawText, model, options.thinking);

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
  return callModel(client, rawText, fallbackModel, options.thinking);
}

async function callModel(
  client: ParserClient,
  rawText: string,
  requested: string,
  thinkingOption: ParserOptions['thinking']
): Promise<ParserOutcome> {
  const thinking = thinkingOption === undefined ? 'LOW' : thinkingOption;

  try {
    const response = await client.models.generateContent({
      model: requested,
      contents: buildUserMessage(rawText),
      config: {
        systemInstruction: PARSER_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
        maxOutputTokens: 16000,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      } as GenerateContentParameters['config'],
    });

    const model = response.modelVersion ?? requested;
    const usage = usageOf(response);
    // Kiểm lý do dừng TRƯỚC khi đọc nội dung: bị chặn hoặc hết token thì JSON có thể dở dang.
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
    const parsed = EXTRACTION_SCHEMA.safeParse(json);
    if (!parsed.success) return { ok: false, reason: 'invalid', model, usage, detail: 'schema' };

    return { ok: true, extraction: parsed.data, model, usage };
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, reason: 'apiError', model: requested, detail: typeof status === 'number' ? `${name} ${status}` : name };
  }
}
