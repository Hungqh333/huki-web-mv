import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { SubmitButton, TextField } from '@/components/admin/ExperimentFields';
import { createExperimentAction } from '@/app/actions/lightExperiments';
import { loadExperimentTree } from '@/lib/lightExperiments';
import { createClient } from '@/lib/supabase/server';
import { chosenTrial, isWorking } from '@/lib/vision/experimentMatch';

/**
 * Thực nghiệm chiếu sáng — danh sách + tạo mới (chốt 2026-10-24 Q6). Một lần thực nghiệm = một
 * báo cáo test; sửa chi tiết ở trang con.
 */
export default async function LightExperimentsAdminPage({ searchParams }: PageProps<'/admin/thuc-nghiem-chieu-sang'>) {
  const t = await getTranslations('admin.experiments');
  const sp = await searchParams;
  const error = typeof sp.e === 'string' ? sp.e : null;
  const supabase = await createClient();
  const tree = await loadExperimentTree(supabase, { withImages: false });

  return (
    <section>
      <PanelHeader standalone title={t('title')} note={t('subtitle')} />

      <form action={createExperimentAction} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('create.title')}</h2>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {t(`errors.${error}` as never)}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <TextField name="code" label={t('fields.code')} placeholder="MC1626-01" required max={60} />
          <TextField name="title" label={t('fields.title')} placeholder={t('fields.titlePlaceholder')} required max={200} />
        </div>
        <SubmitButton>{t('create.submit')}</SubmitButton>
      </form>

      <h2 className="mt-8 text-lg font-semibold">{t('listTitle', { n: tree.experiments.length })}</h2>
      {tree.experiments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t('fields.code')}</th>
                <th className="px-3 py-2 font-medium">{t('fields.title')}</th>
                <th className="px-3 py-2 font-medium">{t('fields.testedOn')}</th>
                <th className="px-3 py-2 font-medium">{t('items.count')}</th>
                <th className="px-3 py-2 font-medium">{t('fields.status')}</th>
              </tr>
            </thead>
            <tbody>
              {tree.experiments.map((exp) => {
                const items = tree.items.filter((i) => i.experiment_id === exp.id);
                const working = items.filter((i) => isWorking(chosenTrial(tree.trials.filter((tr) => tr.item_id === i.id))?.verdict ?? null)).length;
                return (
                  <tr key={exp.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/admin/thuc-nghiem-chieu-sang/${exp.id}`} className="text-sky-700 hover:underline dark:text-sky-400">
                        {exp.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{exp.title}</td>
                    <td className="px-3 py-2 tabular-nums">{exp.tested_on ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{t('items.working', { ok: working, total: items.length })}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${exp.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                      >
                        {t(`status.${exp.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
