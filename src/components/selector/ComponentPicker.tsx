'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
import {
  listAccessories,
  listPcOptions,
  pickCamera,
  pickCameraCable,
  pickController,
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
 * Danh mục vật tư theo đúng TRÌNH TỰ MUA HÀNG mà đội kỹ thuật dùng khi lên báo
 * giá: camera → ống kính (+ tube nếu cần) → đèn → cáp camera → cáp đèn → bộ
 * điều khiển đèn → máy tính (kèm Windows/Office/màn hình/bàn phím) → phần mềm
 * → phụ kiện thêm.
 *
 * Mỗi cụm mang một nhãn cho biết nó do TÍNH RA hay chỉ là GỢI Ý — người dùng
 * cần biết chỗ nào máy đã quyết hộ và chỗ nào phải tự cân nhắc. Cụm nào cũng
 * đổi được, và danh sách chỉ chứa thứ tương thích với lựa chọn phía trên.
 */

const SOURCE_STYLES: Record<string, string> = {
  unverified: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  datasheet: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  measured: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
};

const selectClass =
  'mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/** Tóm tắt thông số chính để nhận ra thiết bị ngay trong danh sách chọn. */
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

type Row = {
  key: string;
  icon: IconName;
  tone: BadgeTone;
  choice: ComponentChoice<unknown>;
  /** true = máy tính ra, false = chỉ gợi ý và người dùng tự quyết. */
  computed: boolean;
  fit: string | null;
  /** Cụm này không cần trong cấu hình hiện tại (ví dụ tube). */
  skipped?: string;
  /** Gợi ý dạng chữ từ bảng luật — giữ lại vì có lời khuyên catalog không có. */
  ruleText?: string | null;
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

  /** Lấy thiết bị người dùng đã đổi, không thì lấy đề xuất. */
  const resolve = (key: string, choice: ComponentChoice<unknown>): Component | null => {
    const options = choice.chosen ? [choice.chosen, ...choice.alternatives] : choice.alternatives;
    return options.find((c) => c.code === picked[key]) ?? choice.chosen;
  };

  // --- 1. Camera
  const cameraChoice = pickCamera(components, {
    requiredMp,
    dataRateMbytesS: dataRate,
    needsColor,
    requiredWidthPx: need?.nx ?? null,
    requiredHeightPx: need?.ny ?? null,
  });
  const camera = resolve('camera', cameraChoice);

  // --- 2. Ống kính (phụ thuộc cảm biến của camera vừa chọn)
  const lensChoice = pickLens(components, {
    camera,
    fovWidthMm: fovWidth,
    workingDistanceMm: workingDistance,
    needTelecentric,
  });
  const lens = resolve('lens', lensChoice);

  // --- 2b. Tube: chỉ cần khi cơ khí ép camera vào gần hơn ống kính cho phép
  const tubeChoice = pickTube(components, {
    lens,
    workingDistanceMm: workingDistance,
    magnification: lensChoice.fit.targetMagnification,
  });

  // --- 3. Đèn
  const lightChoice = pickLight(components, { lightingText: result.lighting });

  // --- 4. Cáp camera (theo chuẩn giao tiếp của camera)
  const cameraCableChoice = pickCameraCable(components, {
    interfaceName: camera ? specString(camera.spec, 'interface') : null,
  });

  // --- 5. Cáp đèn
  const lightCableChoice = pickLightCable(components);

  /*
   * Nhoè chuyển động quyết định bộ điều khiển đèn có phải đánh xung không —
   * đây là chỗ phép tính quang học nối thẳng sang việc mua hàng.
   */
  const cameraLike = camera
    ? {
        widthPx: (camera.spec.resolution_w_px as number) ?? 0,
        heightPx: (camera.spec.resolution_h_px as number) ?? 0,
        pixelSizeUm: (camera.spec.pixel_size_um as number) ?? null,
        sensorFormat: specString(camera.spec, 'sensor_format'),
        interfaceName: specString(camera.spec, 'interface'),
      }
    : null;

  const verdict = cameraLike && appearance ? verifyResolution(cameraLike, appearance) : null;
  const mmPerPx = verdict ? Math.max(verdict.mmPerPxX, verdict.mmPerPxY) : null;
  const blur =
    appearance?.speedMmS && mmPerPx
      ? maxExposureForBlur({ blurPx: appearance.blurPx, mmPerPx, speedMmS: appearance.speedMmS })
      : null;
  const needsStrobe = blur?.needsStrobe ?? false;

  // --- 6. Bộ điều khiển đèn
  const lightControllerChoice = pickLightController(components, {
    lightCount: 1,
    needsStrobe,
  });

  // --- 7. Máy tính
  const pcChoice = pickController(components, {
    interfaceName: camera ? specString(camera.spec, 'interface') : null,
    dataRateMbytesS: dataRate,
    needsGpu,
  });

  // --- 8. Phần mềm
  const softwareChoice = pickSoftware(components, { needsDeepLearning: needsGpu });

  const tubeFit =
    tubeChoice.fit.needed && workingDistance !== null && tubeChoice.fit.lensMinWdMm !== null
      ? t('fitTube', {
          min: tubeChoice.fit.lensMinWdMm,
          actual: workingDistance,
          length: tubeChoice.fit.requiredLengthMm ?? '—',
        })
      : null;

  const rows: Row[] = [
    {
      key: 'camera',
      icon: 'camera',
      tone: 'sky',
      choice: cameraChoice,
      computed: true,
      ruleText: result.camera,
      fit: [
        requiredMp !== null ? t('fitCamera', { required: round(requiredMp) }) : null,
        dataRate !== null ? t('fitRate', { rate: round(dataRate) }) : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    },
    {
      key: 'lens',
      icon: 'selector',
      tone: 'violet',
      choice: lensChoice,
      computed: true,
      ruleText: result.lens,
      fit:
        needTelecentric && lensChoice.fit.targetMagnification !== null
          ? t('fitLensMag', { target: round(lensChoice.fit.targetMagnification) })
          : lensChoice.fit.targetFocalMm !== null
            ? t('fitLensFocal', { target: round(lensChoice.fit.targetFocalMm) })
            : null,
    },
    {
      key: 'tube',
      icon: 'selector',
      tone: 'slate',
      choice: tubeChoice,
      computed: true,
      fit: tubeFit,
      skipped: tubeChoice.fit.needed ? undefined : t('tubeNotNeeded'),
    },
    {
      key: 'light',
      icon: 'sun',
      tone: 'amber',
      choice: lightChoice,
      computed: false,
      ruleText: result.lighting,
      fit: lightChoice.fit.lightType
        ? t('fitLightType', { type: lightChoice.fit.lightType })
        : t('fitLightUnknown'),
    },
    {
      key: 'cableCamera',
      icon: 'rules',
      tone: 'sky',
      choice: cameraCableChoice,
      computed: true,
      fit: cameraCableChoice.fit.connectorKeyword
        ? t('fitCableCamera', { connector: cameraCableChoice.fit.connectorKeyword })
        : null,
    },
    {
      key: 'cableLight',
      icon: 'rules',
      tone: 'amber',
      choice: lightCableChoice,
      computed: false,
      fit: null,
    },
    {
      key: 'lightController',
      icon: 'monitor',
      tone: 'amber',
      choice: lightControllerChoice,
      computed: true,
      fit: t('fitLightController', {
        channels: 1,
        strobe: needsStrobe ? t('strobeRequired') : t('strobeNotRequired'),
      }),
    },
    {
      key: 'pc',
      icon: 'monitor',
      tone: 'emerald',
      choice: pcChoice,
      computed: true,
      ruleText: result.processing,
      fit: needsGpu ? t('fitGpu') : null,
    },
    {
      key: 'software',
      icon: 'article',
      tone: 'violet',
      choice: softwareChoice,
      computed: false,
      fit: needsGpu ? t('fitSoftwareDl') : null,
    },
  ];

  /* Đổi camera là đổi cảm biến và giao tiếp — ống kính, tube, cáp và máy tính
     chọn trước đó có thể không còn hợp, nên bỏ để hệ thống gợi ý lại. */
  const change = (key: string, code: string) => {
    setPicked((current) => {
      const next = { ...current, [key]: code || null };
      if (key === 'camera') {
        next.lens = null;
        next.tube = null;
        next.cableCamera = null;
        next.pc = null;
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

  const availableOptions = listPcOptions(components);
  const availableExtras = listAccessories(components);

  return (
    <div>
      <h3 className="font-semibold">{t('title')}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('hint')}</p>

      {picked.camera ? (
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          {t('cameraChanged')}
        </p>
      ) : null}

      <ol className="mt-4 space-y-3">
        {rows.map((row, index) => {
          const options = row.choice.chosen
            ? [row.choice.chosen, ...row.choice.alternatives]
            : row.choice.alternatives;
          const chosen = resolve(row.key, row.choice);
          const overridden = picked[row.key] != null;

          return (
            <li
              key={row.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <IconBadge name={row.icon} tone={row.tone} className="size-9" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                    <h4 className="text-sm font-medium">{t(`rows.${row.key}`)}</h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.computed
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {row.computed ? t('computed') : t('suggested')}
                    </span>
                    {overridden ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {t('changed')}
                      </span>
                    ) : null}
                  </div>

                  {row.skipped ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{row.skipped}</p>
                  ) : options.length === 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {t('none')}
                    </p>
                  ) : (
                    <>
                      <select
                        value={chosen?.code ?? ''}
                        onChange={(event) => change(row.key, event.target.value)}
                        aria-label={t(`rows.${row.key}`)}
                        className={selectClass}
                      >
                        {chosen ? null : <option value="">—</option>}
                        {options.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.brand} {option.model}
                            {summarise(option) ? ` — ${summarise(option)}` : ''}
                          </option>
                        ))}
                      </select>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          {t('optionsCount', { count: options.length })}
                        </span>
                        {chosen ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                              SOURCE_STYLES[chosen.source] ?? SOURCE_STYLES.unverified
                            }`}
                          >
                            {t(`sources.${chosen.source}`)}
                          </span>
                        ) : null}
                        {overridden ? (
                          <button
                            type="button"
                            onClick={() => change(row.key, '')}
                            className="rounded px-2 py-0.5 text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                          >
                            {t('reset')}
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}

                  {row.fit || row.ruleText ? (
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {row.fit ? <p>{row.fit}</p> : null}
                      {row.ruleText ? <p>{t('fromRule', { text: row.ruleText })}</p> : null}
                    </div>
                  ) : null}

                  {/* Hàng đi kèm máy tính nằm ngay trong cụm máy tính, không tách rời. */}
                  {row.key === 'pc' && availableOptions.length > 0 ? (
                    <fieldset className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <legend className="sr-only">{t('pcOptionsTitle')}</legend>
                      <p className="text-xs font-medium">{t('pcOptionsTitle')}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {t('pcOptionsHint')}
                      </p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {availableOptions.map((option) => (
                          <label key={option.code} className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={pcOptions.includes(option.code)}
                              onChange={() => toggle(pcOptions, setPcOptions, option.code)}
                              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                            />
                            <span>
                              {option.brand} {option.model}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Phụ kiện thêm: danh sách mở, người dùng tự tích thêm cho từng dự án. */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <IconBadge name="rules" tone="slate" className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">{rows.length + 1}</span>
              <h4 className="text-sm font-medium">{t('extrasTitle')}</h4>
              {extras.length > 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t('selectedCount', { count: extras.length })}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('extrasHint')}</p>
            {result.accessories ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('fromRule', { text: result.accessories })}
              </p>
            ) : null}

            {availableExtras.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('extrasEmpty')}</p>
            ) : (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {availableExtras.map((item) => (
                  <label key={item.code} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={extras.includes(item.code)}
                      onChange={() => toggle(extras, setExtras, item.code)}
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                    />
                    <span>
                      {item.brand} {item.model}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {analysis ? (
        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
          <VisionChecks analysis={analysis} hasCamera={camera !== null} />
        </div>
      ) : null}
    </div>
  );
}
