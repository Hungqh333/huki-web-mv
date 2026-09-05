'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
import { pickCamera, pickController, pickLens, pickLight } from '@/lib/components/match';
import { SPEC_FIELDS, specString, type Component } from '@/lib/components/specs';
import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { analyseAppearance, requiredPixels } from '@/lib/vision';
import { appearanceInputFromForm } from '@/lib/vision/fromInput';
import { VisionChecks } from './VisionChecks';

/**
 * Chọn thiết bị cụ thể, và cho đổi sang thiết bị khác.
 *
 * Điểm cốt lõi: mỗi danh sách CHỈ chứa thiết bị tương thích với lựa chọn phía
 * trên nó. Đổi camera thì tiêu cự cần thiết đổi theo và danh sách ống kính lọc
 * lại theo cảm biến mới — nên người dùng không thể dựng ra cấu hình bất khả thi
 * bằng cách bấm bừa. Đây chính là thứ mà một wizard 5 bước rời rạc không làm được.
 *
 * Khớp thiết bị chạy ở trình duyệt bằng đúng các hàm thuần đã có test, nên đổi
 * xong thấy kết quả ngay mà không phải gọi lại server.
 */

const ROWS: {
  key: 'lighting' | 'lens' | 'camera' | 'processing';
  icon: IconName;
  tone: BadgeTone;
}[] = [
  { key: 'lighting', icon: 'sun', tone: 'amber' },
  { key: 'lens', icon: 'selector', tone: 'violet' },
  { key: 'camera', icon: 'camera', tone: 'sky' },
  { key: 'processing', icon: 'monitor', tone: 'emerald' },
];

const SOURCE_STYLES: Record<string, string> = {
  unverified: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  datasheet: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  measured: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
};

