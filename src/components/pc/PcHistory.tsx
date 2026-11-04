import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import type { PcHistoryEntry } from '@/lib/pc/catalog';

const show = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value));

/** Lịch sử sửa danh mục PC — chỉ trang của Admin render khung này (bảng chỉ Admin đọc được). */
export async function PcHistory({ entries }: { entries: PcHistoryEntry[] }) {
  const t = await getTranslations('pcVision.history');
  const format = await getFormatter();
  const en = (await getLocale()) === 'en';

  return (
    <Panel title={t('title')} meta={t('meta', { n: entries.length })} note={t('note')} bodyClassName="overflow-x-auto">
      {entries.length === 0 ? (
        <p className={`px-4 py-4 ${NOTE_CLASS}`}>{t('empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <th className="px-3 py-2">{t('col.at')}</th>
              <th className="px-3 py-2">{t('col.who')}</th>
              <th className="px-3 py-2">{t('col.what')}</th>
              <th className="px-3 py-2">{t('col.change')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                  {format.dateTime(new Date(e.at), { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">{e.actor ?? <span className={NOTE_CLASS}>{t('system')}</span>}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {t(`action.${e.action}`)} {t(`table.${e.table}`).toLowerCase()} <b>{(en && e.labelEn) || e.label}</b>
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">
                  {e.changes.map((c) => (
                    <div key={c.field} className="break-all">
                      <span className="text-slate-500">{c.field}:</span>{' '}
                      {e.action === 'insert' ? show(c.after) : `${show(c.before)} → ${show(c.after)}`}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
