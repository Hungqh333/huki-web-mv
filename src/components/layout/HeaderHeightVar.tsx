'use client';

import { useEffect } from 'react';

/**
 * Thanh menu đứng yên khi cuộn trang (2026-11-11, Hùng: "lăn chuột các mục này lại lăn theo, khoá lại").
 * Ghi chiều cao header đang đứng yên vào biến CSS --header-h trên <html>, để cột sticky (top-6)
 * và nhảy tới #mục không chui xuống dưới header. Màn hẹp (dưới lg) header không đứng yên → 0.
 */
export function HeaderHeightVar({ targetId }: { targetId: string }) {
  useEffect(() => {
    const header = document.getElementById(targetId);
    if (!header) return;
    const root = document.documentElement;
    const wide = window.matchMedia('(min-width: 1024px)');
    const update = () => root.style.setProperty('--header-h', wide.matches ? `${header.offsetHeight}px` : '0px');
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    wide.addEventListener('change', update);
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', update);
      root.style.removeProperty('--header-h');
    };
  }, [targetId]);
  return null;
}
