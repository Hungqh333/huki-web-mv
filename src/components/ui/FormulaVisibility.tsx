'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Có hiện dòng công thức (đã thay số) trên màn hình không — bảo vệ công thức, chốt 2026-10-21
 * đợt 1: chỉ admin thấy. Trang (server) quyết định theo vai trò rồi bọc provider; mặc định ẨN,
 * nên component quên bọc cũng không lộ.
 *
 * Đây mới là ẩn trên giao diện: engine còn chạy trong trình duyệt tới khi các đợt 2–4 đưa về
 * máy chủ.
 */
const FormulaVisibilityContext = createContext(false);

export function FormulaVisibilityProvider({ show, children }: { show: boolean; children: ReactNode }) {
  return <FormulaVisibilityContext.Provider value={show}>{children}</FormulaVisibilityContext.Provider>;
}

export function useShowFormulas(): boolean {
  return useContext(FormulaVisibilityContext);
}
