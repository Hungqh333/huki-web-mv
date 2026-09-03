'use client';

import { cloneElement, isValidElement, useId, type ReactElement } from 'react';

/**
 * Ô nhập của khu quản trị, có nhãn liên kết đúng.
 *
 * Trước đây bốn form quản trị mỗi form tự viết một bản Field cục bộ, cả bốn đều
 * thiếu htmlFor/id — khoảng 50 ô nhập không có nhãn liên kết. Trình đọc màn hình
 * đọc là "edit blank"; bấm vào chữ nhãn cũng không focus vào ô.
 *
 * Component này tự sinh id và gắn vào phần tử con, nên chỗ gọi không phải nhớ
 * truyền id — đúng cách mà src/components/ui/Field.tsx đã làm từ đầu.
 */
export function AdminField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const generatedId = useId();
  const hintId = hint ? `${generatedId}-hint` : undefined;
  const errorId = error ? `${generatedId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? generatedId,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={children.props.id ?? generatedId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
