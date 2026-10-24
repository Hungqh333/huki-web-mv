'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { attachReportAction, createReportUploadAction } from '@/app/actions/lightExperiments';
import { createClient } from '@/lib/supabase/client';
import { inputClass } from './ExperimentFields';

/** Tên kho — trùng EXPERIMENTS_BUCKET (lib/lightExperiments.ts, chỉ chạy máy chủ). */
const BUCKET = 'light-experiments';

/**
 * Tải báo cáo PDF / PPTX tới 50 MB (chốt 2026-10-24 Q11). File đi THẲNG từ trình duyệt lên kho
 * bằng link tải ký tên do máy chủ cấp — không qua máy chủ, nên không vướng giới hạn 4,5 MB của
 * Vercel. Máy chủ kiểm quyền admin, loại file, cỡ file trước khi cấp link.
 */
export function ExperimentReportUpload({ experimentId }: { experimentId: string }) {
  const t = useTranslations('admin.experiments');
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setState({ busy: true, error: null });
    const ticket = await createReportUploadAction(experimentId, file.type, file.size);
    if ('error' in ticket) return setState({ busy: false, error: ticket.error });
    const { error } = await createClient().storage.from(BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
    if (error) return setState({ busy: false, error: 'db' });
    const attached = await attachReportAction(experimentId, ticket.path, file.name);
    if ('error' in attached) return setState({ busy: false, error: attached.error });
    setState({ busy: false, error: null });
    router.refresh();
  };

  return (
    <div>
      <input
        type="file"
        disabled={state.busy}
        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={(e) => upload(e.target.files?.[0])}
        className={inputClass}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{state.busy ? t('report.uploading') : t('report.hint')}</p>
      {state.error ? (
        <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
    </div>
  );
}
