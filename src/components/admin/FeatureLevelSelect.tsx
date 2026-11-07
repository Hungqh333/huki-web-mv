'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { updateFeatureLevelAction } from '@/app/actions/permissions';
import { FEATURE_LEVELS, type FeatureKey, type FeatureLevel } from '@/lib/permissions';

/**
 * Ô chọn mức tối thiểu của một nhóm chức năng trên bảng quyền (Admin, chốt 2026-11-07 đợt 2).
 * Hỏi lại trước khi đổi vì có hiệu lực ngay cho mọi người dùng. `preview`: trang xem trước local,
 * chỉ đổi trên màn hình, không lưu.
 */
export function FeatureLevelSelect({
  feature,
  level,
  featureLabel,
  preview = false,
}: {
  feature: FeatureKey;
  level: FeatureLevel;
  featureLabel: string;
  preview?: boolean;
}) {
  const t = useTranslations('admin.permissions');
  const tRoles = useTranslations('roles');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Bảng cha đặt key theo mức đã lưu → lưu xong, trang tải lại là ô chọn lấy mức mới.
  const [current, setCurrent] = useState<FeatureLevel>(level);

  const change = (next: FeatureLevel) => {
    if (next === current) return;
    if (!window.confirm(t('confirm', { feature: featureLabel, from: tRoles(current), to: tRoles(next) }))) return;
    setCurrent(next);
    if (preview) {
      setMessage({ ok: true, text: t('previewOnly') });
      return;
    }
    startTransition(async () => {
      const result = await updateFeatureLevelAction(feature, next);
      setMessage(result.ok ? { ok: true, text: t('saved') } : { ok: false, text: t(`errors.${result.error}`) });
      if (result.ok) router.refresh();
      else setCurrent(level);
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={current}
        disabled={pending}
        aria-label={t('levelFor', { feature: featureLabel })}
        onChange={(e) => change(e.target.value as FeatureLevel)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {FEATURE_LEVELS.map((option) => (
          <option key={option} value={option}>
            {t('fromLevel', { role: tRoles(option) })}
          </option>
        ))}
      </select>
      {message ? (
        <span className={`text-xs ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{message.text}</span>
      ) : null}
    </span>
  );
}
