'use client';

import { useTranslations } from 'next-intl';

/**
 * Dùng chung cho các file error.tsx.
 *
 * Không hiển thị nội dung lỗi thô cho người dùng cuối — thông báo của Postgres
 * có thể lộ tên bảng, tên cột, cấu trúc truy vấn. Chi tiết chỉ hiện ở chế độ
 * development để lập trình viên gỡ lỗi; production chỉ có digest để đối chiếu
 * với log phía server.
 */
export function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <h1 className="text-lg font-semibold text-red-900 dark:text-red-200">{t('title')}</h1>
        <p className="mt-2 text-sm text-red-800 dark:text-red-300">{t('body')}</p>

        {isDev ? (
          <pre className="mt-4 overflow-x-auto rounded bg-red-100 p-3 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-200">
            {error.message}
          </pre>
        ) : null}

        {error.digest ? (
          <p className="mt-3 text-xs text-red-700 dark:text-red-400">
            {t('digest')}: <code>{error.digest}</code>
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          {t('retry')}
        </button>
      </div>
    </section>
  );
}
