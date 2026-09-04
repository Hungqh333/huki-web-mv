'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/Icon';
import { applyTheme, getStoredTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; icon: IconName }[] = [
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
  { value: 'system', icon: 'monitor' },
];

/**
 * Theo dõi lựa chọn nền đang lưu.
 *
 * Dùng useSyncExternalStore thay vì đọc localStorage trong effect: server luôn
 * trả 'system', client trả giá trị thật, React tự khớp lại sau hydrate mà không
 * cảnh báo lệch. 'storage' bắt thay đổi từ tab khác; 'themechange' là sự kiện
 * tự phát khi người dùng bấm ở ngay tab này.
 */
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('themechange', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('themechange', callback);
  };
}

export function ThemeToggle() {
  const t = useTranslations('theme');
  const theme = useSyncExternalStore<Theme>(subscribe, getStoredTheme, () => 'system');

  // Chọn "Hệ thống" thì bám cả thay đổi realtime của máy (tới giờ tối máy tự đổi).
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const choose = (next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Không lưu được (chế độ riêng tư) thì vẫn đổi cho phiên hiện tại.
    }
    applyTheme(next);
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('title')}
      className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              active
                ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-950 dark:text-sky-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon name={option.icon} className="size-4" />
            {t(option.value)}
          </button>
        );
      })}
    </div>
  );
}
