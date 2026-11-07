'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { updatePcFrameAction } from '@/app/actions/pcVision';
import { NOTE_CLASS } from '@/components/ui/PanelHeader';
import { PC_TIERS, frameCodeHead, type PcFrame, type PcLine } from '@/lib/pc/code';
import { PC_SPEC_KEYS, pcSpecRow, type PcFrameSpec } from '@/lib/pc/specSheet';
import { PcCode } from './PcCode';
import { Buttons, INPUT, Labeled, Modal, Section, Select } from './PcConfigDialog';

/** Sửa khung: chỉ phần không tạo mã. Dòng RAM/SSD chỉ đổi được khi đang là '?' (CSDL chặn phần còn lại). */
export function PcFrameDialog({ frame, onClose }: { frame: PcFrame; onClose: () => void }) {
  const t = useTranslations('pcVision.form');
  const tCatalog = useTranslations('pcVision.catalog');
  const en = useLocale() === 'en';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({
    tier: frame.tier,
    nameVi: frame.nameVi,
    nameEn: frame.nameEn ?? '',
    cardSlots: frame.cardSlots,
    lanPorts: frame.lanPorts,
    peakLoadW: frame.peakLoadW,
    useForVi: frame.useForVi ?? '',
    useForEn: frame.useForEn ?? '',
    notForVi: frame.notForVi ?? '',
    notForEn: frame.notForEn ?? '',
    noteVi: frame.noteVi ?? '',
    noteEn: frame.noteEn ?? '',
    status: frame.status,
    ramLine: frame.ramLine,
    ssdLine: frame.ssdLine,
  });
  const [spec, setSpec] = useState<Record<keyof PcFrameSpec, string>>(
    () => Object.fromEntries(PC_SPEC_KEYS.map((k) => [k, frame.spec[k] ?? ''])) as Record<keyof PcFrameSpec, string>
  );
  const tSpec = useTranslations('pcVision.form.spec');
  const text = (key: 'nameVi' | 'nameEn' | 'useForVi' | 'useForEn' | 'notForVi' | 'notForEn' | 'noteVi' | 'noteEn') => (
    <Labeled label={t(key === 'nameVi' ? 'frameNameVi' : key === 'nameEn' ? 'frameNameEn' : key)}>
      <input value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className={INPUT} />
    </Labeled>
  );
  const lineOptions = (current: PcLine) =>
    (current === '?' ? (['?', 'I', 'C'] as const) : ([current] as const)).map((l) => [l, t(`line.${l === '?' ? 'unknown' : l}`)] as const);

  const save = () =>
    startTransition(async () => {
      const result = await updatePcFrameAction({ id: frame.id, ...v, spec });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        const code = result.errors[0] ?? 'invalid';
        setError(code === 'db' ? t('errors.db', { message: result.message ?? '' }) : t(`errors.${code}` as 'errors.invalid'));
      }
    });

  return (
    <Modal title={t('frameTitle', { name: `${frame.tier} · ${en ? frame.nameEn || frame.nameVi : frame.nameVi}` })} onClose={onClose}>
      <p className="rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:bg-indigo-950/50 dark:text-slate-100">
        <PcCode text={`${frameCodeHead(frame)}-R…${frame.ramLine}-S…${frame.ssdLine}-…-${frame.os}`} />
      </p>
      <p className={`mt-2 ${NOTE_CLASS}`}>{t('frameLockedNote')}</p>
      <Section title="">
        <Labeled label={t('tier')}>
          <Select value={v.tier} onChange={(x) => setV({ ...v, tier: x })} options={PC_TIERS.map((x) => [x, x])} />
        </Labeled>
        {text('nameVi')}
        {text('nameEn')}
        <Labeled label={t('slots')}>
          <input type="number" min={0} max={12} value={v.cardSlots} onChange={(e) => setV({ ...v, cardSlots: Number(e.target.value) })} className={INPUT} />
        </Labeled>
        <Labeled label={t('lan')}>
          <input type="number" min={0} max={12} value={v.lanPorts} onChange={(e) => setV({ ...v, lanPorts: Number(e.target.value) })} className={INPUT} />
        </Labeled>
        <Labeled label={t('peak')}>
          <input type="number" min={0} max={9999} value={v.peakLoadW} onChange={(e) => setV({ ...v, peakLoadW: Number(e.target.value) })} className={INPUT} />
        </Labeled>
        {text('useForVi')}
        {text('useForEn')}
        {text('notForVi')}
        {text('notForEn')}
        {text('noteVi')}
        {text('noteEn')}
        <Labeled label={t('ramLine')}>
          <Select value={v.ramLine} onChange={(x) => setV({ ...v, ramLine: x as PcLine })} options={lineOptions(frame.ramLine)} disabled={frame.ramLine !== '?'} />
        </Labeled>
        <Labeled label={t('ssdLine')}>
          <Select value={v.ssdLine} onChange={(x) => setV({ ...v, ssdLine: x as PcLine })} options={lineOptions(frame.ssdLine)} disabled={frame.ssdLine !== '?'} />
        </Labeled>
        <Labeled label={t('status')}>
          <Select
            value={v.status}
            onChange={(x) => setV({ ...v, status: x === 'retired' ? 'retired' : 'active' })}
            options={(['active', 'retired'] as const).map((s) => [s, tCatalog(`status.${s}`)])}
          />
        </Labeled>
      </Section>
      {/* Chữ cố định cho nút "Copy thông số" (form PC gốc, chốt 2026-11-07); số W / GB / CPU / GPU / HĐH lấy từ mã. */}
      <Section title={tSpec('title')}>
        {PC_SPEC_KEYS.filter((k) => k !== 'io').map((k) => (
          <Labeled key={k} label={tSpec(k)}>
            <input value={spec[k]} maxLength={600} onChange={(e) => setSpec({ ...spec, [k]: e.target.value })} className={INPUT} />
          </Labeled>
        ))}
      </Section>
      <div className="mt-2.5">
        <Labeled label={tSpec('io')}>
          <textarea rows={3} value={spec.io} maxLength={600} onChange={(e) => setSpec({ ...spec, io: e.target.value })} className={INPUT} />
        </Labeled>
      </div>
      <p className={`mt-2 ${NOTE_CLASS}`}>{tSpec('note')}</p>
      <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        {pcSpecRow(
          { ...frame, spec: Object.fromEntries(Object.entries(spec).filter(([, x]) => x.trim())) as PcFrameSpec },
          { code: `${frameCodeHead(frame)}-…`, ramGb: 16, ssdGb: 512, dataKind: null, dataGb: null }
        ).spec}
      </pre>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">✕ {error}</p> : null}
      <Buttons pending={pending} canSave={v.nameVi.trim() !== ''} onCancel={onClose} onSave={save} />
    </Modal>
  );
}
