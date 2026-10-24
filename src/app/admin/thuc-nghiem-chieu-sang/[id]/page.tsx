import { ActionLink } from '@/components/ui/ActionLink';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { AreaField, SelectField, SubmitButton, TextField, inputClass } from '@/components/admin/ExperimentFields';
import { ExperimentReportUpload } from '@/components/admin/ExperimentReportUpload';
import {
  addItemAction,
  addTrialAction,
  deleteExperimentAction,
  deleteItemAction,
  deleteTrialAction,
  deleteTrialImageAction,
  removeReportAction,
  saveExperimentAction,
  saveItemAction,
  saveTrialAction,
  uploadProductImageAction,
  uploadTrialImageAction,
} from '@/app/actions/lightExperiments';
import { lightOptionLabels } from '@/lib/lightLabels';
import { loadExperimentTree, signExperimentPaths, signReport, type ImageRow, type TrialRow } from '@/lib/lightExperiments';
import { createClient } from '@/lib/supabase/server';
import { VERDICTS } from '@/lib/vision/experimentMatch';
import { trialRates } from '@/lib/vision/experimentMetrics';

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900';
const pct = (v: number) => `${(v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} %`;

/**
 * Sửa một lần thực nghiệm chiếu sáng (chốt 2026-10-24, bảng ghép trường theo báo cáo MC1626-01):
 * thông tin chung + ảnh sản phẩm + báo cáo → hạng mục → phương án đèn → ảnh chụp / ảnh xử lý.
 */
