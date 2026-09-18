import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProjectSaveBar } from '@/components/requirement/ProjectSaveBar';
import { RequirementSummary } from '@/components/requirement/RequirementSummary';
import { canUseSelector, getSessionContext, hasAdvancedFeatures } from '@/lib/auth';
import { isApplicationType } from '@/lib/requirement/draft';
import type { Component } from '@/lib/components/specs';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Bước 1 của Vision Engineer — bảng tóm tắt yêu cầu (spec V1.1 §10.2).
 *
 * Quyền: Member trở lên, giống bộ chọn thiết bị. Chưa đủ quyền thì về trang
 * giới thiệu bộ chọn, nơi đã có lời mời đăng nhập / liên hệ.
 *
 * `?app=<ApplicationType>` điền sẵn loại ứng dụng. Văn bản khách gõ ở trang chủ
 * KHÔNG đi qua URL — nằm trong sessionStorage (xem lib/requirement/draft.ts).
 */
/**
 * Server action của trang này gồm cả lượt đọc mô tả bằng LLM (V1a hạng mục 3), có
 * thể mất vài chục giây. Gói Vercel đang dùng là Hobby: đặt 60 giây. SDK tự dừng ở
 * 45 giây và không thử lại (lib/ai/parser.ts) để luôn kết thúc trước giới hạn này.
 */
export const maxDuration = 60;

export default async function RequirementPage({ searchParams }: PageProps<'/thiet-ke-he-thong/yeu-cau'>) {
  if (!hasSupabaseEnv()) redirect('/cong-cu-chon-thiet-bi');

  const session = await getSessionContext();
  if (!canUseSelector(session?.profile?.role ?? null)) redirect('/cong-cu-chon-thiet-bi');

  const t = await getTranslations('designer.requirement');
  const { app } = await searchParams;

  // Catalog cho khối Thiết bị phù hợp (V1c C3). RLS chỉ trả cho Member+ — đúng quyền trang này.
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from('components')
    .select('id, code, kind, brand, model, spec, price_vnd, lead_time_days, supplier, used_in_projects, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
    .eq('is_active', true)
    .order('kind')
    .order('sort_order');
  const appParam = Array.isArray(app) ? app[0] : app;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">{t('step')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-8 space-y-6">
        <ProjectSaveBar canExportPdf={hasAdvancedFeatures(session?.profile?.role ?? null)} />
        <RequirementSummary initialApp={isApplicationType(appParam) ? appParam : null} catalog={(catalog ?? []) as Component[]} />
      </div>
    </section>
  );
}
