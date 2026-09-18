import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { EXPLAINER_FALLBACK_MODEL, EXPLAINER_MODEL, runExplainer, type ExplainerOutcome } from './explainerCore';
import { parserConfigured } from './parser';

/**
 * Bộ diễn giải "Vì sao chọn?" phía server (V1c C7). Dùng chung key và model với
 * bộ đọc mô tả; thiếu key thì nút ẩn, khối dữ kiện vẫn hiện (chốt Q8).
 */
export const explainerConfigured = parserConfigured;

let client: GoogleGenAI | null = null;

/** Trang Yêu cầu đặt maxDuration 60 giây — dừng ở 45 giây như bộ đọc. */
export async function explainFacts(factsText: string, locale: string): Promise<ExplainerOutcome> {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } },
  });
  return runExplainer(client, factsText, locale, {
    model: process.env.GEMINI_MODEL || EXPLAINER_MODEL,
    fallbackModel: EXPLAINER_FALLBACK_MODEL,
  });
}
