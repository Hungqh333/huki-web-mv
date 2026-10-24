import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { EngineTableForm } from '@/components/admin/EngineTableForm';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { createClient } from '@/lib/supabase/server';
import { lightRowLabels } from '@/lib/lightRowLabels';
import { RULESET_VERSION } from '@/lib/vision/bom';
import { rulesetVersionFor } from '@/lib/vision/engineParams';
import { DEFAULT_LIGHTING_ROWS, LIGHTING_ROW_KEYS } from '@/lib/vision/lighting';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

/** Bảng chiếu sáng (LGT-001…004) — sửa qua admin, chốt 2026-10-16. Bảng màu đèn (LGT-010…014) thêm 2026-10-22. */
export default async function LightingTablePage() {
  const t = await getTranslations('admin.tables');
  const supabase = await createClient();
  const loaded = await loadEngineParams(supabase);
  const rowLabels = await lightRowLabels();
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
      {/* Trang Chọn đèn bản 2 (chốt 2026-10-22): bảng kiểu đèn + bảng màu đèn. */}
      <div id="kieu-den" className="mt-12 scroll-mt-24">
        <PanelHeader standalone title={t('lightMatrix.title')} note={t('lightMatrix.subtitle')} />
        <div className="mt-6">
          <EngineTableForm
            table="lightMatrix"
            current={loaded.tables}
            stored={loaded.tableStored}
            rowLabels={rowLabels}
            rejected={loaded.tableRejected.filter((e) => e.table === 'lightMatrix').map((e) => e.row)}
          />
        </div>
      </div>
      <div id="mau-den" className="mt-12 scroll-mt-24">
        <PanelHeader standalone title={t('lightColor.title')} note={t('lightColor.subtitle')} />
        <div className="mt-6">
          <EngineTableForm
            table="lightColor"
            current={loaded.tables}
            stored={loaded.tableStored}
            rowLabels={rowLabels}
            rejected={loaded.tableRejected.filter((e) => e.table === 'lightColor').map((e) => e.row)}
          />
        </div>
      </div>
    </section>
  );
}
