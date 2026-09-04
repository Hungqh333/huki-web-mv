import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

/**
 * Font chính của giao diện.
 *
 * Dùng lại đúng hai file đã có sẵn cho báo cáo PDF (assets/fonts) nên web và
 * PDF cùng một font, và không phụ thuộc mạng lúc build như next/font/google.
 *
 * Lý do phải có font riêng: Arial mặc định của scaffold hiển thị dấu tiếng Việt
 * kém ở cỡ nhỏ — dấu ngã và dấu mũ đè lên chữ ở text-xs, mà giao diện dùng cỡ
 * đó cho đơn vị đo và mã tra cứu.
 */
const beVietnamPro = localFont({
  src: [
    { path: '../../assets/fonts/BeVietnamPro-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../assets/fonts/BeVietnamPro-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: t('appName'),
    description: t('appTagline'),
  };
}

/**
 * Những namespace KHÔNG gửi xuống client ở mọi trang.
 *
 * NextIntlClientProvider mặc định đẩy toàn bộ catalog vào HTML của mọi trang.
 * Namespace 'kpi' chứa hướng dẫn đàm phán nội bộ ("đừng bán thay thế người
 * kiểm...", cách xử lý khi khách đòi bỏ sót = 0) và 'admin' chứa mô tả thao tác
 * quản trị — không nên nằm trong mã nguồn trang mà khách hàng hay đối thủ đọc
 * được. Hai trang tương ứng tự bọc provider riêng cho phần của mình.
 */
const PRIVATE_NAMESPACES = ['kpi', 'admin'] as const;

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  const allMessages = await getMessages();
  const publicMessages = Object.fromEntries(
    Object.entries(allMessages).filter(
      ([key]) => !PRIVATE_NAMESPACES.includes(key as (typeof PRIVATE_NAMESPACES)[number])
    )
  );

  // suppressHydrationWarning: một số extension trình duyệt chèn thêm class vào
  // thẻ <html> trước khi React hydrate (ví dụ 'mdl-js'), gây cảnh báo mismatch
  // không liên quan gì tới code của mình. Cờ này chỉ có tác dụng ở đúng thẻ này,
  // không giấu lỗi hydration thật ở bên trong.
  return (
    <html
      lang={locale}
      className={`h-full antialiased ${beVietnamPro.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Gắn class .dark trước khi trang vẽ để không nháy nền sáng một nhịp.
          Phải là script thô đặt sớm; next/script strategy nào cũng chạy muộn hơn.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col bg-white font-[family-name:var(--font-be-vietnam-pro)] text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      >
        <NextIntlClientProvider messages={publicMessages}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
