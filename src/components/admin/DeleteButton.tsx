'use client';

import { useTranslations } from 'next-intl';

/**
 * Nút xoá có bước xác nhận.
 *
 * Trước đây bốn bảng quản trị đều dùng form + button trần: bấm nhầm là mất dữ
 * liệu ngay, không hoàn tác được. Nút lại nằm cùng hàng với link mở bản ghi và
 * chỉ cao ~16px. Một dòng bảng chỉ tiêu chứa khoảng 20 con số đã hiệu chỉnh —
 * nhập lại từ đầu là mất cả buổi.
 *
 * confirm() của trình duyệt là đủ ở đây: nó chặn được thao tác nhầm, không cần
 * dựng hộp thoại riêng cho một hành động hiếm khi dùng.
 */
export function DeleteButton({
  action,
  id,
  itemName,
}: {
  action: (formData: FormData) => void;
  id: string;
  itemName: string;
}) {
  const t = useTranslations('admin.common');

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t('confirmDelete', { name: itemName }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:underline dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {t('delete')}
      </button>
    </form>
  );
}
