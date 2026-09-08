'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { listPcOptions, pickSoftware } from '@/lib/components/match';
import { planPcForLines, type VisionLine } from '@/lib/components/pc';
import {
  INTERFACE_BANDWIDTH,
  SPEC_FIELDS,
  SUMMARY_KEYS,
  type Component,
} from '@/lib/components/specs';

/**
 * Cấu hình máy tính dùng chung cho NHIỀU bài toán.
 *
 * Vì sao là trang riêng chứ không phải một cụm trong bảng vật tư của từng bài
 * toán: một dự án thật hay có ba bài toán — căn chỉnh, đo lường, kiểm tra
 * ngoại quan — chạy trên CÙNG một máy. Để mỗi bài toán tự sinh dòng máy tính
 * của nó thì báo giá ra ba máy, trong khi thực tế chỉ mua một.
 *
 * Người dùng nhập mỗi bài toán một dòng; trang này cộng lại rồi mới chọn máy.
 */

const INTERFACES = Object.keys(INTERFACE_BANDWIDTH);

const inputClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function summarise(component: Component): string {
  const keys = SUMMARY_KEYS[component.kind] ?? [];
  return (SPEC_FIELDS[component.kind] ?? [])
    .filter((field) => keys.includes(field.key))
    .map((field) => {
      const value = component.spec[field.key];
      if (value === undefined || value === null || value === '') return null;
      return `${value}${field.unit ? ` ${field.unit}` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

let nextId = 0;
const newLine = (seed?: Partial<VisionLine>): VisionLine => ({
  id: `line-${(nextId += 1)}`,
  label: '',
  cameraCount: 1,
  interfaceName: 'GigE',
  dataRateMbytesS: null,
  needsGpu: false,
  ...seed,
});

export function PcPlanner({
  components,
  initialLines,
}: {
  components: Component[];
  /** Dòng đầu tiên điền sẵn khi người dùng bấm sang từ bảng vật tư của một bài toán. */
  initialLines?: Partial<VisionLine>[];
}) {
  const t = useTranslations('pcPlanner');

  const [lines, setLines] = useState<VisionLine[]>(() =>
    initialLines && initialLines.length > 0
      ? initialLines.map((seed) => newLine(seed))
      : [newLine({ label: '' })]
  );
  const [pickedPc, setPickedPc] = useState<string | null>(null);
  const [pickedCards, setPickedCards] = useState<Record<string, string>>({});
  const [pcOptions, setPcOptions] = useState<string[]>([]);
  const [pickedSoftware, setPickedSoftware] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<VisionLine>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...changes } : line))
    );

  const preview = planPcForLines(components, lines);

  const findIn = (choice: { chosen: Component | null; alternatives: Component[] }, code: string | null) => {
    const options = choice.chosen ? [choice.chosen, ...choice.alternatives] : choice.alternatives;
    return options.find((item) => item.code === code) ?? choice.chosen;
  };

  const chosenPc = findIn(preview.pc, pickedPc);
  const chosenCards: Record<string, Component | null> = {};
  for (const card of preview.cards) {
    chosenCards[card.interfaceName] = findIn(card.choice, pickedCards[card.interfaceName] ?? null);
  }

  const plan = planPcForLines(components, lines, { pc: chosenPc, cards: chosenCards });

  const softwareChoice = pickSoftware(components, { needsDeepLearning: plan.needsGpu });
  const software = findIn(softwareChoice, pickedSoftware);
  const options = listPcOptions(components);

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------- BÀI TOÁN VÀO -- */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t('linesTitle')}</h2>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, newLine()])}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t('addLine')}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('linesHint')}</p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-2 pl-3 font-medium">
                  {t('colLabel')}
                </th>
                <th scope="col" className="w-24 py-2 pr-3 font-medium">
                  {t('colCameras')}
                </th>
                <th scope="col" className="w-32 py-2 pr-3 font-medium">
                  {t('colInterface')}
                </th>
                <th scope="col" className="w-28 py-2 pr-3 font-medium">
                  {t('colRate')}
                </th>
                <th scope="col" className="w-20 py-2 pr-3 font-medium">
                  {t('colGpu')}
                </th>
                <th scope="col" className="w-10 py-2 pr-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="py-2 pl-3 pr-3">
                    <input
                      type="text"
                      value={line.label}
                      placeholder={t('labelPlaceholder', { n: index + 1 })}
                      onChange={(event) => patch(line.id, { label: event.target.value })}
                      aria-label={t('colLabel')}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={line.cameraCount}
                      onChange={(event) =>
                        patch(line.id, { cameraCount: Math.max(0, Number(event.target.value) || 0) })
                      }
                      aria-label={t('colCameras')}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={line.interfaceName ?? ''}
                      onChange={(event) =>
                        patch(line.id, { interfaceName: event.target.value || null })
                      }
                      aria-label={t('colInterface')}
                      className={inputClass}
                    >
                      {INTERFACES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={line.dataRateMbytesS ?? ''}
                      placeholder="—"
                      onChange={(event) =>
                        patch(line.id, {
                          dataRateMbytesS:
                            event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                      aria-label={t('colRate')}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={line.needsGpu}
                      onChange={(event) => patch(line.id, { needsGpu: event.target.checked })}
                      aria-label={t('colGpu')}
                      className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) => current.filter((item) => item.id !== line.id))
                        }
                        aria-label={t('removeLine')}
                        title={t('removeLine')}
                        className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------- TỔNG HỢP -- */}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('totalCameras')} value={String(plan.totalCameras)} />
        <Stat
          label={t('totalRate')}
          value={plan.totalRateMbytesS > 0 ? `${Math.round(plan.totalRateMbytesS)} MB/s` : '—'}
        />
        <Stat
          label={t('interfacesUsed')}
          value={plan.interfaces.length > 0 ? plan.interfaces.join(' + ') : '—'}
        />
        <Stat label={t('gpuNeeded')} value={plan.needsGpu ? t('yes') : t('no')} />
      </dl>

      {plan.interfaces.length > 1 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('mixedInterfaces', { list: plan.interfaces.join(', ') })}
        </p>
      ) : null}

      {plan.splitReason ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          {t(`splitReason.${plan.splitReason}`, { max: plan.camerasPerPc, count: plan.pcCount })}
        </p>
      ) : null}

      {/* ------------------------------------------------- DANH MỤC VẬT TƯ -- */}
      <div>
        <h2 className="font-semibold">{t('bomTitle')}</h2>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" className="w-8 py-2 pl-3 font-medium">
                  #
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('colName')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('colDevice')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('colSpec')}
                </th>
                <th scope="col" className="w-12 py-2 pr-3 text-right font-medium">
                  {t('colQty')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <BomRow
                index={1}
                name={t('rows.pc')}
                choice={preview.pc}
                chosen={chosenPc}
                qty={plan.pcCount}
                onChange={(code) => setPickedPc(code || null)}
                empty={t('noOption')}
              />

              {plan.cards.map((card, offset) => (
                <BomRow
                  key={card.interfaceName}
                  index={2 + offset}
                  name={t('rows.card', { interface: card.interfaceName })}
                  choice={card.choice}
                  chosen={chosenCards[card.interfaceName] ?? null}
                  qty={card.count}
                  onChange={(code) =>
                    setPickedCards((current) => ({ ...current, [card.interfaceName]: code }))
                  }
                  empty={t('noOption')}
                />
              ))}

              <BomRow
                index={2 + plan.cards.length}
                name={t('rows.software')}
                choice={softwareChoice}
                chosen={software}
                qty={plan.pcCount}
                onChange={(code) => setPickedSoftware(code || null)}
                empty={t('noOption')}
              />

              {options.length > 0 ? (
                <Fragment>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/50">
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold tracking-wide">
                      {t('optionsTitle')}
                    </td>
                  </tr>
                  {options.map((item, offset) => {
                    const on = pcOptions.includes(item.code);
                    return (
                      <tr key={item.code} className={on ? undefined : 'opacity-60'}>
                        <td className="py-2 pl-3 align-top text-xs text-slate-400">
                          {3 + plan.cards.length + offset}
                        </td>
                        <td className="py-2 pr-3 align-top" colSpan={2}>
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setPcOptions((current) =>
                                  current.includes(item.code)
                                    ? current.filter((code) => code !== item.code)
                                    : [...current, item.code]
                                )
                              }
                              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                            />
                            <span>
                              {item.model}{' '}
                              <span className="text-slate-500 dark:text-slate-400">
                                — {item.brand}
                              </span>
                            </span>
                          </label>
                        </td>
                        <td className="py-2 pr-3 align-top text-xs text-slate-600 dark:text-slate-400">
                          —
                        </td>
                        {/* Bản quyền và màn hình tính theo MÁY, nên nhân theo số máy. */}
                        <td className="py-2 pr-3 text-right align-top tabular-nums">
                          {on ? plan.pcCount : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('bomNote')}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function BomRow({
  index,
  name,
  choice,
  chosen,
  qty,
  onChange,
  empty,
}: {
  index: number;
  name: string;
  choice: { chosen: Component | null; alternatives: Component[] };
  chosen: Component | null;
  qty: number;
  onChange: (code: string) => void;
  empty: string;
}) {
  const options = choice.chosen ? [choice.chosen, ...choice.alternatives] : choice.alternatives;

  return (
    <tr>
      <td className="py-2 pl-3 align-top text-xs text-slate-400">{index}</td>
      <td className="py-2 pr-3 align-top">{name}</td>
      <td className="py-2 pr-3 align-top">
        {options.length === 0 ? (
          <span className="text-amber-700 dark:text-amber-400">{empty}</span>
        ) : (
          <select
            value={chosen?.code ?? ''}
            onChange={(event) => onChange(event.target.value)}
            aria-label={name}
            className={inputClass}
          >
            {chosen ? null : <option value="">—</option>}
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {option.model} — {option.brand}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-2 pr-3 align-top text-xs text-slate-600 dark:text-slate-400">
        {chosen ? summarise(chosen) || '—' : '—'}
      </td>
      {/* Chưa chọn được thiết bị nào thì đừng ghi số lượng — "2" bên cạnh một ô
          trống đọc như thể đã đặt được hai cái. */}
      <td className="py-2 pr-3 text-right align-top tabular-nums">
        {chosen && qty > 0 ? qty : '—'}
      </td>
    </tr>
  );
}
