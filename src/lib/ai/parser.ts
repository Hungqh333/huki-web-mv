import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { PARSER_FALLBACK_MODEL, PARSER_MODEL, runParser, type ParserOutcome } from './parserCore';

/**
 * Bộ đọc mô tả phía server (V1a hạng mục 3). Key chỉ đọc ở server, không bao giờ
 * có tiền tố NEXT_PUBLIC_. Thiếu key thì app vẫn chạy như trước, không có parser.
 */
export function parserConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;

/*
 * Trang Yêu cầu đặt maxDuration = 60 giây (gói Vercel Hobby). Mỗi lượt dừng ở 45
 * giây, SDK không tự thử lại (attempts: 1). Lượt đầu hỏng nhanh vì 503 / 429 thì
 * runParser đọc lại một lần bằng model dự phòng. Vẫn thất bại thì người dùng có
 * bảng trống và nút "Đọc lại".
 *
 * Truyền key tường minh: SDK tự đọc cả GOOGLE_API_KEY và ưu tiên biến đó, dễ lẫn key.
 * GEMINI_MODEL (tuỳ chọn) đổi model trên Vercel mà không cần sửa code.
 */
export async function parseDescription(rawText: string): Promise<ParserOutcome> {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } },
  });
  return runParser(client, rawText, {
    model: process.env.GEMINI_MODEL || PARSER_MODEL,
    fallbackModel: PARSER_FALLBACK_MODEL,
  });
}
