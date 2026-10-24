import { ActionLink } from '@/components/ui/ActionLink';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { SelectField } from '@/components/admin/ExperimentFields';
import { VerdictBadge } from '@/components/light/VerdictBadge';
import { Panel } from '@/components/ui/PanelHeader';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { labelOf, lightOptionLabels } from '@/lib/lightLabels';
import { loadExperimentTree } from '@/lib/lightExperiments';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { chosenTrial, isWorking } from '@/lib/vision/experimentMatch';

/**
 * Dự án thực nghiệm của phòng Vision (chốt 2026-10-24) — mở từ nút trên cùng trang Chọn đèn,
 * lọc sẵn theo "cần thấy gì" đang chọn. Member trở lên, cùng mức trang Chọn đèn. Lọc theo "cần thấy gì", vật liệu, kiểu đèn đã thử (lọc trên máy chủ).
 */
export default async function LightExperimentsPage({ searchParams }: PageProps<'/chon-den/thuc-nghiem'>) {
  const session = await getSessionContext();
  if (!hasSupabaseEnv() || !canUseSelector(session?.profile?.role ?? null)) redirect('/chon-den');
  const t = await getTranslations('lightSelector.experiments');
  const locale = await getLocale();
  const o = await lightOptionLabels();
  const sp = await searchParams;
  const pick = (key: string) => (typeof sp[key] === 'string' && sp[key] !== '' ? (sp[key] as string) : null);
  const filter = { target: pick('target'), material: pick('material'), light: pick('light') };
  const [fTask, fFeature] = filter.target ? filter.target.split(':') : [null, null];

  const supabase = await createClient();
  const tree = await loadExperimentTree(supabase, { withImages: false });
  const rows = tree.experiments.flatMap((exp) => {
    const items = tree.items
      .filter((i) => i.experiment_id === exp.id)
      .map((item) => {
        const trials = tree.trials.filter((tr) => tr.item_id === item.id);
        return { item, trials, chosen: chosenTrial(trials) };
      });
    const keep =
      (!fFeature || items.some(({ item }) => item.feature === fFeature && (item.task === null || item.task === fTask))) &&
      (!filter.material || exp.material === filter.material || items.some(({ item }) => item.material === filter.material)) &&
      (!filter.light || items.some(({ trials }) => trials.some((tr) => tr.light_type === filter.light)));
    return keep ? [{ exp, items }] : [];
  });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <ActionLink href="/chon-den" variant="back">
        {t('backToSelector')}
      </ActionLink>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('pageSubtitle')}</p>

      <form method="get" className="mt-6 grid items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[2fr_1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900">
        <SelectField name="target" label={t('filterTarget')} options={o.targets} empty={t('filterAll')} value={filter.target} />
        <SelectField name="material" label={t('filterMaterial')} options={o.materials} empty={t('filterAll')} value={filter.material} />
        <SelectField name="light" label={t('filterLight')} options={o.lights} empty={t('filterAll')} value={filter.light} />
        <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          {t('filterApply')}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">{t('count', { n: rows.length })}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('listEmpty')}</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {rows.map(({ exp, items }) => {
            const working = items.filter(({ chosen }) => isWorking(chosen?.verdict ?? null)).length;
            return (
              <Panel
                key={exp.id}
                as="h3"
                title={
                  <Link href={`/chon-den/thuc-nghiem/${exp.id}`} className="hover:underline">
                    {exp.code} · {exp.title}
                  </Link>
                }
                meta={t('working', { ok: working, total: items.length })}
                note={[exp.tested_on, exp.engineer, labelOf(o.materials, exp.material), labelOf(o.finishes, exp.finish)].filter(Boolean).join(' · ') || undefined}
              >
                <ul className="space-y-1.5 text-sm">
                  {items.map(({ item, chosen }) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/chon-den/thuc-nghiem/${exp.id}#hm-${item.id}`} className="font-medium text-slate-800 hover:underline dark:text-slate-100">
                        {(locale === 'en' ? item.name_en : null) ?? item.name_vi}
                      </Link>
                      {chosen ? <span className="text-xs text-slate-500 dark:text-slate-400">{labelOf(o.lights, chosen.light_type)}</span> : null}
                      <VerdictBadge verdict={chosen?.verdict ?? null} label={t(`verdict.${chosen?.verdict ?? 'none'}`)} />
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
    </section>
  );
}
