/**
 * Lời gọi Claude API cho bộ đọc mô tả (V1a hạng mục 3).
 *
 * Nhận client từ ngoài: server (lib/ai/parser.ts) tạo client thật với timeout
 * chặt; unit test truyền client giả; script đo (scripts/eval-parser.ts) truyền
 * client riêng và đổi model. File này không đọc biến môi trường.
 *
 * - Structured outputs (`betaZodOutputFormat`): API bảo đảm JSON đúng schema; SDK
 *   kiểm lại bằng zod. Kiểm nội dung (đoạn văn gốc, con số) nằm ở extraction.ts.
 * - Claude Opus 5, effort thấp: đây là trích xuất, không cần suy luận sâu.
 * - `fallbacks: "default"` (beta server-side-fallback-2026-07-01): nếu Opus 5 từ
 *   chối vì bộ lọc an toàn, API tự chạy lại trên model dự phòng do Anthropic chọn.
 * - System prompt cố định kèm cache_control để các lượt đọc sau dùng lại cache.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { EXTRACTION_SCHEMA, PARSER_SYSTEM_PROMPT, buildUserMessage, type Extraction } from './extraction';

export const PARSER_MODEL = 'claude-opus-5';

export type ParserOptions = {
  model?: string;
  /** `null` = không gửi effort (Claude Haiku 4.5 không nhận tham số này). */
  effort?: 'low' | 'medium' | 'high' | null;
};

export type ParserUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ParserOutcome =
  | { ok: true; extraction: Extraction; model: string; usage: ParserUsage }
  | {
      ok: false;
      reason: 'refusal' | 'truncated' | 'invalid' | 'apiError';
      model: string;
      usage?: ParserUsage;
      /** Mã / tên lỗi để ghi log. Không bao giờ chứa mô tả của khách. */
      detail?: string;
    };

function usageOf(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): ParserUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

export async function runParser(client: Anthropic, rawText: string, options: ParserOptions = {}): Promise<ParserOutcome> {
  const model = options.model ?? PARSER_MODEL;
  const effort = options.effort === undefined ? 'low' : options.effort;
  const useFallbacks = model === PARSER_MODEL;

  try {
    const message = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system: [{ type: 'text', text: PARSER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserMessage(rawText) }],
      output_config: {
        format: betaZodOutputFormat(EXTRACTION_SCHEMA),
        ...(effort ? { effort } : {}),
      },
    });

    const usage = usageOf(message.usage);
    // Kiểm stop_reason TRƯỚC khi đọc nội dung: từ chối hoặc hết token thì JSON có thể không đúng schema.
    if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal', model: message.model, usage };
    if (message.stop_reason === 'max_tokens') return { ok: false, reason: 'truncated', model: message.model, usage };
    if (!message.parsed_output) return { ok: false, reason: 'invalid', model: message.model, usage };

    return { ok: true, extraction: message.parsed_output, model: message.model, usage };
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, reason: 'apiError', model, detail: typeof status === 'number' ? `${name} ${status}` : name };
  }
}
