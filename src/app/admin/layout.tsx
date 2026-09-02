import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';

const NAV = [
  { href: '/admin/nguoi-dung', key: 'users' },
  { href: '/admin/bai-viet', key: 'articles' },
  { href: '/admin/luat-goi-y', key: 'rules' },
] as const;

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const t = await getTranslations('admin.nav');

  if (!hasSupabaseEnv()) notFound();

  const session = await getSessionContext();
  if (!session) redirect('/dang-nhap');

  // Chặn ở UI cho thân thiện. Chặn thật vẫn nằm ở RLS: mọi truy vấn quản trị
  // bên dưới đều trả rỗng hoặc lỗi nếu tài khoản không phải admin.
  if (!isAdmin(session.profile?.role)) redirect('/');

  // Namespace 'admin' bị loại khỏi provider ở layout gốc — chỉ nạp sau khi đã
  // qua cổng kiểm tra quyền ở trên.
  const messages = await getMessages();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={t('title')} className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          <NextIntlClientProvider messages={{ admin: messages.admin }}>
            {children}
          </NextIntlClientProvider>
        </div>
      </div>
    </div>
  );
}
