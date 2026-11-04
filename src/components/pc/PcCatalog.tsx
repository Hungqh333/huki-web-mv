'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { NOTE_CLASS, PanelHeader } from '@/components/ui/PanelHeader';
import {
  gpuLabel,
  sizeLabel,
  type PcConfig,
  type PcFrame,
  type PcPowerModel,
} from '@/lib/pc/code';
import { PcCodeParts } from './PcCode';
import { PcConfigDialog, type PcConfigDraft } from './PcConfigDialog';
import { PcFrameDialog } from './PcFrameDialog';
import { PC_INFO_CLASS } from './styles';

type StatusFilter = 'active' | 'retired' | 'all';

/**
 * Tab "Danh mục thường dùng" của PC Vision (tên đổi 2026-11-04) (mẫu duyệt 03/11/2026, khung theo PanelHeader — Q10).
 * Nhóm theo khung; dòng cấu hình in mờ phần khung của mã, in đậm phần R-S-D.
 * `admin` chỉ quyết định hiện nút — quyền thật kiểm ở server action và RLS.
 */
export function PcCatalog({
  frames,
  configs,
  admin,
  power,
  issuedCodes,
}: {
  frames: PcFrame[];
  configs: PcConfig[];
  admin: boolean;
  /** Chỉ có khi người xem là Admin. */
  power: PcPowerModel | null;
  issuedCodes: string[];
}) {
  const t = useTranslations('pcVision.catalog');
  const locale = useLocale();
  const en = locale === 'en';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [dialog, setDialog] = useState<
    { kind: 'add'; draft: PcConfigDraft | null } | { kind: 'config'; config: PcConfig } | { kind: 'frame'; frame: PcFrame } | null
  >(null);

  const groups = useMemo(() => {
    const q = query.trim().toUpperCase();
    return frames
      .filter((frame) => status === 'all' || frame.status === status || configs.some((c) => c.frameId === frame.id && c.status === status))
      .map((frame) => {
        const haystack = [frame.chassisPn, frame.cpu, frame.gpu, gpuLabel(frame.gpu), frame.nameVi, frame.nameEn ?? ''].join(' ').toUpperCase();
        const rows = configs.filter(
          (c) =>
            c.frameId === frame.id &&
            (status === 'all' || c.status === status || (status === 'retired' && frame.status === 'retired')) &&
            (q === '' || haystack.includes(q) || c.code.includes(q) || c.shortName.toUpperCase().includes(q))
        );
        return { frame, rows };
      })
      .filter((g) => g.rows.length > 0 || (q === '' && admin && status !== 'retired'));
  }, [frames, configs, query, status, admin]);

  const visibleCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const pick = (vi: string | null, enText: string | null) => (en ? enText || vi : vi) ?? '';

  return (
    <div className="space-y-4">
      <p className="max-w-4xl text-sm text-slate-600 dark:text-slate-400">
        {t('intro')} {admin ? t('introAdmin') : null}
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <PanelHeader
          title={t('panelTitle')}
          meta={t('count', { configs: visibleCount, frames: groups.length })}
          actions={
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                className="w-52 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                aria-label={t('statusFilter')}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {(['active', 'retired', 'all'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              {admin ? (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'add', draft: null })}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {t('add')}
                </button>
              ) : null}
            </>
          }
        />

        <div className="overflow-x-auto">
          {/* Mã dài ~60 ký tự: trên điện thoại cuộn ngang trong khung thay vì bẻ mã thành cột chữ. */}
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <th className="w-20 px-3 py-2">{t('col.config')}</th>
                <th className="px-3 py-2">{t('col.code')}</th>
                <th className="w-16 px-3 py-2 text-right">{t('col.ram')}</th>
                <th className="w-24 px-3 py-2 text-right">{t('col.ssd')}</th>
                <th className="w-24 px-3 py-2 text-right">{t('col.data')}</th>
                {admin ? <th className="w-14 px-3 py-2" /> : null}
              </tr>
            </thead>
            {groups.map(({ frame, rows }) => (
              <tbody key={frame.id}>
                <tr className="border-t border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/50">
                  <td colSpan={admin ? 6 : 5} className="px-3 py-2">
                    {/* Chốt 2026-11-04: thông số khung là một dòng chữ xám, không viên màu; chỉ RAM/SSD
                        dòng thường hoặc chưa rõ mới tô vàng. Một điểm nhấn duy nhất: ô chữ cấp. */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center text-sm font-semibold">
                        <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                          {frame.tier}
                        </span>
                        {pick(frame.nameVi, frame.nameEn)}
                      </span>
                      <span className={PC_INFO_CLASS}>
                        {[
                          frame.cpu.replace('-', ' '),
                          frame.gpu === '0' ? t('noGpu') : t('gpu', { gpu: gpuLabel(frame.gpu), vram: frame.vramGb }),
                          t('psu', { w: frame.psuW }),
                          frame.cardSlots === 0 && frame.lanPorts === 0 ? t('noCapture') : t('ports', { lan: frame.lanPorts, slots: frame.cardSlots }),
                        ].join(' · ')}
                        {' · '}
                        {frame.ramLine === 'I' && frame.ssdLine === 'I' ? (
                          t('lineIndustrial')
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            {frame.ramLine === '?' || frame.ssdLine === '?' ? t('lineUnknown') : t('lineCommercial')}
                          </span>
                        )}
                        {frame.status === 'retired' ? ` · ${t('status.retired')}` : null}
                      </span>
                      {admin ? (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'frame', frame })}
                          className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          {t('editFrame')}
                        </button>
                      ) : null}
                    </div>
                    <p className={`mt-1 ${PC_INFO_CLASS}`}>
                      {[
                        pick(frame.useForVi, frame.useForEn) && t('useFor', { text: pick(frame.useForVi, frame.useForEn) }),
                        pick(frame.notForVi, frame.notForEn) && t('notFor', { text: pick(frame.notForVi, frame.notForEn) }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      {pick(frame.noteVi, frame.noteEn) ? ` · ${pick(frame.noteVi, frame.noteEn)}` : null}
                    </p>
                  </td>
                </tr>
                {rows.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-100 dark:border-slate-800 ${c.status === 'retired' ? 'opacity-60' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 pl-5 font-semibold">
                      {c.shortName}
                      {c.status === 'retired' ? <span className={`ml-1 ${PC_INFO_CLASS}`}>({t('status.retired')})</span> : null}
                    </td>
                    {/* Bảng PC Vision: ô 13px, tiêu đề cột 12px (chốt 2026-11-04 — 14px chênh tiêu đề quá); kiểu chữ ở styles.ts. */}
                    <td className="px-3 py-1.5">
                      <PcCodeParts frame={frame} config={c} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{c.ramGb}GB</td>
                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{sizeLabel(c.ssdGb)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">
                      {c.dataKind === null || c.dataGb === null ? (
                        <span className={PC_INFO_CLASS}>—</span>
                      ) : (
                        <>
                          {c.dataKind === 'H' ? 'HDD ' : ''}
                          {sizeLabel(c.dataGb)} <span className={PC_INFO_CLASS}>({c.dataLine})</span>
                        </>
                      )}
                    </td>
                    {admin ? (
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'config', config: c })}
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        >
                          {t('edit')}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          {visibleCount === 0 ? <p className={`px-4 py-6 ${NOTE_CLASS}`}>{t('empty')}</p> : null}
        </div>
      </section>

      <p className={`max-w-4xl ${NOTE_CLASS}`}>{t('footnote')}</p>

      {dialog?.kind === 'add' && power ? (
        <PcConfigDialog
          mode="add"
          frames={frames}
          configs={configs}
          issuedCodes={issuedCodes}
          power={power}
          draft={dialog.draft}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'config' && power ? (
        <PcConfigDialog
          mode="edit"
          frames={frames}
          configs={configs}
          issuedCodes={issuedCodes}
          power={power}
          config={dialog.config}
          onCopy={(draft) => setDialog({ kind: 'add', draft })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'frame' ? <PcFrameDialog frame={dialog.frame} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
