'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { addPcConfigAction, updatePcConfigAction, type PcActionResult } from '@/app/actions/pcVision';
import { NOTE_CLASS } from '@/components/ui/PanelHeader';
import { PcCode } from './PcCode';
import {
  PC_DATA_DRIVES,
  PC_GPUS,
  PC_OS,
  PC_PSU_W,
  PC_RAM_GB,
  PC_SSD_GB,
  PC_TIERS,
  PC_VRAM_GB,
  composePcCode,
  estimatePeakLoadW,
  findFrame,
  gpuLabel,
  parseDataDrive,
  pcCodeErrors,
  sizeLabel,
  type PcConfig,
  type PcFrame,
  type PcFrameKey,
  type PcPowerModel,
} from '@/lib/pc/code';

/** Giá trị form thêm cấu hình — dùng cả để "thêm cấu hình mới từ cấu hình này". */
export type PcConfigDraft = {
  chassisPn: string;
  cpu: string;
  gpu: string;
  vramGb: number;
  psuW: number;
  os: string;
  ramLine: 'I' | 'C';
  ssdLine: 'I' | 'C';
  ramGb: number;
  ssdGb: number;
  dataDrive: string | null;
  dataLine: 'I' | 'C';
  shortName: string;
};

const asLine = (line: string): 'I' | 'C' => (line === 'C' ? 'C' : 'I');

export function draftFrom(frame: PcFrame, config?: PcConfig): PcConfigDraft {
  return {
    chassisPn: frame.chassisPn,
    cpu: frame.cpu,
    gpu: frame.gpu,
    vramGb: frame.vramGb,
    psuW: frame.psuW,
    os: frame.os,
    ramLine: asLine(frame.ramLine),
    ssdLine: asLine(frame.ssdLine),
    ramGb: config?.ramGb ?? 32,
    ssdGb: config?.ssdGb ?? 512,
    dataDrive: config?.dataKind && config.dataGb ? `${config.dataKind}${config.dataGb}` : config ? null : 'D1024',
    dataLine: config?.dataLine ?? 'C',
    shortName: '',
  };
}

type Props = {
  frames: PcFrame[];
  configs: PcConfig[];
  issuedCodes: string[];
  power: PcPowerModel;
  onClose: () => void;
} & ({ mode: 'add'; draft: PcConfigDraft | null } | { mode: 'edit'; config: PcConfig; onCopy: (draft: PcConfigDraft) => void });

