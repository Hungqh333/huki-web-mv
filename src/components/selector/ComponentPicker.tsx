'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  listAccessories,
  listPcOptions,
  pickCamera,
  pickCameraCable,
  pickCameraPowerCable,
  pickController,
  pickInterfaceCard,
  pickLens,
  pickLight,
  pickLightCable,
  pickLightController,
  pickSoftware,
  pickTube,
  type ComponentChoice,
} from '@/lib/components/match';
import { SPEC_FIELDS, SUMMARY_KEYS, specString, type Component } from '@/lib/components/specs';
import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { analyseAppearance, maxExposureForBlur, requiredPixels, verifyResolution } from '@/lib/vision';
import { appearanceInputFromForm } from '@/lib/vision/fromInput';
import { VisionChecks } from './VisionChecks';

/**
 * Danh mục vật tư, trình bày theo đúng định dạng đội kỹ thuật đang dùng khi lên
 * báo giá (xem "Bom list vision.xlsx"): một BẢNG phẳng, gom thành ba cụm
 * VISION / MÁY TÍNH / KHÁC, mỗi dòng một vật tư kèm số lượng.
 *
 * Trước đây phần này là chín thẻ lớn, mỗi thẻ có huy hiệu icon, nhiều dòng chú
 * thích — đọc thì đẹp nhưng chọn cấu hình thì chậm. Bảng đọc nhanh hơn hẳn, và
 * quan trọng hơn: nó khớp với thứ người dùng vẫn phải gõ lại vào Excel.
 *
 * Cụm VISION nhân theo SỐ BỘ vision (dự án thật hay có 2 camera cho 2 trạm),
 * còn máy tính và phần mềm dùng chung nên luôn là 1.
 */

const selectClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/** Thông số ngắn gọn để nhận ra thiết bị — đúng vai trò cột "Thông số kĩ thuật". */
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

const round = (value: number) => Math.round(value * 10) / 10;

type Group = 'vision' | 'pc' | 'other';

type Row = {
  key: string;
  group: Group;
  choice: ComponentChoice<unknown>;
  /** true = máy suy ra từ thông số bài toán; false = người dùng tự quyết. */
  computed: boolean;
  /** Một dòng ngắn giải thích, chỉ hiện khi mở phần chi tiết. */
  why: string | null;
  /** Cụm không cần trong cấu hình hiện tại (ví dụ tube). */
  skipped?: boolean;
};

