import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminNav } from '@/components/admin/AdminNav';
import type { BadgeTone, IconName } from '@/components/ui/Icon';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';

const NAV: { href: string; key: string; icon: IconName; tone: BadgeTone }[] = [
  { href: '/admin/nguoi-dung', key: 'users', icon: 'users', tone: 'sky' },
  { href: '/admin/bai-viet', key: 'articles', icon: 'article', tone: 'violet' },
  { href: '/admin/luat-goi-y', key: 'rules', icon: 'rules', tone: 'emerald' },
  { href: '/admin/chi-tieu', key: 'kpi', icon: 'kpi', tone: 'amber' },
  { href: '/admin/linh-kien', key: 'components', icon: 'camera', tone: 'slate' },
];

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
        <AdminNav
          label={t('title')}
          items={NAV.map((item) => ({
            href: item.href,
            label: t(item.key),
            icon: item.icon,
            tone: item.tone,
          }))}
        />

        <div className="min-w-0">
          <NextIntlClientProvider messages={{ admin: messages.admin }}>
            {children}
          </NextIntlClientProvider>
        </div>
      </div>
    </div>
  );
}
