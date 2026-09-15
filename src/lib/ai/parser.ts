import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { runParser, type ParserOutcome } from './parserCore';

/**
 * Bộ đọc mô tả phía server (V1a hạng mục 3). Key chỉ đọc ở server, không bao giờ
 * có tiền tố NEXT_PUBLIC_. Thiếu key thì app vẫn chạy như trước, không có parser.
 */
export function parserConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/*
 * Trang Yêu cầu đặt maxDuration = 60 giây (gói Vercel Hobby). Dừng ở 45 giây và
 * không tự thử lại để luôn trả kết quả trước giới hạn đó — thất bại thì người dùng
 * vẫn có bảng trống và nút "Đọc lại".
 */
export async function parseDescription(rawText: string): Promise<ParserOutcome> {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 0 });
  return runParser(client, rawText);
}
