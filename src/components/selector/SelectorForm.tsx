'use client';

import { useActionState, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { runSelectorAction, type SelectorState } from '@/app/actions/selector';
import { FIELD_GROUPS, visibleFieldDefs, type FieldDef } from '@/lib/selector/fields';
import type { InputValue } from '@/lib/selector/types';
import { SelectorField } from './SelectorField';
import { SelectorResultPanel } from './SelectorResultPanel';

/**
 * Bố cục HAI GIAI ĐOẠN, mỗi giai đoạn dùng trọn bề ngang.
 *
 * Trước đây form và kết quả chia đôi màn hình 50/50, và cả hai nửa đều sai:
 *
 *  - Lúc chưa bấm tính: cột trái là form cao 761px, cột phải chỉ có một câu
 *    hướng dẫn cao 90px. Đo ở 1280px được 532px mỗi cột — tức là 671px bỏ
 *    trống ngay cạnh một cái form đang chật.
 *  - Lúc đã có kết quả: bảng danh mục vật tư rộng tối thiểu 640px bị nhét vào
 *    cột 532px, nên nó tự cuộn ngang BÊN TRONG cột. Đây chính là chỗ khó nhìn
 *    nhất của cả trang.
 *
 * Giờ: chưa có kết quả thì form nằm giữa ở bề rộng dễ đọc (768px, mỗi ô ~360px
 * thay vì ~250px). Có kết quả rồi thì form thu lại thành một thanh tóm tắt
 * những gì đã nhập, nhường trọn bề ngang cho kết quả — bảng vật tư hết cuộn
 * ngang. Bấm "Sửa thông số" thì form mở lại đúng chỗ cũ.
 */

/** Số thông số hiện sẵn trên thanh tóm tắt; phần còn lại nằm sau nút mở rộng. */
const SUMMARY_PREVIEW = 4;

export function SelectorForm({
  taskSlug,
  fields,
  canExport,
  initialState,
}: {
  taskSlug: string;
  fields: FieldDef[];
  canExport: boolean;
  /**
   * Trạng thái khởi tạo của action. Bình thường để trống.
   *
   * Trang xem trước ở máy local dùng nó để bơm sẵn một kết quả giả — nếu không
   * thì bố cục sau khi bấm tính chỉ kiểm được bằng cách đăng nhập thật, mà mỗi
   * vòng sửa giao diện lại phải đăng nhập lại.
   */
  initialState?: SelectorState;
}) {
  const t = useTranslations('selector.form');
  const tFields = useTranslations('selector.fields');
  const tOptions = useTranslations('selector.options');

  const [state, formAction, pending] = useActionState<SelectorState, FormData>(
    runSelectorAction,
    initialState ?? {}
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  /** Mở lại form sau khi đã có kết quả, để sửa rồi tính lại. */
  const [editing, setEditing] = useState(false);
  /** Xem hết thông số đã nhập, hay chỉ vài cái đầu. */
  const [showAllInputs, setShowAllInputs] = useState(false);

  /*
   * Vài ô chỉ có nghĩa với một kiểu chụp nhất định (tốc độ băng tải với bài
   * chụp tĩnh chẳng hạn). Theo dõi giá trị đó để ẩn/hiện. Bắt sự kiện ở cấp
   * form thay vì gắn onChange vào từng ô — chỉ cần một chỗ, và không phải
   * biến mọi ô thành controlled.
   */
  const [conditionValues, setConditionValues] = useState<Record<string, string>>({});

  const readCondition = (key: string): string | null => conditionValues[key] ?? null;
  const shownFields = visibleFieldDefs(fields, readCondition);

  /*
   * Chia trường theo CHỦ ĐỀ, không theo linh kiện: camera/lens/đèn ràng buộc
   * lẫn nhau (tiêu cự cần cỡ cảm biến, lens telecentric giới hạn cảm biến) nên
   * hỏi rời từng cụm sẽ dựng ra cấu hình bất khả thi. Các CÂU HỎI thì tách theo
   * chủ đề rất tự nhiên. Bài toán nào không dùng nhóm nào thì nhóm đó tự biến mất.
   */
  const steps = FIELD_GROUPS.map((group) => ({
    group,
    fields: shownFields.filter((field) => field.group === group),
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
    if (invalid) {
      event.preventDefault();
      const holder = invalid.closest('[data-step]');
      const target = holder ? Number(holder.getAttribute('data-step')) : 0;
      setStep(target);
      // Đợi bước đó hiện ra rồi mới báo, nếu không bong bóng lỗi không hiện được.
      requestAnimationFrame(() => (invalid as HTMLInputElement).reportValidity?.());
      return;
    }
    // Hợp lệ rồi thì gập form lại, nhường chỗ cho kết quả sắp hiện.
    setEditing(false);
  };

  const errorKeys = Object.keys(state.fieldErrors ?? {});
  const hasResult = Boolean(state.result);
  const showForm = !hasResult || editing;

  /** Giá trị đã gửi, viết lại thành chữ để tóm tắt. */
  const describe = (def: FieldDef, value: InputValue): string | null => {
    if (value === undefined || value === null || value === '') return null;

    if (typeof value === 'boolean') return value ? tFields(def.labelKey) : null;

    if (Array.isArray(value)) {
      const labels = value
        .map((item) => def.options?.find((option) => option.value === item))
        .filter((option): option is NonNullable<typeof option> => Boolean(option))
        .map((option) => tOptions(option.labelKey));
      return labels.length > 0 ? labels.join(', ') : null;
    }

    if (def.kind === 'select') {
      const option = def.options?.find((item) => item.value === value);
      return option ? tOptions(option.labelKey) : String(value);
    }

    return def.unit ? `${value} ${def.unit}` : String(value);
  };

  const submitted = state.input ?? {};
  const summary = shownFields
    .map((def) => ({ def, text: describe(def, submitted[def.key]) }))
    .filter((entry): entry is { def: FieldDef; text: string } => entry.text !== null);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ THANH TÓM TẮT -- */}
      {/* Chỉ hiện khi đã có kết quả. Thay cho cả cái form, nên phải nói được
          "đã nhập gì" chứ không chỉ là một cái nút. */}
      {hasResult ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('submittedTitle')}
            </h2>
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              aria-expanded={editing}
              className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              {editing ? t('closeEdit') : t('editInputs')}
            </button>
          </div>

          {/* Chỉ hiện vài thông số đầu. Bài ngoại quan có 17 thông số — liệt kê
              hết thì riêng thanh nhắc lại đã cao 496px trên điện thoại, tức là
              hơn nửa màn hình cho thứ người dùng vừa tự tay nhập xong. */}
          {summary.length > 0 ? (
            <>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {(showAllInputs ? summary : summary.slice(0, SUMMARY_PREVIEW)).map(
                  ({ def, text }) => (
                    <div key={def.key} className="flex gap-1.5">
                      <dt className="text-slate-500 dark:text-slate-400">
                        {tFields(def.labelKey)}:
                      </dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-100">{text}</dd>
                    </div>
                  )
                )}
              </dl>

              {summary.length > SUMMARY_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAllInputs((current) => !current)}
                  aria-expanded={showAllInputs}
                  className="mt-2 text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  {showAllInputs
                    ? t('fewerInputs')
                    : t('moreInputs', { count: summary.length - SUMMARY_PREVIEW })}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------- FORM -- */}
      {/* Vẫn nằm trong DOM khi gập lại: ẩn bằng `hidden` chứ không tháo ra,
          nếu không giá trị đã nhập mất sạch mỗi lần xem kết quả. */}
      {/* Luôn giới hạn 768px, kể cả khi mở lại để sửa bên cạnh kết quả: thả cho
          form rộng hết 1100px thì mỗi ô số thành 530px — vừa xấu vừa khó gióng
          mắt giữa nhãn và ô. */}
      <div hidden={!showForm} className="mx-auto w-full max-w-3xl">
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          onChange={(event) => {
            // React gõ event.target theo thẻ gắn handler (form), nhưng sự kiện
            // nổi bọt lên từ ô con — phải ép kiểu qua unknown.
            const target = event.target as unknown as HTMLInputElement | HTMLSelectElement;
            if (target.name) {
              setConditionValues((current) => ({ ...current, [target.name]: target.value }));
            }
          }}
          noValidate
          className="min-w-0"
        >
          <input type="hidden" name="task_slug" value={taskSlug} />

          {/* Thanh tiến độ: vạch liền thay cho bốn cái nút rời, để thấy được
              đang ở đâu trên cả chặng chứ không chỉ thấy bước hiện tại. */}
          <nav aria-label={t('stepLabel', { current: step + 1, total: steps.length })}>
            <ol className="flex gap-1.5">
              {steps.map((entry, index) => {
                const done = index < step;
                const active = index === step;
                return (
                  <li key={entry.group} className="min-w-0 flex-1">
                    <button
                      type="button"
                      aria-current={active ? 'step' : undefined}
                      onClick={() => setStep(index)}
                      className="block w-full text-left"
                    >
                      <span
                        className={`block h-1 rounded-full transition ${
                          active
                            ? 'bg-sky-600'
                            : done
                              ? 'bg-sky-300 dark:bg-sky-800'
                              : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                      <span
                        className={`mt-2 block truncate text-xs font-medium transition ${
                          active
                            ? 'text-sky-700 dark:text-sky-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {index + 1}. {t(`groups.${entry.group}.short`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {state.error ? (
            <p className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          {/*
            Lỗi từ server có thể nằm ở bước đang không hiện. Liệt kê kèm nút nhảy
            tới, thay vì để người dùng bấm mò từng bước xem ô nào hỏng.
          */}
          {errorKeys.length > 0 ? (
            <div className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
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
            <div key={entry.group} data-step={index} hidden={index !== step} className="mt-7">
              <h3 className="text-lg font-semibold">{t(`groups.${entry.group}.title`)}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t(`groups.${entry.group}.hint`)}
              </p>

              {/*
                Lưới hai cột. Ở bề rộng 768px mỗi ô được ~360px — đủ để dòng gợi
                ý dưới ô nằm gọn một hai dòng thay vì ba bốn dòng như khi form bị
                ép vào nửa màn hình.
              */}
              <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
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

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
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

            <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
              {t('stepLabel', { current: step + 1, total: steps.length })}
            </span>
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------ KẾT QUẢ -- */}
      {state.result ? (
        <SelectorResultPanel
          result={state.result}
          input={state.input ?? {}}
          components={state.components ?? []}
          historySaved={state.historySaved}
          historyId={state.historyId}
          canExport={canExport}
        />
      ) : null}
    </div>
  );
}
