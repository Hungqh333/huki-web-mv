import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /**
   * Ép đóng gói file font theo hàm xuất PDF.
   *
   * Bundler không truy vết được file nhị phân đọc bằng readFileSync lúc chạy —
   * thiếu khai báo này thì build ở máy vẫn chạy nhưng lên Vercel sẽ lỗi
   * "ENOENT: no such file or directory" đúng lúc người dùng bấm xuất báo cáo.
   */
  outputFileTracingIncludes: {
    '/api/bao-cao/[historyId]': ['./assets/fonts/*.ttf'],
  },
  /**
   * Ảnh mẫu chiếu sáng tải lên qua server action (2026-10-22): mặc định chỉ 1 MB. Vercel chặn
   * thân yêu cầu > 4,5 MB nên ảnh giới hạn 4 MB (lightingSamples.ts : SAMPLE_MAX_BYTES).
   */
  experimental: {
    serverActions: { bodySizeLimit: '4.5mb' },
  },
};

export default withNextIntl(nextConfig);
