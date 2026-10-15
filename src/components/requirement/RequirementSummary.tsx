'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { parseRequirementAction } from '@/app/actions/parseRequirement';
import { APPLICATION_SHORTCUT_ORDER, type ApplicationType } from '@/lib/visionEntry';
import {
  REQUIREMENT_SECTIONS,
  V1A_FIELDS,
  V1A_FULL_SUPPORT,
  countFilled,
  emptyRequirement,
  fieldsFor,
  readField,
  withFieldValue,
  type RequirementFieldDef,
} from '@/lib/requirement/fields';
import {
  DRAFT_VERSION,
  isApplicationType,
  parseDraft,
  startDraftFromApp,
  type DraftParse,
  type RequirementDraft,
} from '@/lib/requirement/draft';
import { readDraftRaw, subscribeDraft, writeDraft } from '@/lib/requirement/draftStore';
import { resolveAssumptions } from '@/lib/requirement/assumptions';
import { PARSE_TEXT_MAX, applyParseResult, pickApplicationType } from '@/lib/requirement/parseResult';
import { purposesOf } from '@/lib/requirement/purposes';
import {
  DEFAULT_FORM_MODE,
  FORM_MODES,
  FORM_MODE_STORAGE_KEY,
  hiddenFieldCount,
  isFormMode,
  questionsForMode,
  visibleFieldDefs,
  type FormMode,
} from '@/lib/requirement/formMode';
import {
  MAX_VISIBLE_QUESTIONS,
  NEED_LEVELS,
  answerUnknown,
  countByNeed,
  fieldNoteKey,
  needsFor,
  pendingPaths,
  pendingQuestions,
  resetQuestion,
  type FieldNeed,
  type QuestionDef,
} from '@/lib/requirement/questions';
import type { Assumption, Confidence, Requirement } from '@/lib/requirement/types';
import { AnalysisPanel } from './AnalysisPanel';
import { DesignPanels } from './DesignPanels';
import { KnowledgeProvider } from '@/components/knowledge/KnowledgeLink';
import { NOTE_CLASS, PanelHeader } from '@/components/ui/PanelHeader';
import type { KnowledgeIndex } from '@/lib/knowledge';
import type { Component } from '@/lib/components/specs';
import type { BomSelection } from '@/lib/vision/bomSelection';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from '@/lib/vision/engineParams';

/**
 * Bảng tóm tắt yêu cầu — spec V1.1 §10.2 "Tôi hiểu bài toán của bạn".
 *
 * Mỗi dòng: thông số | ô sửa được | badge confidence. Sửa một ô thì ô đó thành
 * "Đã nêu". Bản nháp nằm ở sessionStorage; lưu thành dự án ở thanh phía trên
 * (hạng mục 7).
 *
 * Bộ đọc mô tả (hạng mục 3): bản nháp có mô tả mà chưa đọc thì tự đọc MỘT lần, điền
 * trước các ô chưa hỏi, mỗi ô kèm đoạn văn gốc để người dùng đối chiếu. Nút "Đọc
 * lại" chạy lại, cũng không đè ô đã có.
 *
 * Khối "Thông tin còn thiếu" (hạng mục 5) phía trên bảng: tối đa 3 câu, chỉ hỏi
 * cái luật đang cần. Trả lời ở đó hay sửa trong bảng đều ghi cùng một bản nháp.
 *
 * Panel Assumptions (hạng mục 6) ở cột phải, dính khi cuộn. Giả định áp lúc
 * hiển thị, không ghi vào bản nháp; panel chỉ đọc — muốn thay giả định thì nhập
 * số thật trong bảng.
 *
 * V1a chưa có luật nào chạy nên giao diện hiện MỤC ĐÍCH, không hiện mã luật.
 */

// Cùng class với ô nhập trong Field.tsx.
const INPUT_CLASS =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

const CHIP_CLASS =
  'inline-flex min-h-9 items-center rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-sky-500 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

/** Không có confidence = chưa hỏi. */
type BadgeKey = Confidence | 'notAsked';

/*
 * Mức cần thiết của ô (questions.ts). Trên từng dòng, ô bắt buộc chỉ mang dấu *
 * đỏ theo lệ thường của biểu mẫu — nhãn chữ dài làm rối bảng; ô "Nên có" mang
 * nhãn ngắn; ô tuỳ chọn không ghi gì. Dòng đếm phía trên vẫn ghi đủ ba mức.
 */