export function PcConfigDialog(props: Props) {
  const t = useTranslations('pcVision.form');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<{ codes: string[]; message?: string } | null>(null);

  const finish = (result: PcActionResult) => {
    if (result.ok) {
      props.onClose();
      router.refresh();
    } else {
      setServerErrors({ codes: result.errors, message: result.message });
    }
  };

  return (
    <Modal onClose={props.onClose} title={props.mode === 'add' ? t('addTitle') : t('editTitle', { name: props.config.shortName })}>
      {props.mode === 'add' ? (
        <AddForm {...props} pending={pending} onSubmit={(input) => startTransition(async () => finish(await addPcConfigAction(input)))} />
      ) : (
        <EditForm
          frames={props.frames}
          config={props.config}
          pending={pending}
          onClose={props.onClose}
          onCopy={props.onCopy}
          onSubmit={(input) => startTransition(async () => finish(await updatePcConfigAction(input)))}
        />
      )}
      {serverErrors ? (
        <div className="mt-3 space-y-1">
          {serverErrors.codes.map((code) => (
            <p key={code} className="text-sm text-red-600 dark:text-red-400">
              ✕ {code === 'db' ? t('errors.db', { message: serverErrors.message ?? '' }) : t(`errors.${code}` as 'errors.invalid')}
            </p>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}

function AddForm({
  frames,
  configs,
  issuedCodes,
  power,
  draft,
  pending,
  onClose,
  onSubmit,
}: Extract<Props, { mode: 'add' }> & { pending: boolean; onSubmit: (input: unknown) => void }) {
  const t = useTranslations('pcVision.form');
  const en = useLocale() === 'en';
  const initial = useMemo(() => {
    if (draft) return draft;
    const base = frames.find((f) => f.slug === 'C') ?? frames.find((f) => f.status === 'active') ?? frames[0];
    return base
      ? draftFrom(base)
      : ({ chassisPn: '', cpu: '', gpu: '0', vramGb: 0, psuW: 650, os: 'W11P', ramLine: 'I', ssdLine: 'I', ramGb: 32, ssdGb: 512, dataDrive: null, dataLine: 'C', shortName: '' } satisfies PcConfigDraft);
  }, [draft, frames]);

  const [v, setV] = useState<PcConfigDraft>(initial);
  const set = <K extends keyof PcConfigDraft>(key: K, value: PcConfigDraft[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const key: PcFrameKey = {
    chassisPn: v.chassisPn.trim().toUpperCase(),
    cpu: v.cpu.trim().toUpperCase(),
    gpu: v.gpu,
    vramGb: v.vramGb,
    psuW: v.psuW,
    os: v.os,
    ramLine: v.ramLine,
    ssdLine: v.ssdLine,
  };
  const drive = parseDataDrive(v.dataDrive);
  const parts = { ramGb: v.ramGb, ssdGb: v.ssdGb, dataKind: drive?.kind ?? null, dataGb: drive?.gb ?? null, dataLine: drive ? v.dataLine : null };
  const code = composePcCode(key, parts);
  const errors = pcCodeErrors(key, parts, [...issuedCodes, ...configs.map((c) => c.code)]);
  const frame = findFrame(frames, key);

  const load = estimatePeakLoadW(power, v.gpu);
  const pct = Math.round((load / v.psuW) * 100);
  const maxPct = Math.round(power.maxShare * 100);

  const [nf, setNf] = useState({ tier: 'C', nameVi: '', nameEn: '', cardSlots: 2, lanPorts: 1, peakLoadW: 0, useForVi: '', useForEn: '', notForVi: '', notForEn: '' });
  const peakLoadW = nf.peakLoadW || load;

  const canSave = errors.length === 0 && v.shortName.trim() !== '' && (frame || nf.nameVi.trim() !== '');

  const submit = () =>
    onSubmit({
      frame: key,
      config: { shortName: v.shortName.trim(), ramGb: v.ramGb, ssdGb: v.ssdGb, dataDrive: v.dataDrive, dataLine: drive ? v.dataLine : null },
      newFrame: frame ? null : { ...nf, peakLoadW },
    });

  return (
    <>
      <p className={`mb-3 ${NOTE_CLASS}`}>{t('addHint')}</p>
      <Section title={t('frameSection')}>
        <Labeled label={t('pn')}>
          <input list="pc-pn-list" value={v.chassisPn} onChange={(e) => set('chassisPn', e.target.value)} className={INPUT} />
          <datalist id="pc-pn-list">
            {[...new Set(frames.map((f) => f.chassisPn))].map((pn) => (
              <option key={pn} value={pn} />
            ))}
          </datalist>
        </Labeled>
        <Labeled label={t('cpu')}>
          <input value={v.cpu} onChange={(e) => set('cpu', e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label={t('gpu')}>
          <Select value={v.gpu} onChange={(x) => set('gpu', x)} options={PC_GPUS.map((g) => [g, g === '0' ? t('gpuNone') : gpuLabel(g)])} />
        </Labeled>
        <Labeled label={t('vram')}>
          <Select value={String(v.vramGb)} onChange={(x) => set('vramGb', Number(x))} options={PC_VRAM_GB.map((n) => [String(n), String(n)])} />
        </Labeled>
        <Labeled label={t('psu')}>
          <Select value={String(v.psuW)} onChange={(x) => set('psuW', Number(x))} options={PC_PSU_W.map((n) => [String(n), String(n)])} />
        </Labeled>
        <Labeled label={t('os')}>
          <Select value={v.os} onChange={(x) => set('os', x)} options={PC_OS.map((o) => [o, t(`osOption.${o}`)])} />
        </Labeled>
      </Section>

      <Section title={t('partsSection')}>
        <Labeled label={t('ram')}>
          <Select value={String(v.ramGb)} onChange={(x) => set('ramGb', Number(x))} options={PC_RAM_GB.map((n) => [String(n), String(n)])} />
        </Labeled>
        <Labeled label={t('ramLine')}>
          <Select value={v.ramLine} onChange={(x) => set('ramLine', asLine(x))} options={(['I', 'C'] as const).map((l) => [l, t(`line.${l}`)])} />
        </Labeled>
        <Labeled label={t('ssd')}>
          <Select value={String(v.ssdGb)} onChange={(x) => set('ssdGb', Number(x))} options={PC_SSD_GB.map((n) => [String(n), sizeLabel(n)])} />
        </Labeled>
        <Labeled label={t('ssdLine')}>
          <Select value={v.ssdLine} onChange={(x) => set('ssdLine', asLine(x))} options={(['I', 'C'] as const).map((l) => [l, t(`line.${l}`)])} />
        </Labeled>
        <Labeled label={t('data')}>
          <Select
            value={v.dataDrive ?? ''}
            onChange={(x) => set('dataDrive', x === '' ? null : x)}
            options={PC_DATA_DRIVES.map((d) => {
              const p = parseDataDrive(d);
              return [d ?? '', p ? `${p.kind === 'H' ? 'HDD' : 'SSD'} ${sizeLabel(p.gb)}` : t('dataNone')];
            })}
          />
        </Labeled>
        <Labeled label={t('dataLine')}>
          <Select value={v.dataLine} onChange={(x) => set('dataLine', asLine(x))} options={(['C', 'I'] as const).map((l) => [l, t(`line.${l}`)])} disabled={!drive} />
        </Labeled>
      </Section>

      <p className={`mt-4 mb-1 ${NOTE_CLASS}`}>{t('codeLabel')}</p>
      <p className="rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:bg-indigo-950/50 dark:text-slate-100">
        <PcCode text={code} />
      </p>
      <div className="mt-2 space-y-1 text-sm">
        {errors.length === 0 ? (
          <p className="text-emerald-700 dark:text-emerald-400">✓ {t('codeOk')}</p>
        ) : (
          errors.map((e) => (
            <p key={e} className="text-red-600 dark:text-red-400">
              ✕ {t(`errors.${e}`)}
            </p>
          ))
        )}
        <p className={pct > maxPct ? 'text-red-600 dark:text-red-400' : NOTE_CLASS}>
          {t(pct > maxPct ? 'powerOver' : 'power', { load, pct, max: maxPct })}
        </p>
        {frame ? (
          <p className="text-slate-700 dark:text-slate-300">
            {t('inFrame')}{' '}
            <b>
              {frame.tier} · {en ? frame.nameEn || frame.nameVi : frame.nameVi}
            </b>
          </p>
        ) : (
          <p className="text-sky-700 dark:text-sky-400">{t('newFrame')}</p>
        )}
      </div>

      {frame ? null : (
        <Section title="">
          <Labeled label={t('tier')}>
            <Select value={nf.tier} onChange={(x) => setNf({ ...nf, tier: x })} options={PC_TIERS.map((x) => [x, x])} />
          </Labeled>
          <Labeled label={t('frameNameVi')}>
            <input value={nf.nameVi} onChange={(e) => setNf({ ...nf, nameVi: e.target.value })} className={INPUT} />
          </Labeled>
          <Labeled label={t('frameNameEn')}>
            <input value={nf.nameEn} onChange={(e) => setNf({ ...nf, nameEn: e.target.value })} className={INPUT} />
          </Labeled>
          <Labeled label={t('slots')}>
            <input type="number" min={0} max={12} value={nf.cardSlots} onChange={(e) => setNf({ ...nf, cardSlots: Number(e.target.value) })} className={INPUT} />
          </Labeled>
          <Labeled label={t('lan')}>
            <input type="number" min={0} max={12} value={nf.lanPorts} onChange={(e) => setNf({ ...nf, lanPorts: Number(e.target.value) })} className={INPUT} />
          </Labeled>
          <Labeled label={t('peak')}>
            <input type="number" min={0} max={9999} value={peakLoadW} onChange={(e) => setNf({ ...nf, peakLoadW: Number(e.target.value) })} className={INPUT} />
          </Labeled>
          <Labeled label={t('useForVi')}>
            <input value={nf.useForVi} onChange={(e) => setNf({ ...nf, useForVi: e.target.value })} className={INPUT} />
          </Labeled>
          <Labeled label={t('useForEn')}>
            <input value={nf.useForEn} onChange={(e) => setNf({ ...nf, useForEn: e.target.value })} className={INPUT} />
          </Labeled>
          <Labeled label={t('notForVi')}>
            <input value={nf.notForVi} onChange={(e) => setNf({ ...nf, notForVi: e.target.value })} className={INPUT} />
          </Labeled>
          <Labeled label={t('notForEn')}>
            <input value={nf.notForEn} onChange={(e) => setNf({ ...nf, notForEn: e.target.value })} className={INPUT} />
          </Labeled>
        </Section>
      )}

      <Section title="">
        <Labeled label={t('shortName')}>
          <input value={v.shortName} placeholder={t('shortNamePlaceholder')} maxLength={20} onChange={(e) => set('shortName', e.target.value)} className={INPUT} />
        </Labeled>
      </Section>

      <Buttons pending={pending} canSave={Boolean(canSave)} onCancel={onClose} onSave={submit} />
    </>
  );
}

function EditForm({
  frames,
  config,
  pending,
  onClose,
  onCopy,
  onSubmit,
}: {
  frames: PcFrame[];
  config: PcConfig;
  pending: boolean;
  onClose: () => void;
  onCopy: (draft: PcConfigDraft) => void;
  onSubmit: (input: unknown) => void;
}) {
  const t = useTranslations('pcVision.form');
  const tCatalog = useTranslations('pcVision.catalog');
  const [shortName, setShortName] = useState(config.shortName);
  const [status, setStatus] = useState(config.status);
  const frame = frames.find((f) => f.id === config.frameId);

  return (
    <>
      <p className="rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:bg-indigo-950/50 dark:text-slate-100">
        <PcCode text={config.code} />
      </p>
      <p className={`mt-2 ${NOTE_CLASS}`}>{t('lockedNote')}</p>
      {frame ? (
        <button
          type="button"
          onClick={() => onCopy({ ...draftFrom(frame, config), shortName: '' })}
          className="mt-2 text-sm text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
        >
          {t('copyAsNew')}
        </button>
      ) : null}
      <Section title="">
        <Labeled label={t('shortName')}>
          <input value={shortName} maxLength={20} onChange={(e) => setShortName(e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label={t('status')}>
          <Select value={status} onChange={(x) => setStatus(x === 'retired' ? 'retired' : 'active')} options={(['active', 'retired'] as const).map((s) => [s, tCatalog(`status.${s}`)])} />
        </Labeled>
      </Section>
      <Buttons
        pending={pending}
        canSave={shortName.trim() !== ''}
        onCancel={onClose}
        onSave={() => onSubmit({ id: config.id, shortName: shortName.trim(), status })}
      />
    </>
  );
}

// ── Mảnh giao diện dùng chung cho hai hộp thoại PC Vision ──

export const INPUT =
  'block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      {title ? <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</p> : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col justify-end gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={INPUT}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function Buttons({ pending, canSave, onCancel, onSave }: { pending: boolean; canSave: boolean; onCancel: () => void; onSave: () => void }) {
  const t = useTranslations('pcVision.form');
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">
        {t('cancel')}
      </button>
      <button
        type="button"
        disabled={!canSave || pending}
        onClick={onSave}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </div>
  );
}
