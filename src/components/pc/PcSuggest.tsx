'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { PcSuggestResponse } from '@/app/actions/pcSuggest';
import { NOTE_CLASS, PanelHeader } from '@/components/ui/PanelHeader';
import { PcCodeParts } from './PcCode';
import { PcCopyButton } from './PcCopyButton';
import { PC_INFO_CLASS } from './styles';
import type { PcConfig, PcFrame } from '@/lib/pc/code';
import {
  PC_BITS,
  PC_IMAGE_FORMATS,
  PC_INTERFACE_KEYS,
  PC_INTERFACE_LABEL,
  PC_RESOLUTION_KEYS,
  resolutionLabel,
  type PcInterface,
  type PcResolution,
} from '@/lib/pc/options';
import type { PcNote, PcSuggestInput, PcSuggestResult } from '@/lib/pc/suggest';

const DEBOUNCE_MS = 250;

type Camera = { id: number; name: string; resolution: PcResolution; color: boolean; poe: boolean; bit: number; fps: number; iface: PcInterface; inspectPerSec: number };
type Storage = NonNullable<PcSuggestInput['storage']>;

export type PcSuggestPrefill = { count: number; iface: PcInterface; rate: number | null; gpu: boolean };

/** Mặc định như mẫu đã duyệt: hai camera GigE, AI suy luận, 24/7, không tính lưu ảnh. */
const DEFAULT_CAMERAS: Omit<Camera, 'id' | 'name'>[] = [
  { resolution: '2448x2048', color: false, poe: true, bit: 8, fps: 10, iface: 'GigE', inspectPerSec: 2 },
  { resolution: '4096x3000', color: false, poe: true, bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 },
];
/** GigE / 2.5G / 5G: mặc định PoE từ card trong máy; giao tiếp khác luôn nguồn ngoài (chốt 2026-11-04). */
const GIGE_FAMILY = new Set<PcInterface>(['GigE', '2.5GigE', '5GigE']);
const DEFAULT_STORAGE: Storage = { hoursPerDay: 20, ngPercent: 1, ngDays: 30, ngFormat: 'png', okDays: 7, okEveryN: 10, okFormat: 'jpeg' };

/** GB làm tròn lên 1 chữ số — RAM không bao giờ hiện thấp hơn số tính ra. */
const gb1 = (gb: number) => (Math.ceil(gb * 10) / 10).toFixed(1);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[13px] dark:border-slate-700 dark:bg-slate-900';
const PANEL = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';

/**
 * Tab "Gợi ý cấu hình" (mẫu duyệt 03/11/2026). Mọi phép tính ở máy chủ (`run` = suggestPcAction):
 * trang chỉ giữ ô nhập và vẽ kết quả; tên khung / mã cấu hình lấy từ danh mục Member đã được xem.
 */
