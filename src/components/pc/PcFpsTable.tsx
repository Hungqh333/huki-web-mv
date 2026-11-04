import { getTranslations } from 'next-intl/server';
import { NOTE_CLASS, PanelHeader } from '@/components/ui/PanelHeader';
import type { FpsTable } from '@/lib/pc/fps';
import { PC_INTERFACE_LABEL, PC_RESOLUTIONS } from '@/lib/pc/options';
import { PcExposureInput } from './PcExposureInput';
import { PC_INFO_CLASS } from './styles';

const BAND_CLASS = {
  low: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  mid: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
} as const;

/**
 * Tab "Bảng fps" (mẫu veFps()). Bảng do máy chủ tính (pc/fps.ts); ô phơi sáng đổi tham số
 * `?phoi=` trên địa chỉ trang để máy chủ tính lại — không có công thức nào xuống trình duyệt.
 */
export async function PcFpsTable({ table, exposureMs }: { table: FpsTable; exposureMs: number }) {
  const t = await getTranslations('pcVision.fps');
  return (
    <div className="space-y-4">
      <p className="max-w-4xl text-sm text-slate-600 dark:text-slate-400">
        {t.rich('intro', { b: (chunks) => <b className="text-slate-900 dark:text-slate-100">{chunks}</b> })}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <PcExposureInput initial={exposureMs} label={t('exposure')} />
        {table.exposureCap !== null ? <p className={NOTE_CLASS}>{t('exposureNote', { ms: exposureMs, fps: table.exposureCap })}</p> : null}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <PanelHeader title={t('title')} meta={t('meta', { rows: table.rows.length, cols: table.interfaces.length })} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <th className="px-3 py-2 text-left">{t('resolution')}</th>
                <th className="px-3 py-2 text-right">{t('mbPerFrame')}</th>
                {table.interfaces.map((i) => (
                  <th key={i.key} className="px-2 py-2 text-right">
                    {PC_INTERFACE_LABEL[i.key]}
                    <div className={PC_INFO_CLASS}>{i.mbps} MB/s</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.resolution} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {PC_RESOLUTIONS[row.resolution][2]}MP <span className={PC_INFO_CLASS}>({PC_RESOLUTIONS[row.resolution][0]}×{PC_RESOLUTIONS[row.resolution][1]})</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.mbPerFrame.toFixed(1)}</td>
                  {row.cells.map((cell, i) => (
                    <td
                      key={table.interfaces[i].key}
                      title={cell.limitedByExposure ? t('cappedTitle', { fps: cell.cableFps }) : undefined}
                      className={`px-2 py-1.5 text-right tabular-nums ${BAND_CLASS[cell.band]}`}
                    >
                      {cell.fps}
                      {cell.limitedByExposure ? '*' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-px ${BAND_CLASS.low}`}>{t('bandLow', { n: table.bands.low })}</span>
        <span className={`rounded-full px-2 py-px ${BAND_CLASS.mid}`}>{t('bandMid', { low: table.bands.low, high: table.bands.high })}</span>
        <span className={`rounded-full px-2 py-px ${BAND_CLASS.high}`}>{t('bandHigh', { n: table.bands.high })}</span>
        <span className={NOTE_CLASS}>· {t('footnote')}</span>
      </p>
    </div>
  );
}
