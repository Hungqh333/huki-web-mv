import 'server-only';

import type { AbstractIntlMessages } from 'next-intl';
import { getMessages } from 'next-intl/server';

/**
 * Chữ gửi xuống trình duyệt cho trang Danh mục. Namespace 'admin' không đi xuống client ở
 * mọi trang (app/layout.tsx) — ở đây chỉ lấy tên loại / thông số / nguồn thông số của
 * admin.components (chỉ là nhãn, không có mô tả thao tác quản trị). Provider lồng THAY
 * danh sách chữ của provider ngoài, nên phải gửi kèm 'catalog'.
 */
export async function catalogClientMessages() {
  const messages = (await getMessages()) as Record<string, Record<string, unknown>>;
  const components = (messages.admin?.components ?? {}) as Record<string, unknown>;
  return {
    catalog: messages.catalog,
    admin: {
      components: {
        kinds: components.kinds,
        spec: components.spec,
        sources: components.sources,
        filterLabel: components.filterLabel,
      },
    },
  } as AbstractIntlMessages;
}
