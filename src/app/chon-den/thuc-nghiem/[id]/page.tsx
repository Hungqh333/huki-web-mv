import { ActionLink } from '@/components/ui/ActionLink';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { VerdictBadge } from '@/components/light/VerdictBadge';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { labelOf, lightOptionLabels } from '@/lib/lightLabels';
import { loadExperimentTree, signExperimentPaths, signReport, type TrialRow } from '@/lib/lightExperiments';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { chosenTrial, isWorking } from '@/lib/vision/experimentMatch';
import { LEAKAGE_LIMIT, OVERKILL_LIMIT, trialRates } from '@/lib/vision/experimentMetrics';

/**
 * Chi tiết một lần thực nghiệm chiếu sáng (chốt 2026-10-24) — theo bố cục báo cáo test của phòng:
 * yêu cầu bài toán → từng hạng mục: phương án đèn, ảnh chụp / ảnh xử lý, kết quả → kết luận + báo cáo.
 */
export default async function LightExperimentPage({ params }: PageProps<'/chon-den/thuc-nghiem/[id]'>) {
  const session = await getSessionContext();
  if (!hasSupabaseEnv() || !canUseSelector(session?.profile?.role ?? null)) redirect('/chon-den');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const t = await getTranslations('lightSelector.experiments');
  const locale = await getLocale();
  const o = await lightOptionLabels();
  const supabase = await createClient();
  const tree = await loadExperimentTree(supabase, { id });
  const exp = tree.experiments[0];
  if (!exp) notFound();
  const [urls, reportLink] = await Promise.all([
    signExperimentPaths(supabase, [exp.product_image_path, ...tree.images.map((i) => i.storage_path)]),
    exp.report_path ? signReport(supabase, exp.report_path, exp.report_name) : Promise.resolve(null),
  ]);

  const num = (v: number) => v.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 3 });
  const pct = (v: number) => `${num(v * 100)} %`;
  const items = tree.items.map((item) => {
    const trials = tree.trials.filter((tr) => tr.item_id === item.id);
    return { item, trials, chosen: chosenTrial(trials) };
  });
  const working = items.filter(({ chosen }) => isWorking(chosen?.verdict ?? null)).length;
  const conclusion = (locale === 'en' ? exp.conclusion_en : null) ?? exp.conclusion_vi;

  const facts: [string, string | null][] = [
    [t('product'), exp.product_name],
    [t('size'), exp.product_width_mm && exp.product_height_mm ? `${num(exp.product_width_mm)} × ${num(exp.product_height_mm)} mm` : null],
    [t('models'), exp.model_count !== null ? String(exp.model_count) : null],
    [t('minDefect'), exp.min_defect_mm !== null ? `${num(exp.min_defect_mm)} mm` : null],
    [t('engineer'), exp.engineer],
    [t('testedOn'), exp.tested_on],
    [t('object'), [labelOf(o.materials, exp.material), labelOf(o.finishes, exp.finish), labelOf(o.shapes, exp.shape)].filter(Boolean).join(' · ') || null],
    [t('colors'), [labelOf(o.colors, exp.feature_color), labelOf(o.colors, exp.background_color)].filter(Boolean).join(' / ') || null],
  ];

  const setup = (trial: TrialRow): [string, string | null][] => [
    [t('setup.light'), [labelOf(o.lights, trial.light_type), labelOf(o.lightColors, trial.light_color)].filter(Boolean).join(' · ')],
    [t('setup.model'), trial.light_model],
    [t('setup.angle'), trial.angle_note],
    [t('setup.distance'), trial.distance_mm !== null ? `${num(trial.distance_mm)} mm` : null],
    [t('setup.backdrop'), trial.backdrop],
    [t('setup.camera'), trial.camera],
    [t('setup.lens'), [trial.lens, trial.accessory].filter(Boolean).join(' + ') || null],
    [t('setup.time'), trial.capture_ms !== null || trial.process_ms !== null ? t('setup.timeValue', { capture: trial.capture_ms ?? '—', process: trial.process_ms ?? '—' }) : null],
  ];

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-12 sm:px-6">
      <div>
        <ActionLink href="/chon-den/thuc-nghiem" variant="back">
          {t('backToList')}
        </ActionLink>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{exp.code}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{exp.title}</h1>
        {exp.status === 'draft' ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('draftNote')}</p> : null}
      </div>

      <Panel id="tn-yeu-cau" title={t('requirementTitle')} meta={t('working', { ok: working, total: items.length })}>
        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="text-sm text-slate-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
          </dl>
          {exp.product_image_path && urls.get(exp.product_image_path) ? (
            // eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ
            <img src={urls.get(exp.product_image_path)} alt={exp.product_name ?? exp.title} className="w-full rounded-lg ring-1 ring-slate-200 dark:ring-slate-700" />
          ) : null}
        </div>
      </Panel>

      {items.map(({ item, trials, chosen }, index) => (
        <Panel
          key={item.id}
          id={`hm-${item.id}`}
          className="scroll-mt-24"
          title={`${index + 1}. ${(locale === 'en' ? item.name_en : null) ?? item.name_vi}`}
          meta={<VerdictBadge verdict={chosen?.verdict ?? null} label={t(`verdict.${chosen?.verdict ?? 'none'}`)} />}
          note={[item.task && item.feature ? labelOf(o.targets, `${item.task}:${item.feature}`) : null, item.requirement].filter(Boolean).join(' — ') || undefined}
        >
          <div className="space-y-6">
            {trials.map((trial) => {
              const rates = trialRates(trial);
              const images = tree.images.filter((img) => img.trial_id === trial.id);
              return (
                <div key={trial.id} className={trials.length > 1 ? 'rounded-xl border border-slate-200 p-3 sm:p-4 dark:border-slate-800' : ''}>
                  {trials.length > 1 ? (
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {trial.label ?? labelOf(o.lights, trial.light_type)}
                      {trial.id === chosen?.id ? <span className="text-xs font-medium text-sky-700 dark:text-sky-400">{t('chosen')}</span> : null}
                      <VerdictBadge verdict={trial.verdict} label={t(`verdict.${trial.verdict ?? 'none'}`)} />
                    </p>
                  ) : trial.label ? (
                    <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{trial.label}</p>
                  ) : null}
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                    {setup(trial)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{k}</dt>
                          <dd className="text-sm text-slate-900 dark:text-slate-100">{v}</dd>
                        </div>
                      ))}
                  </dl>

                  {images.length > 0 ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {(['raw', 'processed'] as const).map((kind) => {
                        const list = images.filter((img) => img.kind === kind && urls.get(img.storage_path));
                        return list.length > 0 ? (
                          <div key={kind}>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t(kind)}</p>
                            <div className="mt-1 grid gap-2">
                              {list.map((img) => (
                                <figure key={img.id}>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ */}
                                  <img src={urls.get(img.storage_path)} alt={img.caption_vi ?? t(kind)} className="w-full rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700" loading="lazy" />
                                  {(locale === 'en' ? img.caption_en : null) ?? img.caption_vi ? (
                                    <figcaption className={`mt-0.5 ${NOTE_CLASS}`}>{(locale === 'en' ? img.caption_en : null) ?? img.caption_vi}</figcaption>
                                  ) : null}
                                </figure>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {trial.measured_error_mm !== null ? <p>{t('error', { mm: num(trial.measured_error_mm) })}</p> : null}
                    {trial.ok_samples !== null || trial.ng_samples !== null ? <p>{t('samples', { ok: trial.ok_samples ?? '—', ng: trial.ng_samples ?? '—' })}</p> : null}
                    {rates ? (
                      <p>
                        {t('leakage', { value: pct(rates.leakage), limit: pct(LEAKAGE_LIMIT) })} {rates.leakageOk ? '✓' : '✗'} ·{' '}
                        {t('overkill', { value: pct(rates.overkill), limit: pct(OVERKILL_LIMIT) })} {rates.overkillOk ? '✓' : '✗'}{' '}
                        <span className={NOTE_CLASS}>{t('ratesNote', { total: rates.total })}</span>
                      </p>
                    ) : null}
                    {trial.note ? <p className="whitespace-pre-line">{trial.note}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      <Panel id="tn-ket-luan" title={t('conclusionTitle')} meta={t('working', { ok: working, total: items.length })}>
        {conclusion ? <p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-100">{conclusion}</p> : <p className={NOTE_CLASS}>{t('noConclusion')}</p>}
        {reportLink || exp.report_url ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {reportLink ? (
              <ActionLink href={reportLink} variant="primary" download>
                {t('downloadReport', { name: exp.report_name ?? '' })}
              </ActionLink>
            ) : null}
            {exp.report_url ? (
              <ActionLink href={exp.report_url} external>
                {t('openReportLink')}
              </ActionLink>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
