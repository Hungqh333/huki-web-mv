import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { OcrSelector } from '@/components/ocr/OcrSelector';
import { canUseSelector, getSessionContext, isAdmin } from '@/lib/auth';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import { contactMailto } from '@/lib/contact';
import type { Component } from '@/lib/components/specs';
import { fetchAllRows } from '@/lib/components/fetchAll';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Bộ chọn camera OCR / OCV (chốt 2026-10-27, Q5–Q7).
 *
 * Member trở lên, như Chọn camera / Chọn đầu đọc mã. RLS của bảng components đã chặn
 * ở database; khung khoá dưới đây chỉ để hiện lời mời đăng nhập / liên hệ.
 */

async function getCameras(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Component[]> {
  const { data } = await fetchAllRows((from, to) =>
    supabase
      .from('components')
      .select('id, code, kind, brand, model, spec, price_vnd, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
      .eq('is_active', true)
      .eq('kind', 'camera')
      .order('sort_order')
      .order('id')
      .range(from, to)
  );
  return (data ?? []) as Component[];
}

export default async function OcrPage() {
  const t = await getTranslations('ocr');
  const tPc = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{tPc('locked.title')}</h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">{session ? tPc('locked.bodyRegistered') : tPc('locked.bodyGuest')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link href="/dang-nhap" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {tPc('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Chon camera OCR')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {tPc('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const supabase = await createClient();
  const [cameras, engine] = await Promise.all([getCameras(supabase), loadEngineParams(supabase)]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{t('why')}</p>
      <div className="mt-8">
        {cameras.length > 0 ? (
          // Công thức chỉ admin thấy (bảo vệ công thức, chốt 2026-10-21).
          <FormulaVisibilityProvider show={isAdmin(role)}>
            <OcrSelector components={cameras} params={engine.params} />
          </FormulaVisibilityProvider>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('emptyCatalog')}</p>
        )}
      </div>
    </section>
  );
}
