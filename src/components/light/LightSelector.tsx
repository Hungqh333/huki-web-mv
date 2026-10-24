'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import type { LightSelectResponse } from '@/app/actions/lights';
import { renderFormula } from '@/lib/vision/formulaTerms';
import {
  COLORS,
  DENT_DEPTHS,
  LIGHT_FINISHES,
  LIGHT_MATERIALS,
  LIGHT_PURPOSES,
  LIGHT_SHAPES,
  LIGHT_TASKS,
  MATERIALS,
  SILHOUETTE_FEATURES,
  TASK_FEATURES,
  type LightMaterial,
  type LightTask,
} from '@/lib/vision/lightOptions';
import type { LightCandidate, LightCheck, LightSelection, LightSelectorInput } from '@/lib/vision/lightSelector';
import type { CheckStatus } from '@/lib/vision/types';
import { CameraView, LightingSection, RAY_HEX, TopView } from './LightingIllustrations';
import { COLOR_REFERENCES, GENERAL_REFERENCES, TYPE_REFERENCES, photoReferenceFor, type LightingReference } from './references';

/**
 * Giao diện Bộ chọn đèn (chốt 2026-10-22). KHÔNG tính gì ở trình duyệt: mỗi lần đổi ô nhập
 * gửi lên server action (`run`) và hiện kết quả trả về (Q1). Chỉ import danh sách lựa chọn
 * (lightOptions.ts) và kiểu dữ liệu — không import bảng luật.
 */

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  info: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  fail: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};

const PAGE = 30;
const DEBOUNCE_MS = 250;

/** Ô nhập theo 5 bước của bản 2 (chốt 2026-10-22, docs/NHAP_CHON_DEN_V2.md). Chuỗi rỗng = chưa chọn. */
type Form = {
  task: string;
  feature: string;
  dentDepth: string;
  backlightable: boolean;
  material: string;
  finish: string;
  shape: string;
  cameraColor: string;
  featureColor: string;
  backgroundColor: string;
  purpose: string;
  fineDetail: boolean;
  ambientVaries: boolean;
  fovW: string;
  fovH: string;
};
const EMPTY: Form = {
  task: '',
  feature: '',
  dentDepth: 'visible',
  backlightable: true,
  material: '',
  finish: '',
  shape: '',
  cameraColor: '',
  featureColor: '',
  backgroundColor: '',
  purpose: '',
  fineDetail: false,
  ambientVaries: false,
  fovW: '',
  fovH: '',
};

const num = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

function toInput(form: Form): LightSelectorInput {
  const pick = <T extends string>(value: string) => (value === '' ? null : (value as T));
  return {
    task: pick(form.task),
    feature: pick(form.feature),
    dentDepth: form.feature === 'dent_bump' ? pick(form.dentDepth) : null,
    backlightable: form.backlightable,
    material: pick(form.material),
    finish: pick(form.finish),
    shape: pick(form.shape),
    cameraColor: pick(form.cameraColor),
    featureColor: pick(form.featureColor),
    backgroundColor: pick(form.backgroundColor),
    purpose: pick(form.purpose),
    fineDetail: form.fineDetail,
    ambientVaries: form.ambientVaries,
    fovWidthMm: num(form.fovW),
    fovHeightMm: num(form.fovH),
  };
}