export function ComponentPicker({
  result,
  input,
  components,
}: {
  result: SelectorResult;
  input: SelectorInput;
  components: Component[];
}) {
  const t = useTranslations('selector.picker');

  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [pcOptions, setPcOptions] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [stationsOverride, setStationsOverride] = useState<number | null>(null);

  const metric = (key: string) => result.derived.find((d) => d.key === key)?.value ?? null;
  const requiredMp = metric('required_sensor_mp');
  const dataRate = metric('data_rate_mbytes_s');
  const fovWidth = typeof input.fov_width_mm === 'number' ? input.fov_width_mm : null;
  const workingDistance =
    typeof input.working_distance_mm === 'number' ? input.working_distance_mm : null;
  const needsColor = input.color_critical === true;
  const needTelecentric = /telecentric/i.test(result.lens ?? '');
  const needsGpu = result.approach === 'deep_learning';

  const appearance = appearanceInputFromForm(input);
  const need = appearance ? requiredPixels(appearance) : null;

  /* Số bộ vision: suy từ chiều dài cần phủ, nhưng cho sửa tay — dự án thật hay
     có hai trạm soi hai mặt, việc đó không suy ra được từ thông số. */
  const computedStations =
    appearance?.totalLengthMm && appearance.totalLengthMm > 0
      ? Math.ceil(
          appearance.totalLengthMm / (appearance.fovWidthMm * (1 - appearance.overlapRatio))
        )
      : 1;
  const stations = stationsOverride ?? computedStations;

  const resolve = (key: string, choice: ComponentChoice<unknown>): Component | null => {
    const options = choice.chosen ? [choice.chosen, ...choice.alternatives] : choice.alternatives;
    return options.find((c) => c.code === picked[key]) ?? choice.chosen;
  };

  const wantsLineScan = appearance?.captureMode === 'line_scan';

  const cameraChoice = pickCamera(components, {
    requiredMp,
    dataRateMbytesS: dataRate,
    needsColor,
    requiredWidthPx: need?.nx ?? null,
    requiredHeightPx: wantsLineScan ? null : (need?.ny ?? null),
    cameraType: appearance ? (wantsLineScan ? 'line' : 'area') : null,
  });
  const camera = resolve('camera', cameraChoice);
  const cameraInterface = camera ? specString(camera.spec, 'interface') : null;

  const lensChoice = pickLens(components, {
    camera,
    fovWidthMm: fovWidth,
    workingDistanceMm: workingDistance,
    needTelecentric,
  });
  const lens = resolve('lens', lensChoice);

  const tubeChoice = pickTube(components, {
    lens,
    workingDistanceMm: workingDistance,
    magnification: lensChoice.fit.targetMagnification,
  });

  const lightChoice = pickLight(components, { lightingText: result.lighting });

  const cameraLike = camera
    ? {
        cameraType: (specString(camera.spec, 'camera_type') ?? 'area') as 'area' | 'line',
        widthPx: (camera.spec.resolution_w_px as number) ?? 0,
        heightPx: (camera.spec.resolution_h_px as number) ?? 0,
        lineWidthPx: (camera.spec.line_width_px as number) ?? null,
        maxLineRateKhz: (camera.spec.max_line_rate_khz as number) ?? null,
        pixelSizeUm: (camera.spec.pixel_size_um as number) ?? null,
        sensorFormat: specString(camera.spec, 'sensor_format'),
        interfaceName: cameraInterface,
      }
    : null;

  const verdict = cameraLike && appearance ? verifyResolution(cameraLike, appearance) : null;
  const mmPerPx = verdict ? Math.max(verdict.mmPerPxX, verdict.mmPerPxY) : null;
  const blur =
    appearance?.captureMode === 'moving_area' && appearance.speedMmS && mmPerPx
      ? maxExposureForBlur({ blurPx: appearance.blurPx, mmPerPx, speedMmS: appearance.speedMmS })
      : null;
  const needsStrobe = appearance?.captureMode === 'line_scan' || (blur?.needsStrobe ?? false);

  const rows: Row[] = [
    {
      key: 'camera',
      group: 'vision',
      choice: cameraChoice,
      computed: true,
      why:
        [
          requiredMp !== null ? t('fitCamera', { required: round(requiredMp) }) : null,
          dataRate !== null ? t('fitRate', { rate: round(dataRate) }) : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    {
      key: 'lens',
      group: 'vision',
      choice: lensChoice,
      computed: true,
      why:
        needTelecentric && lensChoice.fit.targetMagnification !== null
          ? t('fitLensMag', { target: round(lensChoice.fit.targetMagnification) })
          : lensChoice.fit.targetFocalMm !== null
            ? t('fitLensFocal', { target: round(lensChoice.fit.targetFocalMm) })
            : null,
    },
    {
      key: 'tube',
      group: 'vision',
      choice: tubeChoice,
      computed: true,
      skipped: !tubeChoice.fit.needed,
      why:
        tubeChoice.fit.needed && workingDistance !== null && tubeChoice.fit.lensMinWdMm !== null
          ? t('fitTube', {
              min: tubeChoice.fit.lensMinWdMm,
              actual: workingDistance,
              length: tubeChoice.fit.requiredLengthMm ?? '—',
            })
          : null,
    },
    {
      key: 'light',
      group: 'vision',
      choice: lightChoice,
      computed: false,
      why: lightChoice.fit.lightType
        ? t('fitLightType', { type: lightChoice.fit.lightType })
        : t('fitLightUnknown'),
    },
    {
      key: 'cableCameraData',
      group: 'vision',
      choice: pickCameraCable(components, { interfaceName: cameraInterface }),
      computed: true,
      why: cameraInterface ? t('fitCableCamera', { connector: cameraInterface }) : null,
    },
    {
      key: 'cableCameraPower',
      group: 'vision',
      choice: pickCameraPowerCable(components),
      computed: false,
      why: null,
    },
    {
      key: 'cableLight',
      group: 'vision',
      choice: pickLightCable(components),
      computed: false,
      why: null,
    },
    {
      key: 'pc',
      group: 'pc',
      choice: pickController(components, {
        interfaceName: cameraInterface,
        dataRateMbytesS: dataRate,
        needsGpu,
      }),
      computed: true,
      why: needsGpu ? t('fitGpu') : null,
    },
    {
      key: 'interfaceCard',
      group: 'pc',
      choice: pickInterfaceCard(components, {
        interfaceName: cameraInterface,
        cameraCount: stations,
      }),
      computed: true,
      why: cameraInterface ? t('fitCableCamera', { connector: cameraInterface }) : null,
    },
    {
      key: 'software',
      group: 'pc',
      choice: pickSoftware(components, { needsDeepLearning: needsGpu }),
      computed: false,
      why: needsGpu ? t('fitSoftwareDl') : null,
    },
    {
      key: 'lightController',
      group: 'other',
      choice: pickLightController(components, { lightCount: stations, needsStrobe }),
      computed: true,
      why: t('fitLightController', {
        channels: stations,
        strobe: needsStrobe ? t('strobeRequired') : t('strobeNotRequired'),
      }),
    },
  ];

  /* Đổi camera là đổi cảm biến và giao tiếp — mọi thứ suy ra từ nó phải được
     gợi ý lại, nếu không người dùng giữ nguyên một cấu hình đã hết hợp lệ. */
  const change = (key: string, code: string) => {
    setPicked((current) => {
      const next = { ...current, [key]: code || null };
      if (key === 'camera') {
        next.lens = null;
        next.tube = null;
        next.cableCameraData = null;
        next.pc = null;
        next.interfaceCard = null;
      }
      if (key === 'lens') next.tube = null;
      return next;
    });
  };

  const toggle = (list: string[], set: (v: string[]) => void, code: string) =>
    set(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);

  const analysis = appearance
    ? analyseAppearance(
        appearance,
        cameraLike,
        lens ? { imageCircleFormat: specString(lens.spec, 'image_circle') } : null
      )
    : null;

  const GROUPS: Group[] = ['vision', 'pc', 'other'];
  let index = 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t('title')}</h3>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">{t('groups.vision')}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={stations}
            onChange={(event) => setStationsOverride(Number(event.target.value) || 1)}
            title={t('stationsHint')}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="text-slate-600 dark:text-slate-400">bộ</span>
        </label>
      </div>

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
            {GROUPS.map((group) => {
              const groupRows = rows.filter((row) => row.group === group);
              if (groupRows.length === 0) return null;
              const qty = group === 'vision' ? stations : 1;

              return (
                <Fragment key={group}>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/50">
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold tracking-wide">
                      {t(`groups.${group}`)}
                      {group === 'vision' && stations > 1 ? (
                        <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                          {t('stations', { count: stations })}
                        </span>
                      ) : null}
                    </td>
                  </tr>

                  {groupRows.map((row) => {
                    index += 1;
                    const options = row.choice.chosen
                      ? [row.choice.chosen, ...row.choice.alternatives]
                      : row.choice.alternatives;
                    const chosen = resolve(row.key, row.choice);

                    return (
                      <tr key={row.key} className={row.skipped ? 'opacity-50' : undefined}>
                        <td className="py-2 pl-3 align-top text-xs text-slate-400">{index}</td>

                        <td className="py-2 pr-3 align-top">
                          <span>{t(`rows.${row.key}`)}</span>
                          <span
                            className={`ml-1.5 text-[10px] ${
                              row.computed
                                ? 'text-sky-600 dark:text-sky-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {row.computed ? t('computedShort') : t('suggestedShort')}
                          </span>
                          {showWhy && row.why ? (
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {row.why}
                            </p>
                          ) : null}
                        </td>

                        <td className="py-2 pr-3 align-top">
                          {row.skipped ? (
                            <span className="text-slate-500 dark:text-slate-400">
                              {t('notNeeded')}
                            </span>
                          ) : options.length === 0 ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              {t('noOption')}
                            </span>
                          ) : (
                            <select
                              value={chosen?.code ?? ''}
                              onChange={(event) => change(row.key, event.target.value)}
                              aria-label={t(`rows.${row.key}`)}
                              className={selectClass}
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
                          {row.skipped || !chosen ? '—' : summarise(chosen) || '—'}
                        </td>

                        <td className="py-2 pr-3 text-right align-top tabular-nums">
                          {row.skipped ? '—' : qty}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}

            {/* Hàng đi kèm máy tính và phụ kiện: tích chọn, không phải chọn một trong nhiều. */}
            <OptionRows
              title={t('pcOptionsTitle')}
              items={listPcOptions(components)}
              selected={pcOptions}
              onToggle={(code) => toggle(pcOptions, setPcOptions, code)}
              startIndex={index}
            />
            <OptionRows
              title={t('extrasTitle')}
              items={listAccessories(components)}
              selected={extras}
              onToggle={(code) => toggle(extras, setExtras, code)}
              startIndex={index + listPcOptions(components).length}
            />
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{t('legend')}</span>
        <button
          type="button"
          onClick={() => setShowWhy((current) => !current)}
          className="rounded px-2 py-1 text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
          aria-expanded={showWhy}
        >
          {t('detailsToggle')}
        </button>
      </div>

      {analysis ? (
        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
          <VisionChecks analysis={analysis} hasCamera={camera !== null} />
        </div>
      ) : null}
    </div>
  );
}

/** Nhóm vật tư chọn bằng cách tích — Windows, Office, màn hình, phụ kiện thêm. */
function OptionRows({
  title,
  items,
  selected,
  onToggle,
  startIndex,
}: {
  title: string;
  items: Component[];
  selected: string[];
  onToggle: (code: string) => void;
  startIndex: number;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <tr className="bg-slate-100/70 dark:bg-slate-800/50">
        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold tracking-wide">
          {title}
        </td>
      </tr>
      {items.map((item, offset) => (
        <tr key={item.code} className={selected.includes(item.code) ? undefined : 'opacity-60'}>
          <td className="py-2 pl-3 align-top text-xs text-slate-400">{startIndex + offset + 1}</td>
          <td className="py-2 pr-3 align-top" colSpan={2}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.includes(item.code)}
                onChange={() => onToggle(item.code)}
                className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              <span>
                {item.model} <span className="text-slate-500 dark:text-slate-400">— {item.brand}</span>
              </span>
            </label>
          </td>
          <td className="py-2 pr-3 align-top text-xs text-slate-600 dark:text-slate-400">—</td>
          <td className="py-2 pr-3 text-right align-top tabular-nums">
            {selected.includes(item.code) ? 1 : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}
