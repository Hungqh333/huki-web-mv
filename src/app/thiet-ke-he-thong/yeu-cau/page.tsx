import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RequirementSummary } from '@/components/requirement/RequirementSummary';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { isApplicationType } from '@/lib/requirement/draft';
import { hasSupabaseEnv } from '@/lib/supabase/env';

/**
 * Bước 1 của Vision Engineer — bảng tóm tắt yêu cầu (spec V1.1 §10.2).
 *
 * Quyền: Member trở lên, giống bộ chọn thiết bị. Chưa đủ quyền thì về trang
 * giới thiệu bộ chọn, nơi đã có lời mời đăng nhập / liên hệ.
 *
 * `?app=<ApplicationType>` điền sẵn loại ứng dụng. Văn bản khách gõ ở trang chủ
 * KHÔNG đi qua URL — nằm trong sessionStorage (xem lib/requirement/draft.ts).
 */
export default async function RequirementPage({ searchParams }: PageProps<'/thiet-ke-he-thong/yeu-cau'>) {
  if (!hasSupabaseEnv()) redirect('/cong-cu-chon-thiet-bi');

  const session = await getSessionContext();
  if (!canUseSelector(session?.profile?.role ?? null)) redirect('/cong-cu-chon-thiet-bi');

  const t = await getTranslations('designer.requirement');
  const { app } = await searchParams;
  const appParam = Array.isArray(app) ? app[0] : app;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">{t('step')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-8">
        <RequirementSummary initialApp={isApplicationType(appParam) ? appParam : null} />
      </div>
    </section>
  );
}
