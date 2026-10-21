import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
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
      <PanelHeader
        standalone
        title={t('title')}
        note={t('subtitle')}
      />
      <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {t('version', { version: rulesetVersionFor(RULESET_VERSION, loaded.params, loaded.tables) })}
      </p>
      {loaded.serviceKeyMissing ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {t('serviceKeyMissing')}
        </p>
      ) : null}
      <div className="mt-6">
        <EngineParamsForm current={loaded.params} stored={loaded.stored} rejected={loaded.rejected} />
      </div>
    </section>
  );
}
