import 'server-only';

import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

export const PDF_FONT_FAMILY = 'BeVietnamPro';

let registered = false;

/**
 * Nạp font cho @react-pdf/renderer.
 *
 * Bắt buộc phải có font riêng: Helvetica mặc định của PDF không chứa glyph tiếng
 * Việt, chữ có dấu sẽ mất hoặc ra ô vuông.
 *
 * File font nằm trong repo (assets/fonts) chứ không đọc từ node_modules, và được
 * khai báo ở outputFileTracingIncludes trong next.config.ts để Vercel đóng gói
 * theo khi deploy.
 */
export function registerPdfFonts() {
  if (registered) return;

  const dir = join(process.cwd(), 'assets', 'fonts');

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: join(dir, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
      { src: join(dir, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
    ],
  });

  // Tắt tự động ngắt từ: thuật toán mặc định là cho tiếng Anh, áp lên tiếng Việt
  // sẽ chèn dấu gạch nối vào giữa những chỗ không nên ngắt.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