export function PcSuggest({
  frames,
  configs,
  run,
  prefill,
}: {
  frames: PcFrame[];
  configs: PcConfig[];
  run: (input: PcSuggestInput) => Promise<PcSuggestResponse>;
  prefill?: PcSuggestPrefill;
}) {
  const t = useTranslations('pcVision.suggest');
  const [cameras, setCameras] = useState<Camera[]>(() => {
    const base = prefill
      ? Array.from({ length: Math.min(prefill.count, 64) }, () => ({ ...DEFAULT_CAMERAS[0], iface: prefill.iface, poe: GIGE_FAMILY.has(prefill.iface) }))
      : DEFAULT_CAMERAS;
    return base.map((c, i) => ({ ...c, id: i, name: '' }));
  });
  const [ai, setAi] = useState<PcSuggestInput['ai']>(prefill ? (prefill.gpu ? 'inference' : 'none') : 'inference');
  const [line247, setLine247] = useState(true);
  const [storageOn, setStorageOn] = useState(false);
  const [storage, setStorage] = useState<Storage>(DEFAULT_STORAGE);

  const [result, setResult] = useState<PcSuggestResult | null>(null);
  const [error, setError] = useState<'denied' | 'invalid' | 'failed' | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef(0);

  // Gom thay đổi rồi hỏi máy chủ; chỉ nhận câu trả lời của lần hỏi mới nhất.
  useEffect(() => {
    const id = ++request.current;
    const input: PcSuggestInput = {
      cameras: cameras.map(({ resolution, color, poe, bit, fps, iface, inspectPerSec }) => ({ resolution, color, poe: poe && GIGE_FAMILY.has(iface), bit, fps: clamp(fps, 0, 100_000), iface, inspectPerSec: clamp(inspectPerSec, 0, 100_000) })),
      ai,
      line247,
      // Ô trống / số ngoài khoảng → kẹp lại, để máy chủ không trả "ô nhập chưa hợp lệ" khi đang gõ.
      storage: storageOn
        ? {
            ...storage,
            hoursPerDay: clamp(storage.hoursPerDay, 0, 24),
            ngPercent: clamp(storage.ngPercent, 0, 100),
            ngDays: clamp(storage.ngDays, 0, 3650),
            okDays: clamp(storage.okDays, 0, 3650),
            okEveryN: clamp(storage.okEveryN, 1, 1_000_000),
          }
        : null,
    };
    const timer = setTimeout(() => {
      setPending(true);
      run(input)
        .then((response) => {
          if (id !== request.current) return;
          if (response.status === 'ok') {
            setResult(response.result);
            setError(null);
          } else setError(response.status);
        })
        .catch(() => id === request.current && setError('failed'))
        .finally(() => id === request.current && setPending(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [cameras, ai, line247, storageOn, storage, run]);

  const setCam = (id: number, patch: Partial<Camera>) => setCameras((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addCamera = () =>
    setCameras((list) => [...list, { ...DEFAULT_CAMERAS[0], id: list.reduce((max, c) => Math.max(max, c.id), -1) + 1, name: '' }]);
  const frameById = new Map(frames.map((f) => [f.id, f]));
  const configById = new Map(configs.map((c) => [c.id, c]));
  const note = (n: PcNote) => t(`notes.${n.key}` as 'notes.aux', n.values ?? {});
  const fits = result?.frames.filter((f) => f.level !== 'no') ?? [];
  const rejected = result?.frames.filter((f) => f.level === 'no') ?? [];

  return (
    <div className="space-y-5">
      <p className="max-w-4xl text-sm text-slate-600 dark:text-slate-400">{t('intro')}</p>
      {prefill ? (
        <p className="max-w-4xl rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          {t('prefill', { count: prefill.count, iface: PC_INTERFACE_LABEL[prefill.iface], rate: prefill.rate ? t('prefillRate', { rate: prefill.rate }) : '' })}
        </p>
      ) : null}

      {/* ── Camera của dự án ── */}
      <section className={PANEL}>
        <PanelHeader
          title={t('cameraPanel')}
          meta={t('cameraMeta', { n: cameras.length })}
          actions={
            <button type="button" onClick={addCamera} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
              {t('addCamera')}
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <th className="px-3 py-2">{t('col.name')}</th>
                <th className="px-3 py-2">{t('col.resolution')}</th>
                <th className="px-3 py-2">{t('col.color')}</th>
                <th className="px-3 py-2">{t('col.bit')}</th>
                <th className="px-3 py-2">{t('col.fps')}</th>
                <th className="px-3 py-2">{t('col.iface')}</th>
                <th className="px-3 py-2">{t('col.power')}</th>
                {storageOn ? <th className="px-3 py-2">{t('col.inspect')}</th> : null}
                <th className="px-3 py-2 text-right">{t('col.bandwidth')}</th>
                <th className="px-3 py-2 text-right">{t('col.port')}</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam, i) => {
                const r = result?.cameras[i];
                return (
                  <tr key={cam.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="px-3 py-1.5">
                      <input value={cam.name} placeholder={t('camName', { n: i + 1 })} onChange={(e) => setCam(cam.id, { name: e.target.value })} className={INPUT} />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={cam.resolution} onChange={(e) => setCam(cam.id, { resolution: e.target.value as PcResolution })} className={INPUT}>
                        {PC_RESOLUTION_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {resolutionLabel(k)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={cam.color ? 'color' : 'mono'} onChange={(e) => setCam(cam.id, { color: e.target.value === 'color' })} className={INPUT}>
                        <option value="mono">{t('colorOption.mono')}</option>
                        <option value="color">{t('colorOption.color')}</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={cam.bit} onChange={(e) => setCam(cam.id, { bit: Number(e.target.value) })} className={INPUT}>
                        {PC_BITS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="w-24 px-3 py-1.5">
                      <input type="number" min={0} value={cam.fps} onChange={(e) => setCam(cam.id, { fps: Number(e.target.value) })} className={INPUT} />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={cam.iface}
                        // Đổi giao tiếp → nguồn về mặc định: GigE dùng PoE, loại khác nguồn ngoài.
                        onChange={(e) => {
                          const iface = e.target.value as PcInterface;
                          setCam(cam.id, { iface, poe: GIGE_FAMILY.has(iface) });
                        }}
                        className={INPUT}
                      >
                        {PC_INTERFACE_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {PC_INTERFACE_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {GIGE_FAMILY.has(cam.iface) ? (
                        <select value={cam.poe ? 'poe' : 'external'} onChange={(e) => setCam(cam.id, { poe: e.target.value === 'poe' })} className={INPUT}>
                          <option value="poe">{t('powerOption.poe')}</option>
                          <option value="external">{t('powerOption.external')}</option>
                        </select>
                      ) : (
                        // USB3 lấy nguồn qua cáp USB (tính vào nguồn máy); loại khác nguồn ngoài — chốt 2026-11-04.
                        <span className={`block whitespace-nowrap px-2 py-1 ${PC_INFO_CLASS}`}>{t(cam.iface === 'USB3' ? 'powerOption.usb' : 'powerOption.external')}</span>
                      )}
                    </td>
                    {storageOn ? (
                      <td className="w-24 px-3 py-1.5">
                        <input type="number" min={0} step={0.1} value={cam.inspectPerSec} onChange={(e) => setCam(cam.id, { inspectPerSec: Number(e.target.value) })} className={INPUT} />
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{r ? `${r.mbps.toFixed(0)} MB/s` : '…'}</td>
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                        r ? (r.overShare ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300') : ''
                      }`}
                    >
                      {r ? `${Math.round(r.portShare * 100)}%` : '…'}
                      {r?.maxFps !== null && r?.maxFps !== undefined ? <div className="text-[11px]">{t('maxFps', { fps: r.maxFps })}</div> : null}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        aria-label={t('removeCamera')}
                        title={t('removeCamera')}
                        onClick={() => setCameras((list) => list.filter((c) => c.id !== cam.id))}
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 px-4 py-3 sm:grid-cols-3 dark:border-slate-800">
          <Labeled label={t('ai')}>
            <select value={ai} onChange={(e) => setAi(e.target.value as PcSuggestInput['ai'])} className={INPUT}>
              {(['none', 'inference', 'training'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`aiOption.${v}`)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={t('line247')}>
            <select value={line247 ? 'yes' : 'no'} onChange={(e) => setLine247(e.target.value === 'yes')} className={INPUT}>
              <option value="yes">{t('line247Option.yes')}</option>
              <option value="no">{t('line247Option.no')}</option>
            </select>
          </Labeled>
          <Labeled label={t('storageToggle')}>
            <select value={storageOn ? 'yes' : 'no'} onChange={(e) => setStorageOn(e.target.value === 'yes')} className={INPUT}>
              <option value="no">{t('storageOption.no')}</option>
              <option value="yes">{t('storageOption.yes')}</option>
            </select>
          </Labeled>
        </div>

        {storageOn ? (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="mb-2 text-xs">
              <b>{t('storageTitle')}</b> <span className={PC_INFO_CLASS}>· {t('storageHint')}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {(['hoursPerDay', 'ngPercent', 'ngDays'] as const).map((key) => (
                <NumberField key={key} label={t(key)} value={storage[key]} step={key === 'ngPercent' ? 0.1 : 1} onChange={(v) => setStorage({ ...storage, [key]: v })} />
              ))}
              <FormatField label={t('ngFormat')} value={storage.ngFormat} onChange={(v) => setStorage({ ...storage, ngFormat: v })} />
              {(['okDays', 'okEveryN'] as const).map((key) => (
                <NumberField key={key} label={t(key)} value={storage[key]} onChange={(v) => setStorage({ ...storage, [key]: v })} />
              ))}
              <FormatField label={t('okFormat')} value={storage.okFormat} onChange={(v) => setStorage({ ...storage, okFormat: v })} />
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t(`errors.${error}`)}</p>
      ) : null}

      {/* ── Kết quả tính ── */}
      <section className={PANEL}>
        <PanelHeader title={t('resultPanel')} meta={pending ? t('computing') : undefined} />
        {cameras.length === 0 ? (
          <p className={`px-4 py-4 ${NOTE_CLASS}`}>{t('noCameras')}</p>
        ) : result ? (
          <div className="grid grid-cols-2 gap-3 px-4 py-4 lg:grid-cols-4">
            <Tile value={`${result.totalMbps.toFixed(0)} MB/s`} label={t('tile.bandwidth')} />
            <Tile
              value={`${gb1(result.ramGb)} GB`}
              label={
                <>
                  {t('tile.ram')}
                  <br />
                  {t('tile.ramParts', {
                    parts: [
                      t('tile.ramBase', { gb: gb1(result.ram.baseGb) }),
                      t('tile.ramBuffer', { gb: gb1(result.ram.bufferGb) }),
                      ...(result.ram.aiGb > 0 ? [t('tile.ramAi', { gb: gb1(result.ram.aiGb) })] : []),
                      ...(result.ram.trainGb > 0 ? [t('tile.ramTrain', { gb: gb1(result.ram.trainGb) })] : []),
                    ].join(' + '),
                    sum: gb1(result.ram.sumGb),
                    pct: Math.round(result.ram.maxUse * 100),
                  })}
                </>
              }
            />
            {result.storage ? (
              <Tile
                value={`${result.storage.totalTb.toFixed(2)} TB`}
                label={
                  <>
                    {t('tile.storage', { ng: result.storage.ngTb.toFixed(2), ok: result.storage.okTb.toFixed(2) })}
                    <br />
                    {t('tile.raw', { raw: result.storage.rawTb.toFixed(1) })}
                  </>
                }
              />
            ) : null}
            <Tile value={t('tile.slots', { n: result.slots })} label={t('tile.slotsLabel')} />
            {/* Công suất tổng của cấu hình được gợi ý (thẻ đầu tiên) — chốt 2026-11-04 Q3. */}
            {fits[0] ? (
              <Tile
                value={t('tile.power', { w: Math.round(fits[0].power.loadW * 10) / 10 })}
                label={t('tile.powerLabel', {
                  name: configById.get(fits[0].configId ?? '')?.shortName ?? frameById.get(fits[0].frameId)?.slug ?? '',
                  pct: Math.round(fits[0].power.share * 100),
                  psu: fits[0].power.psuW,
                })}
              />
            ) : (
              <Tile value="—" label={t('tile.powerNone')} />
            )}
          </div>
        ) : null}
      </section>

      {/* ── Cấu hình phù hợp ── */}
      {result && cameras.length > 0 ? (
        <section className={PANEL}>
          <PanelHeader title={t('fitPanel')} meta={t('fitMeta')} />
          <div className="space-y-2 px-4 py-4 text-[13px]">
            {fits.map((v, j) => {
              const frame = frameById.get(v.frameId);
              const config = v.configId ? configById.get(v.configId) : undefined;
              if (!frame) return null;
              return (
                <div
                  key={v.frameId}
                  className={`rounded-xl border border-l-4 border-slate-200 px-3 py-2.5 dark:border-slate-700 ${v.level === 'ok' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{config?.shortName}</b>
                    <FrameName frame={frame} />
                    <span
                      className={`rounded-full px-2 py-px text-[11px] font-medium ${
                        v.level === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {t(`level.${v.level === 'ok' ? 'ok' : 'warn'}`)}
                    </span>
                    {/* "Gợi ý": chữ thường, không thêm viên màu — mức Đạt / Lưu ý đã có viên riêng. */}
                    {j === 0 ? <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{t('recommended')}</span> : null}
                    {config ? (
                      <span className="ml-auto">
                        <PcCopyButton frame={frame} config={config} />
                      </span>
                    ) : null}
                  </div>
                  {config ? (
                    <p className="mt-1">
                      <PcCodeParts frame={frame} config={config} />
                    </p>
                  ) : null}
                  <ul className="mt-1.5 space-y-0.5">
                    {v.warn.map((n) => (
                      <li key={n.key} className="text-amber-700 dark:text-amber-400">! {note(n)}</li>
                    ))}
                    {v.info.map((n) => (
                      <li key={n.key} className="text-sky-700 dark:text-sky-400">i {note(n)}</li>
                    ))}
                    {v.ok.map((n) => (
                      <li key={n.key} className={PC_INFO_CLASS}>✓ {note(n)}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {fits.length === 0 ? <p className="text-sm text-red-600 dark:text-red-400">{t('noneFits')}</p> : null}
            {rejected.length > 0 ? (
              <details className="pt-1">
                <summary className={`cursor-pointer ${NOTE_CLASS}`}>{t('rejected', { n: rejected.length })}</summary>
                <div className="mt-2 space-y-2">
                  {rejected.map((v) => {
                    const frame = frameById.get(v.frameId);
                    return frame ? (
                      <div key={v.frameId} className="rounded-xl border border-l-4 border-slate-200 border-l-red-500 px-3 py-2 opacity-80 dark:border-slate-700">
                        <FrameName frame={frame} />
                        <ul className="mt-1 space-y-0.5">
                          {v.no.map((n) => (
                            <li key={n.key} className="text-red-600 dark:text-red-400">✕ {note(n)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FrameName({ frame }: { frame: PcFrame }) {
  const en = useLocale() === 'en';
  return (
    <span className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
      <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-indigo-600 px-1 text-[11px] font-semibold text-white">{frame.tier}</span>
      {en ? frame.nameEn || frame.nameVi : frame.nameVi}
    </span>
  );
}

function Tile({ value, label }: { value: string; label: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className={PC_INFO_CLASS}>{label}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col justify-end gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Labeled label={label}>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={INPUT} />
    </Labeled>
  );
}

function FormatField({ label, value, onChange }: { label: string; value: Storage['ngFormat']; onChange: (v: Storage['ngFormat']) => void }) {
  const t = useTranslations('pcVision.suggest');
  return (
    <Labeled label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as Storage['ngFormat'])} className={INPUT}>
        {PC_IMAGE_FORMATS.map((f) => (
          <option key={f} value={f}>
            {t(`format.${f}`)}
          </option>
        ))}
      </select>
    </Labeled>
  );
}
