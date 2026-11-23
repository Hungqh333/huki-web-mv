import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ObliqueView } from '@/components/lens/ObliqueView';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import { contactMailto } from '@/lib/contact';
import type { Component } from '@/lib/components/specs';
import { fetchAllRows } from '@/lib/components/fetchAll';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { canUseFeature, lockedTextValues } from '@/lib/featureAccess';
import { mountCameraOptions, mountLensOptions } from '@/lib/vision/mountCheckOptions';

/**
 * Camera nghiêng (OPT-014) — chốt 2026-11-23 Q2-A: trang riêng trong nhóm Ống kính, cạnh Kiểm tra lắp đặt.
 * Cùng cổng với Chọn ống kính (tính năng `equipment`, Member+); RLS bảng components chặn ở database.
 */

async function getComponents(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Component[]> {
  const { data } = await fetchAllRows((from, to) =>
    supabase
      .from('components')
      .select('id, code, kind, brand, model, spec, price_vnd, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
      .eq('is_active', true)
      .in('kind', ['camera', 'lens'])
      .order('kind')
      .order('sort_order')
      .order('id')
      .range(from, to)
  );
  return (data ?? []) as Component[];
}

export default async function ObliquePage() {
  const t = await getTranslations('oblique');
  const tPc = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && (await canUseFeature(role, 'equipment'));
  const lockText = await lockedTextValues('equipment', role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{tPc('locked.title', lockText)}</h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
            {session ? tPc('locked.bodyRegistered', lockText) : tPc('locked.bodyGuest', lockText)}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link href="/dang-nhap" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {tPc('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Camera nghieng')}
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
  const components = await getComponents(supabase);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{t('why')}</p>
      <div className="mt-8">
        <FormulaVisibilityProvider show={isAdmin(role)}>
          <ObliqueView lenses={mountLensOptions(components)} cameras={mountCameraOptions(components)} admin={isAdmin(role)} />
        </FormulaVisibilityProvider>
      </div>
    </section>
  );
}
