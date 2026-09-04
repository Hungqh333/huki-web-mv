import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { deleteRuleAction } from '@/app/actions/admin';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { validateCondition } from '@/lib/selector/conditions';
import type { SolutionApproach } from '@/lib/selector/types';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  code: string | null;
  priority: number;
  is_active: boolean;
  ai_or_rule_based: SolutionApproach;
  condition_json: unknown;
  recommended_camera: string | null;
  recommended_lighting: string | null;
  recommended_lens: string | null;
  task_types: { name_vi: string } | null;
};

export default async function AdminRulesPage({ searchParams }: PageProps<'/admin/luat-goi-y'>) {
  const t = await getTranslations('admin.rules');
  const tApproach = await getTranslations('selector.approach');
  const { saved, deleted } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('selector_rules')
    .select(
      'id, code, priority, is_active, ai_or_rule_based, condition_json, recommended_camera, recommended_lighting, recommended_lens, task_types(name_vi)'
    )
    .order('priority', { ascending: true });

  const rules = (data ?? []) as unknown as Row[];

  const summarise = (condition: unknown) => {
    const value = condition as { all?: { field: string; op: string; value?: unknown }[] } | null;
    if (!value?.all || value.all.length === 0) return t('baselineRule');
    return value.all
      .map((p) => `${p.field} ${p.op} ${JSON.stringify(p.value ?? '')}`)
      .join(' & ');
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/luat-goi-y/moi"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('new')}
        </Link>
      </div>

      {saved ? <Flash tone="ok" text={t('saved')} /> : null}
      {deleted ? <Flash tone="ok" text={t('deleted')} /> : null}
      {error ? <Flash tone="error" text={error.message} /> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colPriority')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colCode')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colTask')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colCondition')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colApproach')}</th>
              <th scope="col" className="py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rules.map((rule) => {
              const problems = validateCondition(rule.condition_json);
              return (
                <tr key={rule.id} className={rule.is_active ? '' : 'opacity-50'}>
                  <td className="py-3 pr-3 tabular-nums">{rule.priority}</td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/luat-goi-y/${rule.id}`}
                      className="font-mono text-xs hover:text-sky-700 dark:hover:text-sky-400"
                    >
                      {rule.code ?? rule.id.slice(0, 8)}
                    </Link>
                    {rule.is_active ? null : (
                      <span className="ml-2 text-xs text-slate-400">{t('inactive')}</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
                    {rule.task_types?.name_vi ?? '—'}
                  </td>
                  <td className="py-3 pr-3">
                    <code className="text-xs text-slate-600 dark:text-slate-400">
                      {summarise(rule.condition_json)}
                    </code>
                    {problems.length > 0 ? (
                      <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                        {t('invalidStored')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-xs">{tApproach(rule.ai_or_rule_based)}</td>
                  <td className="py-3">
                    <DeleteButton action={deleteRuleAction} id={rule.id} itemName={rule.code ?? rule.id.slice(0, 8)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rules.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
        ) : null}
      </div>
    </section>
  );
}

function Flash({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <p
      className={
        tone === 'ok'
          ? 'mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
      }
    >
      {text}
    </p>
  );
}