function StatusBadge({ status, suggest = false }: { status: CheckStatus; suggest?: boolean }) {
  const t = useTranslations('lightSelector.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(suggest ? 'suggest' : status)}</span>;
}

export function LightSelector({ run }: { run: (input: LightSelectorInput) => Promise<LightSelectResponse> }) {
  const t = useTranslations('lightSelector');
  const locale = useLocale();

  const [form, setForm] = useState<Form>(EMPTY);
  const [selection, setSelection] = useState<LightSelection | null>(null);
  const [error, setError] = useState<'denied' | 'invalid' | 'failed' | null>(null);
  const [pending, setPending] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  /** Hình minh hoạ đang vẽ đèn chính hay đèn thay thế. */
  const [shown, setShown] = useState<'main' | 'alt'>('main');
  const request = useRef(0);

  // Gom phím gõ rồi hỏi máy chủ; chỉ nhận câu trả lời của lần hỏi mới nhất.
  useEffect(() => {
    const id = ++request.current;
    const timer = setTimeout(() => {
      setPending(true);
      run(toInput(form))
        .then((response) => {
          if (id !== request.current) return;
          if (response.status === 'ok') {
            setSelection(response.selection);
            setError(null);
          } else setError(response.status);
        })
        .catch(() => {
          if (id === request.current) setError('failed');
        })
        .finally(() => {
          if (id === request.current) setPending(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form, run]);

  const changed = () => {
    setLimit(PAGE);
    setOpen(null);
    setShown('main');
  };
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    changed();
  };
  /** Đổi bài toán: "cần thấy gì" không thuộc bài toán mới thì bỏ chọn. */
  const setTask = (task: string) => {
    setForm((prev) => ({
      ...prev,
      task,
      feature: task && (TASK_FEATURES[task as LightTask] as readonly string[]).includes(prev.feature) ? prev.feature : '',
    }));
    changed();
  };
  /** Đổi vật liệu: điền sẵn bề mặt, hình dạng, màu nền gợi ý (mục 3 của nháp) — sửa lại được. */
  const setMaterial = (material: string) => {
    setForm((prev) => {
      const preset = material ? MATERIALS[material as LightMaterial] : null;
      return {
        ...prev,
        material,
        finish: preset?.finish ?? prev.finish,
        shape: preset?.shape ?? prev.shape,
        backgroundColor: preset?.color ?? prev.backgroundColor,
      };
    });
    changed();
  };
  const features = form.task ? TASK_FEATURES[form.task as LightTask] : [];
  const canBacklight = form.task !== '' && form.task !== 'inspect' && SILHOUETTE_FEATURES.includes(form.feature);

  const typeName = (type: string | null) => (type ? t(`types.${type}` as never) : '—');
  const colorName = (color: string | null) => (color ? t(`colors.${color}` as never) : '—');
  const colorWord = (key: string) => t(`colors13.${key}` as never).toLocaleLowerCase(locale);
  /** Câu ghi chú: giá trị {feature} / {background} là khoá màu → đổi sang tên màu đúng ngôn ngữ. */
  const note = (check: LightCheck) => {
    if (!check.noteKey) return null;
    const values = { ...(check.noteValues ?? {}) };
    for (const k of ['feature', 'background'] as const) if (typeof values[k] === 'string') values[k] = colorWord(values[k] as string);
    return t(`notes.${check.noteKey}` as never, values as never);
  };

  const all = selection?.candidates ?? [];
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  const visible = showRejected ? all : all.filter((c) => c.status !== 'fail');
  const type = selection?.type ?? null;
  const color = selection?.color ?? null;
  const shownType = type ? (shown === 'alt' && type.alternativeType ? type.alternativeType : type.lightType) : null;
  const openCandidate = all.find((c) => c.id === open) ?? null;
  const fov = toInput(form);
  const shownSize = selection?.sizes.find((s) => s.lightType === shownType) ?? null;
  // Hình C: đèn đang mở Chi tiết (đúng kiểu đang vẽ) thì vẽ cỡ thật của nó, không thì cỡ tối thiểu.
  const topLight =
    openCandidate && openCandidate.lightType === shownType && openCandidate.sizeMm !== null
      ? { mm: openCandidate.sizeMm, shortMm: openCandidate.sizeShortMm, name: `${openCandidate.brand} ${openCandidate.model}` }
      : shownSize
        ? { mm: shownSize.mm, shortMm: null, name: null }
        : null;
  const references: LightingReference[] = [
    ...(shownType ? (TYPE_REFERENCES[shownType] ?? []) : []),
    ...(color && color.color !== 'white' ? COLOR_REFERENCES : []),
    ...GENERAL_REFERENCES,
  ].filter((ref, i, list) => list.findIndex((r) => r.url === ref.url) === i);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setShowRejected(false);
            setLimit(PAGE);
            setOpen(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ↺ {t('reset')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── 1–2. Bài toán, cần thấy gì ── */}
        <Panel id="light-task" title={t('task.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput id="light-task-type" label={t('task.task')} value={form.task} onChange={setTask} empty={t('task.choose')}>
              {LIGHT_TASKS.map((task) => (
                <option key={task} value={task}>
                  {t(`tasks.${task}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-feature" label={t('task.feature')} value={form.feature} onChange={set('feature')} empty={form.task ? t('task.choose') : t('task.chooseTaskFirst')}>
              {features.map((f) => (
                <option key={f} value={f}>
                  {t(`features.${f}` as never)}
                </option>
              ))}
            </SelectInput>
            {form.feature === 'dent_bump' ? (
              <SelectInput id="light-depth" label={t('task.depth')} value={form.dentDepth} onChange={set('dentDepth')} empty={t('task.choose')}>
                {DENT_DEPTHS.map((d) => (
                  <option key={d} value={d}>
                    {t(`depths.${d}`)}
                  </option>
                ))}
              </SelectInput>
            ) : null}
            <SelectInput id="light-camera" label={t('task.camera')} value={form.cameraColor} onChange={set('cameraColor')} empty={t('task.unknown')}>
              <option value="mono">{t('task.cameraMono')}</option>
              <option value="color">{t('task.cameraColor')}</option>
            </SelectInput>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput id="light-fov-w" label={t('task.fovW')} value={form.fovW} onChange={set('fovW')} />
              <NumberInput id="light-fov-h" label={t('task.fovH')} value={form.fovH} onChange={set('fovH')} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {canBacklight ? <CheckInput id="light-backlight" label={t('task.backlightable')} checked={form.backlightable} onChange={set('backlightable')} /> : null}
            <CheckInput id="light-fine" label={t('task.fineDetail')} checked={form.fineDetail} onChange={set('fineDetail')} />
            <CheckInput id="light-ambient" label={t('task.ambient')} checked={form.ambientVaries} onChange={set('ambientVaries')} />
          </div>
        </Panel>

        {/* ── 3–5. Vật liệu, bề mặt, màu ── */}
        <Panel id="light-object" title={t('object.title')} note={t('object.note')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput id="light-material" label={t('object.material')} value={form.material} onChange={setMaterial} empty={t('task.choose')}>
              {LIGHT_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {t(`materials.${m}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-finish" label={t('object.finish')} value={form.finish} onChange={set('finish')} empty={t('task.choose')}>
              {LIGHT_FINISHES.map((f) => (
                <option key={f} value={f}>
                  {t(`finishes.${f}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-shape" label={t('object.shape')} value={form.shape} onChange={set('shape')} empty={t('task.choose')}>
              {LIGHT_SHAPES.map((sh) => (
                <option key={sh} value={sh}>
                  {t(`shapes.${sh}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-purpose" label={t('object.purpose')} value={form.purpose} onChange={set('purpose')} empty={t('object.purposeNone')}>
              {LIGHT_PURPOSES.map((pp) => (
                <option key={pp} value={pp}>
                  {t(`purposes.${pp}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-feature-color" label={t('object.featureColor')} value={form.featureColor} onChange={set('featureColor')} empty={t('object.colorNone')}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {t(`colors13.${c}`)}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="light-bg-color" label={t('object.backgroundColor')} value={form.backgroundColor} onChange={set('backgroundColor')} empty={t('object.colorNone')}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {t(`colors13.${c}`)}
                </option>
              ))}
            </SelectInput>
          </div>
          <p className={`mt-3 ${NOTE_CLASS}`}>{t('object.hint')}</p>
        </Panel>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {t(`errors.${error}`)}
        </p>
      ) : null}

      {/* ── Gợi ý chiếu sáng ── */}
      <Panel id="light-suggestion" title={t('suggestion.title')} meta={pending ? t('suggestion.computing') : undefined} note={t('suggestion.note')}>
        {!selection ? (
          <p className={NOTE_CLASS}>{t('suggestion.loading')}</p>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('suggestion.type')} {type ? <RuleTag id={type.ruleId} /> : null}
                </dt>
                <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {type ? typeName(type.lightType) : '—'}
                  {type?.alternativeType ? <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">{t('suggestion.or', { name: typeName(type.alternativeType) })}</span> : null}
                </dd>
                <dd className={`mt-0.5 ${NOTE_CLASS}`}>
                  {type ? t(`reasons.${type.reasonKey}` as never) : t('suggestion.typeMissing')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('suggestion.color')} {color?.ruleId ? <RuleTag id={color.ruleId} /> : null}
                </dt>
                <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {colorName(color?.color ?? null)}
                  {color?.wavelengthNm ? <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">{color.wavelengthNm} nm</span> : null}
                  {color?.alternative ? <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">{t('suggestion.or', { name: colorName(color.alternative) })}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('suggestion.size')}</dt>
                {selection.sizes.length === 0 ? (
                  <dd className={`mt-0.5 ${NOTE_CLASS}`}>{t(type ? 'suggestion.sizeNeedFov' : 'suggestion.sizeNeedType')}</dd>
                ) : (
                  selection.sizes.map((s) => (
                    <dd key={s.lightType} className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold">≥ {Math.ceil(s.mm)} mm</span> <span className={NOTE_CLASS}>{t(s.diagonal ? 'suggestion.sizeDiagonal' : 'suggestion.sizeLong', { type: typeName(s.lightType) })}</span>
                    </dd>
                  ))
                )}
              </div>
            </dl>
            <ul className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {selection.checks.map((check, i) => (
                <CheckLine key={`${check.ruleId}-${check.key}-${i}`} check={check} label={t(`checks.${check.key}` as never)} note={note(check)} />
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* ── Minh hoạ (chốt 2026-10-22): mặt cắt, camera thấy gì, nhìn từ trên, camera đơn sắc ── */}
      {selection && type && shownType ? (
        <Panel
          id="light-illustration"
          title={t('illus.title')}
          note={t('illus.note')}
          actions={
            type.alternativeType ? (
              <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                {(['main', 'alt'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShown(value)}
                    className={`rounded px-2.5 py-1 font-medium ${shown === value ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    {typeName(value === 'main' ? type.lightType : type.alternativeType)}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <figure>
              <LightingSection lightType={shownType} lightColor={color?.color ?? 'white'} idPrefix="light-section" />
              <figcaption className="mt-1 space-y-0.5">
                <p className="text-sm text-slate-700 dark:text-slate-200">{t(`illus.caption.${shownType}` as never)}</p>
                <p className={NOTE_CLASS}>
                  <span style={{ color: RAY_HEX[color?.color ?? 'white'] }}>━</span> {t('illus.legendLight')} ·{' '}
                  <span className="text-slate-500">┅</span> {t('illus.legendBack')} · <span className="text-sky-500">┈</span> {t('illus.legendFov')}
                </p>
                {/* Ảnh chụp thật của hãng cho kiểu đèn đang vẽ — chỉ đặt link (ảnh có bản quyền của hãng). */}
                {photoReferenceFor(shownType) ? (
                  <a
                    href={photoReferenceFor(shownType)!.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
                  >
                    {t('illus.photoButton', { publisher: photoReferenceFor(shownType)!.publisher })} ↗
                  </a>
                ) : null}
              </figcaption>
            </figure>
            <figure>
              <div className="mx-auto max-w-[280px]">
                <CameraView lightType={shownType} feature={form.feature || null} finish={form.finish || null} />
              </div>
              <figcaption className="mt-1 space-y-0.5 text-center">
                <p className="text-sm text-slate-700 dark:text-slate-200">{t('illus.viewTitle')}</p>
                <p className={NOTE_CLASS}>{form.feature ? t('illus.viewNote') : t('illus.viewNeedDefect')}</p>
              </figcaption>
            </figure>
            <figure>
              {topLight && fov.fovWidthMm && fov.fovHeightMm ? (
                <>
                  <TopView
                    lightType={shownType}
                    lightMm={topLight.mm}
                    lightShortMm={topLight.shortMm}
                    fovW={fov.fovWidthMm}
                    fovH={fov.fovHeightMm}
                    lightColor={color?.color ?? 'white'}
                  />
                  <figcaption className="mt-1 space-y-0.5">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{t('illus.topTitle')}</p>
                    <p className={NOTE_CLASS}>
                      {t('illus.topLegend', {
                        w: fov.fovWidthMm,
                        h: fov.fovHeightMm,
                        type: typeName(shownType),
                        size: Math.ceil(topLight.mm),
                        which: topLight.name ?? t('illus.topMinimum'),
                      })}
                    </p>
                  </figcaption>
                </>
              ) : (
                <p className={NOTE_CLASS}>{t('illus.topNeedFov')}</p>
              )}
            </figure>
            <figure>
              <p className="text-sm text-slate-700 dark:text-slate-200">{t('illus.monoTitle')}</p>
              {selection.preview ? (
                <table className="mt-2 w-full text-sm">
                  <thead className="text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-1 pr-2 text-left font-medium">{t('illus.monoLight')}</th>
                      <th className="py-1 pr-2 text-left font-medium">
                        {t('illus.monoFeature')} <ColorChip color={selection.preview.feature} />
                      </th>
                      {selection.preview.background ? (
                        <th className="py-1 pr-2 text-left font-medium">
                          {t('illus.monoBackground')} <ColorChip color={selection.preview.background} />
                        </th>
                      ) : null}
                      {selection.preview.background ? <th className="py-1 text-left font-medium">{t('illus.monoContrast')}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {selection.preview.rows.map((r) => (
                      <tr key={r.light} className={color?.color === r.light ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}>
                        <td className="py-1 pr-2">{colorName(r.light)}</td>
                        <td className="py-1 pr-2">
                          <GrayChip level={r.feature} />
                        </td>
                        {r.background !== null ? (
                          <td className="py-1 pr-2">
                            <GrayChip level={r.background} />
                          </td>
                        ) : null}
                        {r.contrast !== null ? <td className="py-1 tabular-nums">{r.contrast}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={`mt-1 ${NOTE_CLASS}`}>{t('illus.monoNeed')}</p>
              )}
              <p className={`mt-2 ${NOTE_CLASS}`}>{t('illus.monoNote')}</p>
            </figure>
          </div>

          {/* Ảnh mẫu tự chụp (khung D) — chưa có thì nói rõ; ảnh của hãng chỉ đặt link. */}
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('illus.samplesTitle')}</p>
            {selection.samples.length === 0 ? (
              <p className={`mt-1 ${NOTE_CLASS}`}>{t(form.feature ? 'illus.samplesNone' : 'illus.samplesNeedDefect')}</p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selection.samples.map((sample) => (
                  <figure key={sample.id} className={`rounded-lg p-2 ${sample.lightType === type.lightType ? 'ring-2 ring-sky-500' : 'ring-1 ring-slate-200 dark:ring-slate-700'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ */}
                    <img src={sample.url} alt={sample.caption ?? typeName(sample.lightType)} className="w-full rounded" loading="lazy" />
                    <figcaption className="mt-1 space-y-0.5 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{typeName(sample.lightType)}</span>
                        {/* Độ khớp với bài toán đang nhập (chốt 2026-10-23 Q2). */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sample.match.kind === 'exact' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                          {sample.match.kind === 'exact'
                            ? t('illus.matchExact', { score: sample.match.score, total: sample.match.total })
                            : t('illus.matchGeneral')}
                        </span>
                      </span>
                      <span className={`block ${NOTE_CLASS}`}>
                        {[
                          sample.labels.feature ? t(`features.${sample.labels.feature}` as never) : null,
                          sample.labels.material ? t(`materials.${sample.labels.material}` as never) : null,
                          sample.labels.finish ? t(`finishes.${sample.labels.finish}` as never) : null,
                          sample.labels.shape ? t(`shapes.${sample.labels.shape}` as never) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {/* Thông số setting khi chụp — cách lắp thực tế, Member+ xem được (Q3). */}
                      {(() => {
                        const st = sample.settings;
                        const parts = [
                          st.lightColor ? colorName(st.lightColor) : null,
                          st.lightModel,
                          st.angle,
                          st.distanceMm ? t('illus.settingDistance', { mm: st.distanceMm }) : null,
                          st.exposureUs ? t('illus.settingExposure', { us: st.exposureUs }) : null,
                          st.camera,
                          st.lens,
                        ].filter(Boolean);
                        return parts.length ? <span className="block text-xs text-slate-700 dark:text-slate-200">{t('illus.settings')}: {parts.join(' · ')}</span> : null;
                      })()}
                      {sample.caption ? <span className={`block ${NOTE_CLASS}`}>{sample.caption}</span> : null}
                      {sample.source ? <span className="block text-[11px] text-slate-400">{t('illus.sampleSource', { source: sample.source })}</span> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-200">{t('illus.refsTitle')}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {references.map((ref) => (
                <li key={ref.url}>
                  <a href={ref.url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
                    {ref.publisher} — {ref.title} ↗
                  </a>
                  {ref.photos ? (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">{t('illus.hasPhotos')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className={`mt-1 ${NOTE_CLASS}`}>{t('illus.refsNote')}</p>
          </div>
        </Panel>
      ) : null}

      {/* ── Đèn trong kho ── */}
      {selection ? (
        <Panel
          id="light-list"
          title={t('list.title')}
          meta={t('list.meta', { ...counts, total: selection.stock.total })}
          note={
            selection.stock.both === 0 && selection.stock.total > 0
              ? t('list.noneInStock', {
                  type: type ? (type.alternativeType ? `${typeName(type.lightType)} / ${typeName(type.alternativeType)}` : typeName(type.lightType)) : t('list.anyType'),
                  color: color ? (color.alternative ? `${colorName(color.color)} / ${colorName(color.alternative)}` : colorName(color.color)) : '—',
                })
              : undefined
          }
          actions={
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
              {t('list.showRejected')}
            </label>
          }
          bodyClassName=""
        >
          {visible.length === 0 ? (
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t('list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="py-2 pl-4 pr-3 font-medium">{t('list.colLight')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colType')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colColor')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colSize')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <LightRow
                      key={c.id}
                      candidate={c}
                      open={open === c.id}
                      onToggle={() => setOpen(open === c.id ? null : c.id)}
                      typeName={typeName}
                      colorName={colorName}
                      note={note}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > limit ? (
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                {t('list.showMore', { n: Math.min(PAGE, visible.length - limit) })}
              </button>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

/** Màu để người xem nhận ra (hình B) — không phải số đo. */
const COLOR_HEX: Record<string, string> = {
  white: '#FFFFFF',
  gray: '#9A9A96',
  black: '#1F1F1E',
  red: '#E24B4A',
  orange: '#EF8B2C',
  yellow: '#F2C94C',
  green: '#4E9A2A',
  cyan: '#3FC1C9',
  blue: '#2F6FD0',
  purple: '#7F57C8',
  magenta: '#D94BB0',
  brown: '#8A5A2B',
  gold: '#C9A227',
};

function ColorChip({ color }: { color: string }) {
  return <span className="ml-1 inline-block size-3.5 rounded-sm align-middle ring-1 ring-slate-300 dark:ring-slate-600" style={{ background: COLOR_HEX[color] }} />;
}

/** Ô xám theo độ sáng 0–2 trên camera đơn sắc (0 đen · 2 trắng). */
function GrayChip({ level }: { level: number }) {
  const v = Math.round(30 + (level / 2) * 210);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-4 w-7 rounded-sm ring-1 ring-slate-300 dark:ring-slate-600" style={{ background: `rgb(${v},${v},${v})` }} />
      <span className="tabular-nums text-xs">{level}</span>
    </span>
  );
}

function RuleTag({ id }: { id: string }) {
  return <span className="ml-1 font-mono text-[11px] font-normal text-slate-400 dark:text-slate-500">{id}</span>;
}

function CheckLine({ check, label, note }: { check: LightCheck; label: string; note: string | null }) {
  const tTerms = useTranslations('selector.vision.formulaTerms');
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {/* Dòng chọn màu là gợi ý, không phải phép kiểm — không ghi "Chưa kiểm được". */}
      <StatusBadge status={check.status} suggest={check.status === 'info' && check.key === 'lightColor'} />
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
      <RuleTag id={check.ruleId} />
      {/* Máy chủ chỉ gửi công thức cho admin. */}
      {check.formula ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(check.formula, (key) => tTerms(key))}</span> : null}
      {note ? <span className="w-full text-sm text-slate-600 dark:text-slate-300">{note}</span> : null}
    </li>
  );
}

function LightRow({
  candidate: c,
  open,
  onToggle,
  typeName,
  colorName,
  note,
}: {
  candidate: LightCandidate;
  open: boolean;
  onToggle: () => void;
  typeName: (type: string | null) => string;
  colorName: (color: string | null) => string;
  note: (check: LightCheck) => string | null;
}) {
  const t = useTranslations('lightSelector');
  return (
    <Fragment>
      <tr className={c.status === 'fail' ? 'opacity-60' : undefined}>
        <td className="py-2 pl-4 pr-3">
          <button type="button" onClick={onToggle} aria-expanded={open} className="text-left font-medium text-slate-900 hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-400">
            {c.brand} {c.model}
          </button>
          <div className={NOTE_CLASS}>{c.code}</div>
        </td>
        <td className="py-2 pr-3">{typeName(c.lightType)}</td>
        <td className="py-2 pr-3">{colorName(c.color)}</td>
        <td className="py-2 pr-3 tabular-nums">{c.sizeMm === null ? '—' : c.sizeShortMm ? `${c.sizeMm} × ${c.sizeShortMm} mm` : `${c.sizeMm} mm`}</td>
        <td className="py-2 pr-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <button type="button" onClick={onToggle} className="text-xs text-sky-700 hover:underline dark:text-sky-400">
              {open ? t('list.hide') : t('list.details')}
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50/60 dark:bg-slate-900/60">
          <td colSpan={5} className="px-4 py-3">
            <ul className="space-y-2">
              {c.checks.map((check, i) => (
                <CheckLine key={`${check.key}-${i}`} check={check} label={t(`checks.${check.key}` as never)} note={note(check)} />
              ))}
            </ul>
            {c.datasheetUrl ? (
              <a href={c.datasheetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400">
                {t('list.datasheet')} ↗
              </a>
            ) : null}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function SelectInput({
  id,
  label,
  value,
  onChange,
  empty,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`}>
        <option value="">{empty}</option>
        {children}
      </select>
    </div>
  );
}

function NumberInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`} />
    </div>
  );
}

function CheckInput({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
      {label}
    </label>
  );
}