/** Tóm tắt thông số chính để nhận ra thiết bị ngay trong danh sách chọn. */
function summarise(component: Component): string {
  return (SPEC_FIELDS[component.kind] ?? [])
    .filter((field) => field.required)
    .map((field) => {
      const value = component.spec[field.key];
      if (value === undefined || value === null || value === '') return null;
      return `${value}${field.unit ? ` ${field.unit}` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

const round = (value: number) => Math.round(value * 10) / 10;

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
  const tResult = useTranslations('selector.result');

  const [cameraCode, setCameraCode] = useState<string | null>(null);
  const [lensCode, setLensCode] = useState<string | null>(null);
  const [lightCode, setLightCode] = useState<string | null>(null);
  const [pcCode, setPcCode] = useState<string | null>(null);

  const metric = (key: string) => result.derived.find((d) => d.key === key)?.value ?? null;

  const requiredMp = metric('required_sensor_mp');
  const dataRate = metric('data_rate_mbytes_s');
  const fovWidth = typeof input.fov_width_mm === 'number' ? input.fov_width_mm : null;
  const workingDistance =
    typeof input.working_distance_mm === 'number' ? input.working_distance_mm : null;
  const needsColor = input.color_critical === true;
  // Suy từ câu chữ của luật, giống cách suy kiểu đèn — chưa phải dữ liệu có cấu trúc.
  const needTelecentric = /telecentric/i.test(result.lens ?? '');
  const needsGpu = result.approach === 'deep_learning';

  /*
   * Đầu vào bài ngoại quan phải tính TRƯỚC khi chọn camera: số pixel cần trên
   * từng trục là điều kiện lọc, không phải thứ tính sau. Bài khác không có
   * defect_min_size_mm nên trả null và mọi thứ chạy như cũ.
   */
  const appearance = appearanceInputFromForm(input);
  const need = appearance ? requiredPixels(appearance) : null;

  /* Không bọc useMemo: đây là vài phép lọc trên danh sách nhỏ, và React
     Compiler tự lo phần ghi nhớ. Bọc tay còn khiến compiler cảnh báo vì dep là
     giá trị dẫn xuất từ chính chuỗi tính toán này. */
  const cameraChoice = pickCamera(components, {
    requiredMp,
    dataRateMbytesS: dataRate,
    needsColor,
    requiredWidthPx: need?.nx ?? null,
    requiredHeightPx: need?.ny ?? null,
  });
  const cameraOptions = cameraChoice.chosen
    ? [cameraChoice.chosen, ...cameraChoice.alternatives]
    : [];
  const camera = cameraOptions.find((c) => c.code === cameraCode) ?? cameraChoice.chosen;

  const lensChoice = pickLens(components, {
    camera,
    fovWidthMm: fovWidth,
    workingDistanceMm: workingDistance,
    needTelecentric,
  });
  const lensOptions = lensChoice.chosen ? [lensChoice.chosen, ...lensChoice.alternatives] : [];
  const lens = lensOptions.find((c) => c.code === lensCode) ?? lensChoice.chosen;

  const lightChoice = pickLight(components, { lightingText: result.lighting });
  const lightOptions = lightChoice.chosen
    ? [lightChoice.chosen, ...lightChoice.alternatives]
    : lightChoice.alternatives;
  const light = lightOptions.find((c) => c.code === lightCode) ?? lightChoice.chosen;

  const pcChoice = pickController(components, {
    interfaceName: camera ? specString(camera.spec, 'interface') : null,
    dataRateMbytesS: dataRate,
    needsGpu,
  });
  const pcOptions = pcChoice.chosen ? [pcChoice.chosen, ...pcChoice.alternatives] : [];
  const pc = pcOptions.find((c) => c.code === pcCode) ?? pcChoice.chosen;

  /* Đổi camera là đổi cảm biến và giao tiếp — ống kính và máy tính chọn trước đó
     có thể không còn hợp, nên bỏ lựa chọn tay để hệ thống gợi ý lại. */
  const changeCamera = (code: string) => {
    setCameraCode(code || null);
    setLensCode(null);
    setPcCode(null);
  };

  // Ô select trả về chuỗi rỗng khi bấm "Về đề xuất" — quy về null để trạng thái
  // "đã đổi" không kẹt lại sau khi người dùng đặt lại.
  const setterFor = (set: (value: string | null) => void) => (code: string) => set(code || null);

  const byKey = {
    lighting: {
      chosen: light, options: lightOptions, set: setterFor(setLightCode), overridden: lightCode !== null,
    },
    lens: {
      chosen: lens, options: lensOptions, set: setterFor(setLensCode), overridden: lensCode !== null,
    },
    camera: {
      chosen: camera, options: cameraOptions, set: changeCamera, overridden: cameraCode !== null,
    },
    processing: {
      chosen: pc, options: pcOptions, set: setterFor(setPcCode), overridden: pcCode !== null,
    },
  } as const;

  const fitLine = (key: (typeof ROWS)[number]['key']): string | null => {
    if (key === 'camera') {
      const parts: string[] = [];
      if (requiredMp !== null) parts.push(t('fitCamera', { required: round(requiredMp) }));
      if (dataRate !== null) parts.push(t('fitRate', { rate: round(dataRate) }));
      return parts.join(' · ') || null;
    }
    if (key === 'lens') {
      if (needTelecentric && lensChoice.fit.targetMagnification !== null) {
        return t('fitLensMag', { target: round(lensChoice.fit.targetMagnification) });
      }
      if (lensChoice.fit.targetFocalMm !== null) {
        return t('fitLensFocal', { target: round(lensChoice.fit.targetFocalMm) });
      }
      return null;
    }
    if (key === 'lighting') {
      return lightChoice.fit.lightType
        ? t('fitLightType', { type: lightChoice.fit.lightType })
        : t('fitLightUnknown');
    }
    return needsGpu ? t('fitGpu') : null;
  };

  // Bộ tính toán chạy trên camera ĐANG CHỌN, nên đổi camera là các phép kiểm
  // PASS/FAIL đổi theo ngay.
  const analysis = appearance
    ? analyseAppearance(
        appearance,
        camera
          ? {
              widthPx: (camera.spec.resolution_w_px as number) ?? 0,
              heightPx: (camera.spec.resolution_h_px as number) ?? 0,
              pixelSizeUm: (camera.spec.pixel_size_um as number) ?? null,
              sensorFormat: specString(camera.spec, 'sensor_format'),
              interfaceName: specString(camera.spec, 'interface'),
            }
          : null,
        lens ? { imageCircleFormat: specString(lens.spec, 'image_circle') } : null
      )
    : null;

  return (
    <div>
      <h3 className="font-semibold">{t('title')}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('hint')}</p>

      {cameraCode !== null ? (
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          {t('cameraChanged')}
        </p>
      ) : null}

      <ol className="mt-4 space-y-3">
        {ROWS.map((row) => {
          const entry = byKey[row.key];
          const fit = fitLine(row.key);

          return (
            <li
              key={row.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <IconBadge name={row.icon} tone={row.tone} className="size-9" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {tResult(row.key)}
                    </h4>
                    {entry.overridden ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {t('changed')}
                      </span>
                    ) : null}
                  </div>

                  {entry.options.length === 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {t('none')}
                    </p>
                  ) : (
                    <>
                      <select
                        value={entry.chosen?.code ?? ''}
                        onChange={(event) => entry.set(event.target.value)}
                        aria-label={tResult(row.key)}
                        className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {entry.chosen ? null : <option value="">—</option>}
                        {entry.options.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.brand} {option.model}
                            {summarise(option) ? ` — ${summarise(option)}` : ''}
                          </option>
                        ))}
                      </select>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          {t('optionsCount', { count: entry.options.length })}
                        </span>
                        {entry.chosen ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                              SOURCE_STYLES[entry.chosen.source] ?? SOURCE_STYLES.unverified
                            }`}
                          >
                            {t(`sources.${entry.chosen.source}`)}
                          </span>
                        ) : null}
                        {entry.overridden ? (
                          <button
                            type="button"
                            onClick={() => entry.set('')}
                            className="rounded px-2 py-0.5 text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                          >
                            {t('reset')}
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}

                  {fit ? (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {fit}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {analysis ? (
        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
          <VisionChecks analysis={analysis} hasCamera={camera !== null} />
        </div>
      ) : null}
    </div>
  );
}
