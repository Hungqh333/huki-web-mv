'use client';

import { useActionState, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { runSelectorAction, type SelectorState } from '@/app/actions/selector';
import { FIELD_GROUPS, type FieldDef } from '@/lib/selector/fields';
import { SelectorField } from './SelectorField';
import { SelectorResultPanel } from './SelectorResultPanel';

export function SelectorForm({
  taskSlug,
  fields,
  canExport,
}: {
  taskSlug: string;
  fields: FieldDef[];
  canExport: boolean;
}) {
  const t = useTranslations('selector.form');
  const [state, formAction, pending] = useActionState<SelectorState, FormData>(
    runSelectorAction,
    {}
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);

  /*
   * Chia trường theo CHỦ ĐỀ, không theo linh kiện: camera/lens/đèn ràng buộc
   * lẫn nhau (tiêu cự cần cỡ cảm biến, lens telecentric giới hạn cảm biến) nên
   * hỏi rời từng cụm sẽ dựng ra cấu hình bất khả thi. Các CÂU HỎI thì tách theo
   * chủ đề rất tự nhiên. Bài toán nào không dùng nhóm nào thì nhóm đó tự biến mất.
   */
  const steps = FIELD_GROUPS.map((group) => ({
    group,
    fields: fields.filter((field) => field.group === group),
  })).filter((entry) => entry.fields.length > 0);

  const last = steps.length - 1;
  const stepOfKey = (key: string) => steps.findIndex((s) => s.fields.some((f) => f.key === key));

  /** Ô nào chưa hợp lệ trong một bước — dùng cho nút "Tiếp". */
  const firstInvalidIn = (index: number): HTMLElement | null =>
    formRef.current?.querySelector<HTMLElement>(`[data-step="${index}"] :invalid`) ?? null;

  const goNext = () => {
    const invalid = firstInvalidIn(step);
    if (invalid) {
      (invalid as HTMLInputElement).reportValidity?.();
      return;
    }
    setStep((current) => Math.min(current + 1, last));
  };

  /*
   * Form đặt noValidate và tự kiểm tra: các bước chưa hiện vẫn nằm trong DOM
   * (phải vậy mới gửi đủ dữ liệu), mà trình duyệt từ chối báo lỗi trên ô đang
   * ẩn — nó chỉ ghi cảnh báo "not focusable" rồi im lặng không gửi. Tự kiểm tra
   * thì nhảy được về đúng bước có ô lỗi rồi mới báo.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const invalid = form.querySelector<HTMLElement>(':invalid');
    if (!invalid) return;

    event.preventDefault();
    const holder = invalid.closest('[data-step]');
    const target = holder ? Number(holder.getAttribute('data-step')) : 0;
    setStep(target);
    // Đợi bước đó hiện ra rồi mới báo, nếu không bong bóng lỗi không hiện được.
    requestAnimationFrame(() => (invalid as HTMLInputElement).reportValidity?.());
  };

  const errorKeys = Object.keys(state.fieldErrors ?? {});

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate className="min-w-0">
        <input type="hidden" name="task_slug" value={taskSlug} />

        {/* Thanh bước */}
        <nav aria-label={t('stepLabel', { current: step + 1, total: steps.length })} className="flex flex-wrap gap-2">
          {steps.map((entry, index) => {
            const active = index === step;
            return (
              <button
                key={entry.group}
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => setStep(index)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {index + 1}
                </span>
                {t(`groups.${entry.group}.short`)}
              </button>
            );
          })}
        </nav>

        {state.error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        {/*
          Lỗi từ server có thể nằm ở bước đang không hiện. Liệt kê kèm nút nhảy
          tới, thay vì để người dùng bấm mò từng bước xem ô nào hỏng.
        */}
        {errorKeys.length > 0 ? (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <p>{t('fixErrors')}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {errorKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStep(Math.max(0, stepOfKey(key)))}
                  className="rounded border border-red-300 px-2 py-1 text-xs underline-offset-2 hover:underline dark:border-red-800"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {steps.map((entry, index) => (
          <div key={entry.group} data-step={index} hidden={index !== step} className="mt-6">
            <div>
              <h2 className="font-semibold">{t(`groups.${entry.group}.title`)}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t(`groups.${entry.group}.hint`)}
              </p>
            </div>

            {/*
              Lưới hai cột: bài ngoại quan có tới 9 ô ở bước đầu, xếp một cột dọc
              thì phải cuộn dài và mắt khó bắt cặp ô liên quan (rộng/cao FOV).
              Ô nhiều lựa chọn và ô có hướng dẫn dài thì chiếm trọn hàng.
            */}
            <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {entry.fields.map((def) => (
                <div
                  key={def.key}
                  className={
                    def.wide || def.kind === 'multiselect' || def.kind === 'boolean'
                      ? 'sm:col-span-2'
                      : undefined
                  }
                >
                  <SelectorField
                    def={def}
                    error={state.fieldErrors?.[def.key]}
                    defaultValue={state.input?.[def.key]}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t('back')}
            </button>
          ) : null}

          {step < last ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700"
            >
              {t('next')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t('submitting') : t('submit')}
            </button>
          )}

          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('stepLabel', { current: step + 1, total: steps.length })}
          </span>
        </div>
      </form>

      <div className="min-w-0 self-start">
        {state.result ? (
          <SelectorResultPanel
            result={state.result}
            input={state.input ?? {}}
            components={state.components ?? []}
            historySaved={state.historySaved}
            historyId={state.historyId}
            canExport={canExport}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('emptyState')}
          </p>
        )}
      </div>
    </div>
  );
}
