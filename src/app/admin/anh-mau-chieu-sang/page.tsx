import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { LightingSampleForm, type SampleFormOptions } from '@/components/admin/LightingSampleForm';
import { LightingSampleImport } from '@/components/admin/LightingSampleImport';
import { deleteLightingSampleAction } from '@/app/actions/lightingSamples';
import { loadSamples } from '@/lib/lightingSamples';
import { createClient } from '@/lib/supabase/server';
import { COLORS, LIGHT_COLORS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_SHAPES, LIGHT_TASKS, LIGHT_TYPES_V2, TASK_FEATURES } from '@/lib/vision/lightOptions';

/**
 * Ảnh mẫu chiếu sáng — admin tải lên / nhập hàng loạt / xoá (chốt 2026-10-22 Q6–Q8; nhãn + thông số
 * setting 2026-10-23 Q1–Q4). Trang /chon-den hiện ảnh khớp bài toán cho Member+.
 */
export default async function LightingSamplesPage() {
  const t = await getTranslations('admin.samples');
  const tl = await getTranslations('lightSelector');
  const n = (key: string) => tl(key as never);
  const supabase = await createClient();
  const samples = await loadSamples(supabase);

  const options: SampleFormOptions = {
    // "Cần thấy gì" theo từng bài toán — giá trị `bài toán:mục` (một mục có thể thuộc nhiều bài toán).
    targets: LIGHT_TASKS.flatMap((task) => TASK_FEATURES[task].map((f) => ({ value: `${task}:${f}`, label: `${n(`tasks.${task}`)} — ${n(`features.${f}`)}` }))),
    lights: LIGHT_TYPES_V2.map((v) => ({ value: v, label: n(`types.${v}`) })),
    materials: LIGHT_MATERIALS.map((v) => ({ value: v, label: n(`materials.${v}`) })),
    finishes: LIGHT_FINISHES.map((v) => ({ value: v, label: n(`finishes.${v}`) })),
    shapes: LIGHT_SHAPES.map((v) => ({ value: v, label: n(`shapes.${v}`) })),
    colors: COLORS.map((v) => ({ value: v, label: n(`colors13.${v}`) })),
    lightColors: LIGHT_COLORS.map((v) => ({ value: v, label: n(`colors.${v}`) })),
  };
  const label = (list: { value: string; label: string }[], v: string | null) => (v ? (list.find((o) => o.value === v)?.label ?? v) : null);

  return (
    <section>
      <PanelHeader standalone title={t('title')} note={t('subtitle')} />
      <div className="mt-6">
        <LightingSampleForm options={options} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t('import.title')}</h2>
      <div className="mt-3">
        <LightingSampleImport />
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t('listTitle', { n: samples.length })}</h2>
      {samples.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((s) => {
            const tags = [
              s.task && s.defect_type ? label(options.targets, `${s.task}:${s.defect_type}`) : t('general'),
              label(options.materials, s.material),
              label(options.finishes, s.finish),
              label(options.shapes, s.shape),
            ].filter(Boolean);
            const settings = [
              label(options.lightColors, s.light_color),
              s.light_model,
              s.angle_note,
              s.distance_mm ? `${s.distance_mm} mm` : null,
              s.exposure_us ? `${s.exposure_us} µs` : null,
              s.camera,
              s.lens,
            ].filter(Boolean);
            return (
              <figure key={s.id} className="rounded-lg p-2 ring-1 ring-slate-200 dark:ring-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ */}
                <img src={s.url} alt={s.caption_vi ?? label(options.lights, s.light_type) ?? ''} className="w-full rounded" loading="lazy" />
                <figcaption className="mt-1 space-y-0.5 text-sm">
                  <span className="block font-medium">{label(options.lights, s.light_type)}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{tags.join(' · ')}</span>
                  {settings.length ? <span className="block text-xs text-slate-500 dark:text-slate-400">{settings.join(' · ')}</span> : null}
                  {s.caption_vi ? <span className="block text-xs text-slate-500 dark:text-slate-400">{s.caption_vi}</span> : null}
                  {s.source ? <span className="block text-xs text-slate-400">{t('sourceLabel', { source: s.source })}</span> : null}
                </figcaption>
                <form action={deleteLightingSampleAction} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-xs text-red-700 hover:underline dark:text-red-400">
                    {t('delete')}
                  </button>
                </form>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
