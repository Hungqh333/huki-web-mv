import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { EngineTableForm } from '@/components/admin/EngineTableForm';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { createClient } from '@/lib/supabase/server';
import { RULESET_VERSION } from '@/lib/vision/bom';
import { rulesetVersionFor } from '@/lib/vision/engineParams';

/** Giả định mặc định khi ô bảng Yêu cầu bỏ trống — sửa qua admin, chốt 2026-10-16. */
export default async function DefaultsTablePage() {
  const t = await getTranslations('admin.tables');
  const supabase = await createClient();
  const loaded = await loadEngineParams(supabase);

  return (
    <section>
      <PanelHeader standalone title={t('defaults.title')} note={t('defaults.subtitle')} />
      <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {t('version', { version: rulesetVersionFor(RULESET_VERSION, loaded.params, loaded.tables) })}
      </p>
      <div className="mt-6">
        <EngineTableForm
          table="defaults"
          current={loaded.tables}
          stored={loaded.tableStored}
          rejected={loaded.tableRejected.filter((e) => e.table === 'defaults').map((e) => e.row)}
        />
      </div>
    </section>
  );
}
