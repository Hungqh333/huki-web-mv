/**
 * Chế độ nền: sáng, tối, hoặc theo hệ thống.
 *
 * Trước đây app chỉ chạy theo prefers-color-scheme của máy — không cho người
 * dùng tự chọn. Giờ variant `dark:` của Tailwind được chuyển sang bám class
 * `.dark` trên thẻ <html> (xem globals.css), và JS ở đây quyết định lúc nào gắn
 * class đó.
 */
export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';
export const THEMES: Theme[] = ['light', 'dark', 'system'];

/** Đọc lựa chọn đã lưu; giá trị lạ hoặc chưa lưu thì coi là 'system'. */
export function getStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư) — mặc định theo hệ thống.
  }
  return 'system';
}

/** Gắn/gỡ class .dark trên <html> theo lựa chọn. 'system' thì hỏi máy. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * Script nhúng thẳng vào <head>, chạy TRƯỚC khi trang vẽ để không bị nháy nền
 * sáng một nhịp rồi mới sang tối (FOUC). Cố ý viết tay gọn thay vì import module
 * vì nó phải chạy đồng bộ trước mọi thứ khác.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((t==='system'||!t)&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
