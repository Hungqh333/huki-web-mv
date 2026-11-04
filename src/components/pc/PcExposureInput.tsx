'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Ô thời gian phơi sáng của tab Bảng fps: gõ xong một nhịp thì đổi `?phoi=` để máy chủ tính lại bảng. */
export function PcExposureInput({ initial, label }: { initial: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [value, setValue] = useState(initial > 0 ? String(initial) : '0');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const ms = Number(value.replace(',', '.'));
      const next = new URLSearchParams(search.toString());
      if (Number.isFinite(ms) && ms > 0) next.set('phoi', String(ms));
      else next.delete('phoi');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, pathname, router, search]);

  return (
    <label className="flex w-64 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <input
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}