const NEED_CLASS: Record<FieldNeed, string> = {
  required: 'bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200',
  recommended: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
  optional: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const BADGE_CLASS: Record<BadgeKey, string> = {
  // Xanh lá: ô đã có số liệu người dùng nêu — cùng màu "xong" với dòng báo đọc thành công.
  stated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  inferred: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  assumed: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  notAsked: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const EMPTY_DRAFT: RequirementDraft = {
  version: DRAFT_VERSION,
  startedFrom: 'manual',
  rawText: null,
  requirement: null,
  revision: 0,
};

const inputId = (path: string) => `req-${path.replace(/\./g, '-')}`;
const fieldDef = (path: string) => V1A_FIELDS.find((def) => def.path === path);

/*
 * Chế độ bảng Cơ bản / Nâng cao (2026-10-14) — nhớ theo trình duyệt. Cùng cách với
 * ThemeToggle: useSyncExternalStore, server luôn trả mặc định, không lệch hydrate.
 */
const FORM_MODE_EVENT = 'formmodechange';
function subscribeFormMode(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(FORM_MODE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(FORM_MODE_EVENT, callback);
  };
}
function readFormMode(): FormMode {
  try {
    const value = localStorage.getItem(FORM_MODE_STORAGE_KEY);
    return isFormMode(value) ? value : DEFAULT_FORM_MODE;
  } catch {
    return DEFAULT_FORM_MODE;
  }
}
function writeFormMode(mode: FormMode) {
  try {
    localStorage.setItem(FORM_MODE_STORAGE_KEY, mode);
  } catch {
    // Không lưu được (chế độ riêng tư): vẫn đổi cho lần xem này qua sự kiện dưới.
  }
  window.dispatchEvent(new Event(FORM_MODE_EVENT));
}

/* Khung "Giả định đang dùng" mở / thu gọn (2026-10-15) — mặc định thu gọn để các
   bảng bên trái rộng hơn; nhớ theo trình duyệt, cùng cơ chế với chế độ bảng. */
const ASSUMPTIONS_OPEN_KEY = 'mvh.assumptionsPanelOpen';
function readAssumptionsOpen(): boolean {
  try {
    return localStorage.getItem(ASSUMPTIONS_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}
function writeAssumptionsOpen(open: boolean) {
  try {
    localStorage.setItem(ASSUMPTIONS_OPEN_KEY, open ? '1' : '0');
  } catch {
    // Không lưu được thì vẫn đổi cho lần xem này (state trong component).
  }
  window.dispatchEvent(new Event(FORM_MODE_EVENT));
}

/** Panel bấm "Sửa trong bảng" → cuộn tới ô đó và đặt con trỏ vào. */
function focusField(path: string) {
  const element = document.getElementById(inputId(path));
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

/** Rỗng mặc định: khối Thiết bị phù hợp báo kho trống thay vì lỗi. */
const NO_CATALOG: readonly Component[] = [];

export function RequirementSummary({
  initialApp,
  catalog = NO_CATALOG,
  explainAvailable = false,
  knowledge = null,
  engineParams = DEFAULT_ENGINE_PARAMS,
}: {
  /** Ngưỡng engine đang dùng (admin, V1c 2026-10-12) — nạp ở server. */
  engineParams?: EngineParams;
  initialApp: ApplicationType | null;
  /** Catalog linh kiện tải ở server (RLS Member+) — V1c C3. */
  catalog?: readonly Component[];
  /** Server có key AI → nút "Diễn giải bằng lời" ở khối Vì sao chọn? (C7). */
  explainAvailable?: boolean;
  /** Bài ghi chú luật đã có (C8) — null thì không hiện liên kết tài liệu. */
  knowledge?: KnowledgeIndex | null;
}) {
  const t = useTranslations('designer.requirement');
  const tApps = useTranslations('home.entry.apps');

  const raw = useSyncExternalStore(subscribeDraft, readDraftRaw, () => null);
  const stored = useMemo(() => parseDraft(raw), [raw]);

  /* Vào từ thẻ (?app=) mà bản nháp chưa bắt đầu từ đúng thẻ đó → bản nháp mới
     cho loại này. Đã áp rồi thì thôi, để người dùng đổi loại không bị kéo lại. */
  const draft =
    initialApp && stored?.startedFrom !== `app:${initialApp}` ? startDraftFromApp(initialApp) : stored;

  useEffect(() => {
    /* Đọc thẳng storage, KHÔNG dùng `stored`: effect đầu tiên chạy ngay sau
       hydrate, lúc `stored` còn là snapshot phía server (null). Dùng nó thì
       tải lại trang sẽ ghi đè bản nháp đang có bằng bản rỗng. */
    const current = parseDraft(readDraftRaw());
    if (initialApp && current?.startedFrom !== `app:${initialApp}`) {
      writeDraft(startDraftFromApp(initialApp));
    }
  }, [initialApp, stored]);

  /* ─── Bộ đọc mô tả ───
     Trong lúc đọc, bảng bị khoá (fieldset disabled): kết quả về sau sẽ điền vào
     các ô chưa hỏi, nên nếu vừa đọc vừa cho sửa thì người dùng không biết ô nào
     là của mình. `runToken` để một lượt đã bỏ chờ không còn ghi được vào bản nháp. */
  const [reading, setReading] = useState(false);
  const runToken = useRef(0);
  const parseRequestedFor = useRef<string | null>(null);

  const runParse = useCallback((source: RequirementDraft) => {
    const text = source.rawText;
    if (!text) return;
    const token = ++runToken.current;
    setReading(true);
    void (async () => {
      const result = await parseRequirementAction(text);
      if (runToken.current !== token) return; // đã bỏ chờ, hoặc có lượt đọc mới
      setReading(false);
      /* Người dùng có thể mở bài toán khác trong lúc chờ: áp vào bản nháp MỚI NHẤT,
         và bỏ kết quả nếu bản nháp đã bị thay. */
      const latest = parseDraft(readDraftRaw());
      if (!latest || latest.startedFrom !== source.startedFrom) return;
      writeDraft(applyParseResult(latest, result));
    })();
  }, []);

  /** "Bỏ chờ, tôi tự điền": mở khoá bảng ngay, kết quả về sau bị bỏ. */
  const cancelParse = () => {
    runToken.current++;
    setReading(false);
    const latest = parseDraft(readDraftRaw());
    if (latest) writeDraft(applyParseResult(latest, { status: 'cancelled' }));
  };

  useEffect(() => {
    // Chỉ sau khi đã đọc storage (raw !== null), và mỗi bản nháp chỉ tự đọc một lần.
    const current = parseDraft(raw);
    if (!current?.rawText || current.parse) return;
    if (parseRequestedFor.current === current.startedFrom) return;
    parseRequestedFor.current = current.startedFrom;
    runParse(current);
  }, [raw, runParse]);

  const base = draft ?? EMPTY_DRAFT;
  const requirement = base.requirement;
  // Ô số/chữ không điều khiển: vẽ lại khi đổi loại, làm lại, trả lời câu hỏi,
  // có kết quả đọc mô tả, hoặc lúc bản nháp đã lưu vừa đọc xong sau hydrate.
  const mountKey = `${base.revision}-${raw !== null}`;

  // Bản đã điền mặc định — CHỈ để hiển thị. Mọi thao tác ghi vẫn trên `requirement`.
  const resolved = useMemo(() => (requirement ? resolveAssumptions(requirement) : null), [requirement]);
  const warningAssumptions = resolved ? resolved.assumptions.filter((a) => a.level === 'warning').length : 0;

  const onPickApp = (value: string) => {
    if (!isApplicationType(value)) return;
    writeDraft(pickApplicationType(base, value));
  };
  const onValue = (path: string, value: unknown) => {
    if (!requirement) return;
    writeDraft({ ...base, requirement: withFieldValue(requirement, path, value) });
  };
  /* Câu hỏi ghi ra ngoài ô trên bảng → tăng revision để các ô không-điều-khiển
     trên bảng vẽ lại với giá trị mới. */
  const onAnswer = (next: Requirement) => {
    writeDraft({ ...base, requirement: next, revision: base.revision + 1 });
  };
  /** Chọn / sửa phương án + BOM (V1c C5). undefined = bỏ chọn. */
  const onBomChange = (bom: BomSelection | undefined) => {
    const next = { ...base };
    if (bom) next.bom = bom;
    else delete next.bom;
    writeDraft(next);
  };
  const [missingOnly, setMissingOnly] = useState(false);
  const storedMode = useSyncExternalStore(subscribeFormMode, readFormMode, () => DEFAULT_FORM_MODE);
  /* localStorage bị chặn thì giá trị lưu không đổi được — giữ lựa chọn trong phiên ở state. */
  const [sessionMode, setSessionMode] = useState<FormMode | null>(null);
  const mode = sessionMode ?? storedMode;
  const chooseMode = (next: FormMode) => {
    setSessionMode(next);
    writeFormMode(next);
  };
  const storedAssumptionsOpen = useSyncExternalStore(subscribeFormMode, readAssumptionsOpen, () => false);
  const [sessionAssumptionsOpen, setSessionAssumptionsOpen] = useState<boolean | null>(null);
  const assumptionsOpen = sessionAssumptionsOpen ?? storedAssumptionsOpen;
  const setAssumptionsOpen = (open: boolean) => {
    setSessionAssumptionsOpen(open);
    writeAssumptionsOpen(open);
  };
  /* Màn hẹp (< lg): bấm nút Giả định mở bảng toàn màn hình thay vì khung cuối trang
     (chốt 2026-10-15). "Sửa trong bảng" trong bảng đó đóng bảng rồi mới nhảy tới ô. */
  const [assumptionsOverlay, setAssumptionsOverlay] = useState(false);
  const openAssumptions = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setAssumptionsOpen(true);
    else setAssumptionsOverlay(true);
  };
  useEffect(() => {
    if (!assumptionsOverlay) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setAssumptionsOverlay(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assumptionsOverlay]);
  const onReset = () => {
    if (!requirement) return;
    writeDraft({
      ...base,
      requirement: emptyRequirement(requirement.applicationType, requirement.id),
      revision: base.revision + 1,
    });
  };

  const defs = useMemo(() => (requirement ? visibleFieldDefs(requirement, mode) : []), [requirement, mode]);
  const visiblePaths = useMemo(() => new Set(defs.map((def) => def.path)), [defs]);
  const hiddenCount = requirement ? hiddenFieldCount(requirement, mode) : 0;
  const progress = requirement ? countFilled(requirement, defs) : null;
  const applicationType = requirement?.applicationType ?? null;
  const needs = useMemo(() => (applicationType ? needsFor(applicationType) : null), [applicationType]);
  const needCounts = useMemo(() => (requirement ? countByNeed(requirement, defs) : null), [requirement, defs]);
  /* "Sửa trong bảng" tới ô đang ẩn ở chế độ Cơ bản → chuyển Nâng cao, đợi bảng vẽ lại rồi mới cuộn. */
  const focusAnyField = (path: string) => {
    if (visiblePaths.has(path) || !requirement || !fieldsFor(requirement.applicationType).some((def) => def.path === path)) {
      focusField(path);
      return;
    }
    chooseMode('advanced');
    requestAnimationFrame(() => requestAnimationFrame(() => focusField(path)));
  };
  const isEmptyField = (path: string) => (requirement ? readField(requirement, path)?.value == null : true);
  const shownDefs = missingOnly ? defs.filter((def) => isEmptyField(def.path)) : defs;
  const inferredType =
    requirement && base.parse?.inferredApplicationType === requirement.applicationType
      ? base.parse.inferredApplicationType
      : null;
  const canReread = Boolean(base.parse) && base.parse?.status !== 'unavailable' && base.parse?.status !== 'denied';

  return (
    <KnowledgeProvider index={knowledge}>
    <div className={`grid gap-6 ${assumptionsOpen ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : 'lg:grid-cols-[minmax(0,1fr)_auto]'}`}>
      <div className="min-w-0 space-y-6">
        {reading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
          >
            <span
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-sky-600 border-t-transparent dark:border-sky-300"
            />
            <p className="min-w-0 flex-1">{t('parser.readingBanner')}</p>
            <button
              type="button"
              onClick={cancelParse}
              className="inline-flex min-h-9 items-center rounded-lg border border-sky-600 px-3 text-sm font-medium text-sky-800 transition hover:bg-sky-100 dark:border-sky-400 dark:text-sky-200 dark:hover:bg-sky-500/20"
            >
              {t('parser.cancel')}
            </button>
          </div>
        ) : null}

        {/* Khoá cả bảng trong lúc đọc — nút "Bỏ chờ" nằm ngoài fieldset nên vẫn bấm được. */}
        <fieldset
          disabled={reading}
          aria-busy={reading}
          className="m-0 min-w-0 space-y-6 border-0 p-0 disabled:opacity-60"
        >
        {/* Mô tả + Loại ứng dụng đặt cạnh nhau ở màn rộng (2026-10-15). */}
        <div className={base.rawText ? 'grid gap-6 xl:grid-cols-2 xl:items-start' : ''}>
        {base.rawText ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <PanelHeader
              title={t('rawTextTitle')}
              actions={
                canReread ? (
                  <button
                    type="button"
                    onClick={() => runParse(base)}
                    className="text-xs font-medium text-sky-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                  >
                    {t('parser.reread')}
                  </button>
                ) : null
              }
            />
            <div className="px-4 py-3 sm:px-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{base.rawText}</p>
              {reading ? null : <ParseStatus parse={base.parse} />}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <PanelHeader
            id="application-type-title"
            title={
              <>
                {t('applicationType')}
                {inferredType ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASS.inferred}`}>
                    {t('confidence.inferred')}
                  </span>
                ) : null}
              </>
            }
            meta={progress ? t('progress', progress) : null}
            note={requirement ? (mode === 'basic' ? t('mode.basicHint', { count: hiddenCount }) : t('mode.advancedHint')) : null}
            actions={
              requirement ? (
                <div
                  role="radiogroup"
                  aria-label={t('mode.title')}
                  className="inline-flex rounded-lg border border-slate-300 bg-white/60 p-0.5 dark:border-slate-600 dark:bg-slate-900/40"
                >
                  {FORM_MODES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={mode === option}
                      onClick={() => chooseMode(option)}
                      className={`min-h-8 rounded-md px-3 text-sm font-medium transition ${
                        mode === option
                          ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {t(`mode.${option}`)}
                    </button>
                  ))}
                </div>
              ) : null
            }
          />
          <div className="px-4 py-4 sm:px-5">
          <select
            id="application-type"
            aria-labelledby="application-type-title"
            value={requirement?.applicationType ?? ''}
            onChange={(event) => onPickApp(event.target.value)}
            className={`sm:max-w-sm ${INPUT_CLASS}`}
          >
            <option value="" disabled>
              {t('pickApplication')}
            </option>
            {APPLICATION_SHORTCUT_ORDER.map((type) => (
              <option key={type} value={type}>
                {tApps(`${type}.title`)}
              </option>
            ))}
          </select>
          {inferredType ? (
            <p className={`mt-2 ${NOTE_CLASS}`}>
              {t(base.parse?.inferredFrom === 'fields' ? 'parser.inferredTypeFromFields' : 'parser.inferredType')}
            </p>
          ) : null}

          {requirement && !V1A_FULL_SUPPORT.includes(requirement.applicationType) ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {t('partialSupport')}
            </p>
          ) : null}
          {progress && needCounts ? (
            <>
              <ul className="mt-3 flex flex-wrap gap-2">
                {NEED_LEVELS.map((level) => (
                  <li
                    key={level}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${NEED_CLASS[level]}`}
                  >
                    {t(`need.${level}`)}: {needCounts[level].filled}/{needCounts[level].total}
                  </li>
                ))}
              </ul>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={missingOnly}
                  onChange={(event) => setMissingOnly(event.target.checked)}
                  className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                />
                {t('missingOnly')}
              </label>
            </>
          ) : (
            <p className={`mt-3 ${NOTE_CLASS}`}>{t('pickApplicationHint')}</p>
          )}
          </div>
        </div>
        </div>

        {requirement ? (
          <RequirementQuestions requirement={requirement} revision={base.revision} onAnswer={onAnswer} visiblePaths={visiblePaths} />
        ) : null}

        {/* Bảy nhóm ô nhập xếp 2 cột ở màn rộng (2026-10-15) — thứ tự đọc theo hàng. */}
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        {requirement && resolved
          ? REQUIREMENT_SECTIONS.map((section) => {
              const sectionDefs = shownDefs.filter((def) => def.section === section);
              if (sectionDefs.length === 0) return null;
              return (
                <section
                  key={section}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <PanelHeader title={t(`sections.${section}`)} />
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectionDefs.map((def) => {
                      const field = readField(requirement, def.path);
                      const shown = readField(resolved.requirement, def.path);
                      const badge: BadgeKey = shown?.confidence ?? 'notAsked';
                      const filledBySystem = badge === 'assumed' || badge === 'inferred';
                      const id = inputId(def.path);
                      const need = needs?.get(def.path) ?? 'optional';
                      const missingNeeded = need === 'required' && isEmptyField(def.path);
                      const label = (
                        <>
                          {t(`fields.${def.section}.${def.key}`)}
                          {def.unit ? (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({def.unit})</span>
                          ) : null}
                          {need === 'required' ? (
                            <>
                              <span aria-hidden="true" className="ml-1 font-bold text-rose-600 dark:text-rose-400">
                                *
                              </span>
                              <span className="sr-only"> {t('need.required')}</span>
                            </>
                          ) : null}
                          {need === 'recommended' ? (
                            <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${NEED_CLASS[need]}`}>
                              {t('need.recommended')}
                            </span>
                          ) : null}
                        </>
                      );
                      return (
                        <li
                          key={def.path}
                          className={`grid items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,20rem)_6.5rem] sm:gap-4 sm:px-5 ${
                            missingNeeded
                              ? 'border-l-4 border-rose-500 bg-rose-50 pl-3 sm:pl-4 dark:bg-rose-500/10'
                              : ''
                          }`}
                        >
                          {def.kind === 'multiselect' ? (
                            <span id={`${id}-label`} className="text-sm text-slate-700 dark:text-slate-300">
                              {label}
                            </span>
                          ) : (
                            <label htmlFor={id} className="text-sm text-slate-700 dark:text-slate-300">
                              {label}
                            </label>
                          )}
                          <FieldInput
                            key={`${def.path}-${mountKey}`}
                            id={id}
                            def={def}
                            value={field?.value ?? null}
                            systemValue={
                              filledBySystem
                                ? { value: shown?.value ?? null, messageKey: badge === 'assumed' ? 'assumedOption' : 'inferredOption' }
                                : null
                            }
                            onChange={(value) => onValue(def.path, value)}
                          />
                          <span
                            className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium sm:justify-self-end ${BADGE_CLASS[badge]}`}
                          >
                            {badge === 'assumed' ? <span aria-hidden="true">⚠ </span> : null}
                            {t(`confidence.${badge}`)}
                          </span>
                          {fieldNoteKey(requirement.applicationType, def.path) ? (
                            <p className="text-xs text-slate-500 sm:col-start-2 sm:col-end-4 dark:text-slate-400">
                              {t(`fieldNotes.${fieldNoteKey(requirement.applicationType, def.path)}`)}
                            </p>
                          ) : null}
                          {field?.sourceSpan ? (
                            // Đoạn văn gốc bộ đọc lấy ra — để người dùng đối chiếu (spec §1).
                            <p className="text-xs text-slate-500 sm:col-start-2 sm:col-end-4 dark:text-slate-400">
                              {t('parser.sourceSpan', { span: field.sourceSpan })}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          : null}
        </div>

        {/* V1b: phân tích kỹ thuật chạy trên chính bảng này (engine + đánh giá khả thi). */}
        {requirement ? <AnalysisPanel requirement={requirement} onFocusField={focusAnyField} engineParams={engineParams} /> : null}
        {requirement ? (
          <DesignPanels
            requirement={requirement}
            catalog={catalog}
            selection={base.bom ?? null}
            onSelectionChange={onBomChange}
            readOnly={base.project?.locked === true}
            explainAvailable={explainAvailable}
            engineParams={engineParams}
          />
        ) : null}

        {requirement && missingOnly && shownDefs.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {t('missingOnlyNone')}
          </p>
        ) : null}

        {requirement ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('reset')}
            </button>
          </div>
        ) : null}
        </fieldset>
      </div>

      {resolved ? (
        <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          {assumptionsOpen ? (
            <AssumptionsPanel
              assumptions={resolved.assumptions}
              onFocusField={focusAnyField}
              onCollapse={() => setAssumptionsOpen(false)}
            />
          ) : (
            // Thu gọn: dải dọc hẹp ở màn rộng, nút ngang ở màn hẹp.
            <button
              type="button"
              onClick={openAssumptions}
              aria-expanded={false}
              title={t('assumptions.expand')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-[#E4E5F6] px-3 py-3 text-sm font-semibold text-indigo-950 shadow-sm transition hover:brightness-95 lg:w-11 lg:flex-col lg:px-0 lg:py-4 dark:border-amber-500/30 dark:bg-[#22274A] dark:text-indigo-100"
            >
              <span aria-hidden="true" className="lg:rotate-180">‹</span>
              <span className="lg:[writing-mode:vertical-rl] lg:rotate-180">{t('assumptions.title')}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {resolved.assumptions.length}
              </span>
              {/* Số giả định đáng lo — vẫn thấy khi đang thu gọn. */}
              {warningAssumptions > 0 ? (
                <span
                  title={t('assumptions.warningCount', { count: warningAssumptions })}
                  className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white dark:bg-amber-500 dark:text-slate-950"
                >
                  ⚠ {warningAssumptions}
                </span>
              ) : null}
            </button>
          )}
        </aside>
      ) : null}

      {resolved && assumptionsOverlay ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assumptions-title"
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/50 p-3 lg:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAssumptionsOverlay(false);
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl">
            <AssumptionsPanel
              assumptions={resolved.assumptions}
              onFocusField={(path) => {
                setAssumptionsOverlay(false);
                requestAnimationFrame(() => focusAnyField(path));
              }}
              onCollapse={() => setAssumptionsOverlay(false)}
              collapseLabel={t('assumptions.close')}
            />
          </div>
        </div>
      ) : null}
    </div>
    </KnowledgeProvider>
  );
}

// ─────────────────────────────── Trạng thái đọc mô tả ───────────────────────────────

function ParseStatus({ parse }: { parse: DraftParse | undefined }) {
  const t = useTranslations('designer.requirement.parser');

  let tone: 'info' | 'ok' | 'warn' = 'info';
  let message: string | null = null;

  if (parse) {
    switch (parse.status) {
      case 'ok':
        if (parse.applied > 0) {
          tone = 'ok';
          message = t('filled', { count: parse.applied });
        } else if (parse.pending.length > 0) {
          message = t('pickType', { count: parse.pending.length });
        } else {
          tone = 'warn';
          message = t('noData');
        }
        break;
      case 'empty':
        tone = 'warn';
        message = t('noData');
        break;
      case 'failed':
        tone = 'warn';
        // Mã lỗi hiện luôn: gói Vercel Hobby chỉ giữ log một giờ, không tra lại được.
        message = parse.detail ? t('failedWithCode', { code: parse.detail }) : t('failed');
        break;
      case 'tooLong':
        tone = 'warn';
        message = t('tooLong', { max: PARSE_TEXT_MAX });
        break;
      case 'unavailable':
        message = t('unavailable');
        break;
      case 'cancelled':
        message = t('cancelled');
        break;
      case 'denied':
        message = null;
        break;
    }
  }

  if (!message) return null;
  // Ghi chú không là điểm nhấn (2026-10-15): chỉ cảnh báo giữ màu.
  const color = tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';

  return (
    <div role="status" className={`mt-2 space-y-1 text-xs ${color}`}>
      <p>{message}</p>
      {parse && parse.dropped > 0 ? (
        <p className="text-slate-500 dark:text-slate-400">{t('dropped', { count: parse.dropped })}</p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────── Câu hỏi bổ sung ───────────────────────────────

function RequirementQuestions({
  requirement,
  revision,
  onAnswer,
  visiblePaths,
}: {
  requirement: Requirement;
  revision: number;
  onAnswer: (next: Requirement) => void;
  /** Ô đang hiện theo chế độ — Cơ bản chỉ hỏi câu về ô cơ bản (Q4). */
  visiblePaths: ReadonlySet<string>;
}) {
  const t = useTranslations('designer.requirement.questions');
  const { open, unknown } = useMemo(() => {
    const all = pendingQuestions(requirement);
    return { open: questionsForMode(all.open, visiblePaths), unknown: questionsForMode(all.unknown, visiblePaths) };
  }, [requirement, visiblePaths]);
  const visible = open.slice(0, MAX_VISIBLE_QUESTIONS);
  const more = open.length - visible.length;

  return (
    <section
      aria-labelledby="questions-title"
      className="rounded-2xl border border-sky-200 bg-white shadow-sm dark:border-sky-500/30 dark:bg-slate-900"
    >
      <PanelHeader id="questions-title" title={t('title')} />

      {visible.length > 0 ? (
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map((question) => (
            <QuestionItem
              key={`${question.id}-${revision}`}
              question={question}
              requirement={requirement}
              onAnswer={onAnswer}
            />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-600 sm:px-5 dark:text-slate-400">{t('done')}</p>
      )}

      {more > 0 ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">
          {t('more', { count: more })}
        </p>
      ) : null}

      {unknown.length > 0 ? (
        <div className="border-t border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('markedUnknown')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unknown.map((question) => (
              <li key={question.id}>
                <button
                  type="button"
                  onClick={() => onAnswer(resetQuestion(requirement, question))}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 text-xs text-slate-700 hover:border-sky-500 dark:border-slate-600 dark:text-slate-300"
                >
                  {t(`items.${question.id}.short`)}
                  <span className="text-sky-700 dark:text-sky-400">· {t('askAgain')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function QuestionItem({
  question,
  requirement,
  onAnswer,
}: {
  question: QuestionDef;
  requirement: Requirement;
  onAnswer: (next: Requirement) => void;
}) {
  const t = useTranslations('designer.requirement');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState(false);

  const pending = pendingPaths(requirement, question)
    .map(fieldDef)
    .filter((def): def is RequirementFieldDef => Boolean(def));
  const choiceDefs = pending.filter((def) => def.kind === 'select' || def.kind === 'boolean');
  const numberDefs = pending.filter((def) => def.kind === 'number');
  const purposes = purposesOf(question.ruleIds)
    .map((purpose) => t(`purposes.${purpose}`))
    .join(', ');
  const fieldLabel = (def: RequirementFieldDef) => t(`fields.${def.section}.${def.key}`);

  const submitNumbers = (event: FormEvent | KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const parsed = numberDefs.map((def) => {
      const text = (typed[def.path] ?? '').trim().replace(',', '.');
      const number = Number(text);
      const ok = text !== '' && Number.isFinite(number) && (def.min === undefined || number >= def.min) && (def.max === undefined || number <= def.max);
      return { def, number, ok };
    });
    if (parsed.some((entry) => !entry.ok)) return setInvalid(true);
    onAnswer(parsed.reduce((req, entry) => withFieldValue(req, entry.def.path, entry.number), requirement));
  };

  const headingId = `question-${question.id}`;

  return (
    <li className="px-4 py-4 sm:px-5" aria-labelledby={headingId}>
      <p id={headingId} className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {t(`questions.items.${question.id}.question`)}
      </p>
      {purposes ? <p className={`mt-0.5 ${NOTE_CLASS}`}>→ {purposes}</p> : null}

      <div className="mt-3 space-y-3">
        {choiceDefs.map((def) => (
          <div key={def.path} role="group" aria-label={fieldLabel(def)} className="flex flex-wrap gap-2">
            {def.kind === 'boolean'
              ? (['yes', 'no'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => onAnswer(withFieldValue(requirement, def.path, choice === 'yes'))}
                    className={CHIP_CLASS}
                  >
                    {t(choice)}
                  </button>
                ))
              : (def.options ?? [])
                  .filter((option) => option !== 'unknown')
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onAnswer(withFieldValue(requirement, def.path, option))}
                      className={CHIP_CLASS}
                    >
                      {t(`options.${def.optionsKey}.${option}`)}
                    </button>
                  ))}
          </div>
        ))}

        {numberDefs.length > 0 ? (
          <form onSubmit={submitNumbers} className="flex flex-wrap items-end gap-2">
            {numberDefs.map((def) => (
              <label key={def.path} className="block text-xs text-slate-600 dark:text-slate-400">
                <span className="mb-1 block">
                  {fieldLabel(def)}
                  {def.unit ? ` (${def.unit})` : ''}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={typed[def.path] ?? ''}
                  aria-invalid={invalid || undefined}
                  onChange={(event) => {
                    setInvalid(false);
                    setTyped((current) => ({ ...current, [def.path]: event.target.value }));
                  }}
                  /* Enter gửi câu trả lời một cách tường minh, không trông vào việc trình
                     duyệt tự gửi form (không ổn định với bàn phím ảo / công cụ gõ tự động).
                     Bỏ qua lúc đang gõ tiếng Việt có dấu (IME chưa chốt chữ). */
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) submitNumbers(event);
                  }}
                  className={`${INPUT_CLASS} w-36`}
                />
              </label>
            ))}
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              {t('questions.confirm')}
            </button>
          </form>
        ) : null}

        {question.suggestions && numberDefs[0] ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('questions.suggestions')}</span>
            {question.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAnswer(withFieldValue(requirement, numberDefs[0].path, suggestion))}
                className={CHIP_CLASS}
              >
                {suggestion}
                {numberDefs[0].unit ? ` ${numberDefs[0].unit}` : ''}
              </button>
            ))}
          </div>
        ) : null}

        {invalid ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {t('questions.invalidNumber')}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => onAnswer(answerUnknown(requirement, question))}
          className={`${CHIP_CLASS} border-dashed`}
        >
          {t('questions.unknown')}
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────── Panel giả định ───────────────────────────────

function AssumptionsPanel({
  assumptions,
  onFocusField,
  onCollapse,
  collapseLabel,
}: {
  assumptions: Assumption[];
  onFocusField: (path: string) => void;
  onCollapse: () => void;
  /** Mặc định "Thu gọn ›"; bảng toàn màn hình (màn hẹp) dùng "Đóng". */
  collapseLabel?: string;
}) {
  const t = useTranslations('designer.requirement');
  const locale = useLocale();
  const pick = (text: { vi: string; en: string }) => (locale === 'en' ? text.en : text.vi);

  // Ô trống được hệ thống điền (mặc định hoặc suy ra) — có nút "Sửa trong bảng".
  const filled = assumptions.filter((a) => a.source === 'default' || a.source === 'derived');
  const method = assumptions.filter((a) => a.source === 'adapter' || a.source === 'parameter');

  const titleOf = (assumption: Assumption) => {
    const def = assumption.path ? fieldDef(assumption.path) : undefined;
    if (def) return t(`fields.${def.section}.${def.key}`);
    return assumption.title ? pick(assumption.title) : assumption.key;
  };
  const valueOf = (assumption: Assumption) => {
    if (assumption.value === undefined) return null;
    const def = assumption.path ? fieldDef(assumption.path) : undefined;
    if (def?.kind === 'select') return t(`options.${def.optionsKey}.${assumption.value}`);
    if (typeof assumption.value === 'boolean') return t(assumption.value ? 'yes' : 'no');
    return assumption.unit ? `${assumption.value} ${assumption.unit}` : String(assumption.value);
  };

  const row = (assumption: Assumption) => {
    const value = valueOf(assumption);
    const highlight = method.includes(assumption) && assumption.level === 'warning';
    const purposes = purposesOf(assumption.ruleIds)
      .map((purpose) => t(`purposes.${purpose}`))
      .join(', ');
    return (
      <li key={assumption.key} className={`px-4 py-3 ${highlight ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {assumption.level === 'warning' ? (
              <span className="text-amber-600 dark:text-amber-400" title={t('assumptions.warningLabel')}>
                ⚠{' '}
              </span>
            ) : null}
            {titleOf(assumption)}
            {value !== null ? (
              <>
                : <span className="tabular-nums">{value}</span>
              </>
            ) : null}
          </p>
          {assumption.path ? (
            <button
              type="button"
              onClick={() => onFocusField(assumption.path!)}
              className="shrink-0 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              {t('assumptions.editInTable')}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{pick(assumption)}</p>
        {purposes || assumption.source === 'parameter' ? (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {purposes ? `→ ${purposes}` : null}
            {purposes && assumption.source === 'parameter' ? ' · ' : null}
            {assumption.source === 'parameter' ? t('assumptions.fixedInCode') : null}
          </p>
        ) : null}
      </li>
    );
  };

  const heading = 'px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <section
      aria-labelledby="assumptions-title"
      className="rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-500/30 dark:bg-slate-900"
    >
      <PanelHeader
        id="assumptions-title"
        title={
          <>
            {t('assumptions.title')}{' '}
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {assumptions.length}
            </span>
          </>
        }
        note={t('assumptions.subtitle')}
        actions={
          <button
            type="button"
            onClick={onCollapse}
            aria-expanded={true}
            className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
          >
            {collapseLabel ?? `${t('assumptions.collapse')} ›`}
          </button>
        }
      />

      <h3 className={heading}>{t('assumptions.defaultsTitle')}</h3>
      {filled.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{filled.map(row)}</ul>
      ) : (
        <p className="px-4 pb-3 text-sm text-slate-600 dark:text-slate-400">{t('assumptions.noDefaults')}</p>
      )}

      {method.length > 0 ? (
        <>
          <h3 className={`${heading} border-t border-slate-200 dark:border-slate-800`}>
            {t('assumptions.methodTitle')}
          </h3>
          <ul className="divide-y divide-slate-100 pb-1 dark:divide-slate-800">{method.map(row)}</ul>
        </>
      ) : null}
    </section>
  );
}

// ─────────────────────────────── Ô trên bảng ───────────────────────────────

function FieldInput({
  id,
  def,
  value,
  systemValue,
  onChange,
}: {
  id: string;
  def: RequirementFieldDef;
  value: unknown;
  /** Giá trị hệ thống đang điền khi ô trống (giả định / suy ra) — chỉ là gợi ý, không phải giá trị ô. */
  systemValue: { value: unknown; messageKey: 'assumedOption' | 'inferredOption' } | null;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('designer.requirement');
  const optionLabel = (option: string) => t(`options.${def.optionsKey}.${option}`);

  switch (def.kind) {
    case 'number':
      return (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min={def.min}
          max={def.max}
          defaultValue={typeof value === 'number' ? value : ''}
          placeholder={
            systemValue && systemValue.value !== null
              ? t(systemValue.messageKey, { value: String(systemValue.value) })
              : undefined
          }
          onChange={(event) => {
            const text = event.target.value.trim();
            if (text === '') return onChange(null);
            const parsed = Number(text);
            if (Number.isFinite(parsed) && (def.min === undefined || parsed >= def.min) && (def.max === undefined || parsed <= def.max)) {
              onChange(parsed);
            }
          }}
          className={INPUT_CLASS}
        />
      );

    case 'text':
      return (
        <input
          id={id}
          type="text"
          defaultValue={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value.trim() || null)}
          className={INPUT_CLASS}
        />
      );

    case 'select':
      return (
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          className={INPUT_CLASS}
        >
          <option value="">
            {systemValue && typeof systemValue.value === 'string'
              ? t(systemValue.messageKey, { value: optionLabel(systemValue.value) })
              : t('notSet')}
          </option>
          {(def.options ?? []).map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <select
          id={id}
          value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={(event) =>
            onChange(event.target.value === 'yes' ? true : event.target.value === 'no' ? false : null)
          }
          className={INPUT_CLASS}
        >
          <option value="">
            {/* Ô Có/Không cũng có thể do hệ thống giả định (vắt qua đường ghép — MEC-003). */}
            {systemValue && typeof systemValue.value === 'boolean'
              ? t(systemValue.messageKey, { value: t(systemValue.value ? 'yes' : 'no') })
              : t('notSet')}
          </option>
          <option value="yes">{t('yes')}</option>
          <option value="no">{t('no')}</option>
        </select>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-4 gap-y-2">
          {(def.options ?? []).map((option) => (
            <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, option] : selected.filter((item) => item !== option)
                  )
                }
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              {optionLabel(option)}
            </label>
          ))}
        </div>
      );
    }
  }
}
