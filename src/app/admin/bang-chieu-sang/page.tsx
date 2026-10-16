import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { EngineTableForm } from '@/components/admin/EngineTableForm';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { createClient } from '@/lib/supabase/server';
import { RULESET_VERSION } from '@/lib/vision/bom';
import { rulesetVersionFor } from '@/lib/vision/engineParams';
import { DEFAULT_LIGHTING_ROWS, LIGHTING_ROW_KEYS } from '@/lib/vision/lighting';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

/** Bảng chiếu sáng (LGT-001…004) — sửa qua admin, chốt 2026-10-16. */
export default async function LightingTablePage() {
  const t = await getTranslations('admin.tables');
  const supabase = await createClient();
  const loaded = await loadEngineParams(supabase);
  /* Câu lý do mặc định đủ hai thứ tiếng — chữ mờ trong ô "Câu tiếng Việt" / "Câu tiếng Anh".
     Đọc thẳng hai file messages: i18n/request.ts luôn theo ngôn ngữ người dùng, không nhận locale truyền vào. */
  const reasons = { vi: vi.selector.vision.lightingReason, en: en.selector.vision.lightingReason } as Record<'vi' | 'en', Record<string, string>>;
  const defaultReasons = Object.fromEntries(
    LIGHTING_ROW_KEYS.map((row) => {
      const key = DEFAULT_LIGHTING_ROWS[row].reasonKey;
      return [row, { vi: reasons.vi[key], en: reasons.en[key] }];
    })
  );

  return (
    <section>
      <PanelHeader standalone title={t('lighting.title')} note={t('lighting.subtitle')} />
      <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {t('version', { version: rulesetVersionFor(RULESET_VERSION, loaded.params, loaded.tables) })}
      </p>
      <div className="mt-6">
        <EngineTableForm
          table="lighting"
          defaultReasons={defaultReasons}
          current={loaded.tables}
          stored={loaded.tableStored}
          rejected={loaded.tableRejected.filter((e) => e.table === 'lighting').map((e) => e.row)}
        />
      </div>
    </section>
  );
}