export default async function EditLightExperimentPage({ params, searchParams }: PageProps<'/admin/thuc-nghiem-chieu-sang/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations('admin.experiments');
  const o = await lightOptionLabels();
  const supabase = await createClient();
  const tree = await loadExperimentTree(supabase, { id });
  const exp = tree.experiments[0];
  if (!exp) notFound();
  const urls = await signExperimentPaths(supabase, [exp.product_image_path, ...tree.images.map((i) => i.storage_path)]);
  const reportLink = exp.report_path ? await signReport(supabase, exp.report_path, exp.report_name) : null;

  const error = typeof sp.e === 'string' ? sp.e : null;
  const saved = sp.ok === '1';
  const verdicts = VERDICTS.map((v) => ({ value: v, label: t(`verdict.${v}`) }));
  const unknown = t('unknown');
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  const trialForm = (trial: TrialRow, images: ImageRow[]) => {
    const rates = trialRates(trial);
    return (
      <div key={trial.id} id={`pa-${trial.id}`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <form action={saveTrialAction} className="space-y-3">
          {hidden('experiment_id', exp.id)}
          {hidden('id', trial.id)}
          {hidden('sort_order', String(trial.sort_order))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('trials.heading', { label: trial.label ?? labelText(o.lights, trial.light_type) })}</p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" name="is_chosen" defaultChecked={trial.is_chosen} className="h-4 w-4" />
              {t('fields.isChosen')}
            </label>
          </div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{t('trials.groupSetup')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField name="label" label={t('fields.label')} value={trial.label} placeholder={t('fields.labelPlaceholder')} />
            <SelectField name="light_type" label={t('fields.lightType')} options={o.lights} value={trial.light_type} required />
            <SelectField name="light_color" label={t('fields.lightColor')} options={o.lightColors} empty={unknown} value={trial.light_color} />
            <TextField name="light_model" label={t('fields.lightModel')} value={trial.light_model} placeholder="HZ-RL9070-W" />
            <TextField name="angle_note" label={t('fields.angle')} value={trial.angle_note} placeholder={t('fields.anglePlaceholder')} />
            <TextField name="distance_mm" label={t('fields.distance')} type="number" value={trial.distance_mm} />
            <TextField name="backdrop" label={t('fields.backdrop')} value={trial.backdrop} placeholder={t('fields.backdropPlaceholder')} />
            <TextField name="camera" label={t('fields.camera')} value={trial.camera} />
            <TextField name="lens" label={t('fields.lens')} value={trial.lens} />
            <TextField name="accessory" label={t('fields.accessory')} value={trial.accessory} placeholder={t('fields.accessoryPlaceholder')} />
            <TextField name="capture_ms" label={t('fields.captureMs')} type="number" value={trial.capture_ms} />
            <TextField name="process_ms" label={t('fields.processMs')} type="number" value={trial.process_ms} />
          </div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{t('trials.groupResult')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField name="verdict" label={t('fields.verdict')} options={verdicts} empty={t('verdict.none')} value={trial.verdict} />
            <TextField name="measured_error_mm" label={t('fields.measuredError')} type="number" value={trial.measured_error_mm} />
            <TextField name="ok_samples" label={t('fields.okSamples')} type="number" value={trial.ok_samples} />
            <TextField name="ng_samples" label={t('fields.ngSamples')} type="number" value={trial.ng_samples} />
            <TextField name="tp" label={t('fields.tp')} type="number" value={trial.tp} />
            <TextField name="tn" label={t('fields.tn')} type="number" value={trial.tn} />
            <TextField name="fp" label={t('fields.fp')} type="number" value={trial.fp} />
            <TextField name="fn" label={t('fields.fn')} type="number" value={trial.fn} />
          </div>
          {rates ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('trials.rates', { leakage: pct(rates.leakage), overkill: pct(rates.overkill), total: rates.total })}
            </p>
          ) : null}
          <AreaField name="note" label={t('fields.note')} value={trial.note} placeholder={t('fields.notePlaceholder')} />
          <SubmitButton>{t('trials.save')}</SubmitButton>
        </form>

        {/* Ảnh Vision chụp / ảnh Vision xử lý — tối đa 3 ảnh mỗi loại. */}
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{t('images.title')}</p>
          {images.length > 0 ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {images.map((img) => (
                <figure key={img.id} className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                  {urls.get(img.storage_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ
                    <img src={urls.get(img.storage_path)} alt={img.caption_vi ?? t(`images.kind.${img.kind}`)} className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
                  ) : null}
                  <figcaption className="mt-1 flex items-center justify-between gap-1 text-xs">
                    <span className="truncate text-slate-600 dark:text-slate-300">{t(`images.kind.${img.kind}`)}</span>
                    <DeleteButton action={deleteTrialImageAction} id={img.id} itemName={t(`images.kind.${img.kind}`)} extra={{ experiment_id: exp.id }} />
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('images.empty')}</p>
          )}
          <form action={uploadTrialImageAction} className="mt-3 grid items-end gap-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
            {hidden('experiment_id', exp.id)}
            {hidden('trial_id', trial.id)}
            <SelectField
              name="kind"
              label={t('images.kindLabel')}
              options={[
                { value: 'raw', label: t('images.kind.raw') },
                { value: 'processed', label: t('images.kind.processed') },
              ]}
              value="raw"
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('images.file')}</span>
              <input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className={inputClass} />
            </label>
            <TextField name="caption_vi" label={t('images.caption')} max={300} />
            <SubmitButton tone="secondary">{t('images.upload')}</SubmitButton>
          </form>
        </div>

        <div className="mt-3 flex justify-end">
          <DeleteButton action={deleteTrialAction} id={trial.id} itemName={trial.label ?? labelText(o.lights, trial.light_type)} extra={{ experiment_id: exp.id }} />
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <PanelHeader
        standalone
        title={`${exp.code} · ${exp.title}`}
        note={t('editNote')}
        actions={
          <ActionLink href="/admin/thuc-nghiem-chieu-sang" variant="back">
            {t('back')}
          </ActionLink>
        }
      />
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {t(`errors.${error}` as never)}
        </p>
      ) : saved ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {t('saved')}
        </p>
      ) : null}

      {/* ── Thông tin chung ── */}
      <div id="chung" className={`${CARD} scroll-mt-24`}>
        <form action={saveExperimentAction} className="space-y-4">
          {hidden('id', exp.id)}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groups.general')}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TextField name="code" label={t('fields.code')} value={exp.code} required max={60} />
              <div className="sm:col-span-2">
                <TextField name="title" label={t('fields.title')} value={exp.title} required max={200} />
              </div>
              <SelectField
                name="status"
                label={t('fields.status')}
                options={[
                  { value: 'draft', label: t('status.draft') },
                  { value: 'published', label: t('status.published') },
                ]}
                value={exp.status}
              />
              <TextField name="engineer" label={t('fields.engineer')} value={exp.engineer} />
              <TextField name="tested_on" label={t('fields.testedOn')} type="date" value={exp.tested_on} />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groups.product')}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <TextField name="product_name" label={t('fields.productName')} value={exp.product_name} />
              <TextField name="product_width_mm" label={t('fields.productWidth')} type="number" value={exp.product_width_mm} />
              <TextField name="product_height_mm" label={t('fields.productHeight')} type="number" value={exp.product_height_mm} />
              <TextField name="model_count" label={t('fields.modelCount')} type="number" value={exp.model_count} />
              <TextField name="min_defect_mm" label={t('fields.minDefect')} type="number" value={exp.min_defect_mm} />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groups.object')}</legend>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('groups.objectNote')}</p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <SelectField name="material" label={t('fields.material')} options={o.materials} empty={unknown} value={exp.material} />
              <SelectField name="finish" label={t('fields.finish')} options={o.finishes} empty={unknown} value={exp.finish} />
              <SelectField name="shape" label={t('fields.shape')} options={o.shapes} empty={unknown} value={exp.shape} />
              <SelectField name="feature_color" label={t('fields.featureColor')} options={o.colors} empty={unknown} value={exp.feature_color} />
              <SelectField name="background_color" label={t('fields.backgroundColor')} options={o.colors} empty={unknown} value={exp.background_color} />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groups.conclusion')}</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <AreaField name="conclusion_vi" label={t('fields.conclusionVi')} value={exp.conclusion_vi} max={2000} />
              <AreaField name="conclusion_en" label={t('fields.conclusionEn')} value={exp.conclusion_en} max={2000} />
            </div>
            <TextField name="report_url" label={t('fields.reportUrl')} type="url" value={exp.report_url} placeholder="https://…" max={500} />
          </fieldset>
          <SubmitButton>{t('saveGeneral')}</SubmitButton>
        </form>

        <div className="mt-6 grid gap-6 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('product.title')}</p>
            {exp.product_image_path && urls.get(exp.product_image_path) ? (
              // eslint-disable-next-line @next/next/no-img-element -- link ký tên của Supabase Storage, hết hạn sau 1 giờ
              <img src={urls.get(exp.product_image_path)} alt={exp.product_name ?? exp.title} className="mt-2 max-h-48 rounded ring-1 ring-slate-200 dark:ring-slate-700" />
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('product.empty')}</p>
            )}
            <form action={uploadProductImageAction} className="mt-3 flex flex-wrap items-end gap-3">
              {hidden('id', exp.id)}
              <input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className={`${inputClass} max-w-xs`} />
              <SubmitButton tone="secondary">{t('product.upload')}</SubmitButton>
            </form>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('report.title')}</p>
            {reportLink ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <a href={reportLink} className="text-sky-700 hover:underline dark:text-sky-400">
                  {exp.report_name ?? t('report.download')}
                </a>
                <form action={removeReportAction}>
                  {hidden('id', exp.id)}
                  <button type="submit" className="text-xs text-red-700 hover:underline dark:text-red-400">
                    {t('report.remove')}
                  </button>
                </form>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('report.empty')}</p>
            )}
            <div className="mt-3">
              <ExperimentReportUpload experimentId={exp.id} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Hạng mục ── */}
      <div id="hang-muc" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold">{t('items.title', { n: tree.items.length })}</h2>
        {tree.items.map((item, index) => {
          const trials = tree.trials.filter((tr) => tr.item_id === item.id);
          return (
            <div key={item.id} id={`hm-${item.id}`} className={`${CARD} scroll-mt-24 space-y-4`}>
              <form action={saveItemAction} className="space-y-3">
                {hidden('experiment_id', exp.id)}
                {hidden('id', item.id)}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('items.heading', { n: index + 1 })}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <TextField name="name_vi" label={t('fields.itemName')} value={item.name_vi} required max={200} />
                  </div>
                  <TextField name="name_en" label={t('fields.itemNameEn')} value={item.name_en} max={200} />
                  <TextField name="sort_order" label={t('fields.sortOrder')} type="number" value={item.sort_order} />
                  <div className="sm:col-span-2">
                    <SelectField name="target" label={t('fields.target')} options={o.targets} empty={t('fields.targetNone')} value={item.task && item.feature ? `${item.task}:${item.feature}` : null} />
                  </div>
                  <SelectField name="material" label={t('fields.materialOverride')} options={o.materials} empty={t('sameAsExperiment')} value={item.material} />
                  <SelectField name="finish" label={t('fields.finishOverride')} options={o.finishes} empty={t('sameAsExperiment')} value={item.finish} />
                  <SelectField name="shape" label={t('fields.shapeOverride')} options={o.shapes} empty={t('sameAsExperiment')} value={item.shape} />
                </div>
                <AreaField name="requirement" label={t('fields.requirement')} value={item.requirement} rows={2} />
                <SubmitButton>{t('items.save')}</SubmitButton>
              </form>

              <div className="space-y-3">{trials.map((trial) => trialForm(trial, tree.images.filter((img) => img.trial_id === trial.id)))}</div>

              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <form action={addTrialAction} className="flex flex-wrap items-end gap-3">
                  {hidden('experiment_id', exp.id)}
                  {hidden('item_id', item.id)}
                  <SelectField name="light_type" label={t('trials.addLight')} options={o.lights} empty={t('choose')} required />
                  <TextField name="label" label={t('fields.label')} placeholder={t('fields.labelPlaceholder')} />
                  <SubmitButton tone="secondary">{t('trials.add')}</SubmitButton>
                </form>
                <DeleteButton action={deleteItemAction} id={item.id} itemName={item.name_vi} extra={{ experiment_id: exp.id }} />
              </div>
            </div>
          );
        })}

        <form action={addItemAction} className={`${CARD} space-y-3`}>
          {hidden('experiment_id', exp.id)}
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('items.add')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <TextField name="name_vi" label={t('fields.itemName')} placeholder={t('fields.itemNamePlaceholder')} required max={200} />
            </div>
            <SelectField name="target" label={t('fields.target')} options={o.targets} empty={t('fields.targetNone')} />
            <SelectField name="light_type" label={t('items.firstLight')} options={o.lights} empty={t('choose')} required />
          </div>
          <SubmitButton tone="secondary">{t('items.addSubmit')}</SubmitButton>
        </form>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 p-4 dark:border-red-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('deleteNote')}</p>
        <DeleteButton action={deleteExperimentAction} id={exp.id} itemName={`${exp.code} · ${exp.title}`} />
      </div>
    </section>
  );
}

function labelText(options: { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}
