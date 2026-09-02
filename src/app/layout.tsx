import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

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
    <html lang={locale} className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NextIntlClientProvider messages={publicMessages}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
