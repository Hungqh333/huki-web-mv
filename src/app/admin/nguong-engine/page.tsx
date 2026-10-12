import { getTranslations } from 'next-intl/server';
import { EngineParamsForm } from '@/components/admin/EngineParamsForm';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { createClient } from '@/lib/supabase/server';
import { RULESET_VERSION } from '@/lib/vision/bom';
import { rulesetVersionFor } from '@/lib/vision/engineParams';

/** Ngưỡng engine Vision Engineer — sửa qua admin (CLAUDE.md §9, chốt 2026-10-12). */
export default async function EngineParamsPage() {
  const t = await getTranslations('admin.engine');
  const supabase = await createClient();
  const loaded = await loadEngineParams(supabase);

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {t('version', { version: rulesetVersionFor(RULESET_VERSION, loaded.params) })}
      </p>
      <div className="mt-6">
        <EngineParamsForm current={loaded.params} stored={loaded.stored} rejected={loaded.rejected} />
      </div>
    </section>
  );
}
