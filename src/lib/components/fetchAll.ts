/**
 * Đọc HẾT các dòng của một truy vấn Supabase, theo từng trang.
 *
 * PostgREST của Supabase trả tối đa 1.000 dòng mỗi lần (max-rows). Kho thiết bị
 * thật (2026-10-17: ~1.760 món đang bật) vượt mức đó: trang Yêu cầu chỉ nhận 1.000
 * dòng đầu — xếp theo loại nên mất nửa ống kính và toàn bộ đèn — và cả ba mức
 * phương án báo "kho chưa có cặp nào". Mọi chỗ đọc kho phải đi qua hàm này.
 *
 * `page(from, to)` dựng truy vấn có `.range(from, to)` và thứ tự ỔN ĐỊNH (thêm khoá
 * duy nhất như `id` vào cuối order) — thiếu thứ tự ổn định thì giữa các trang có
 * thể trùng / sót dòng.
 */
export const FETCH_PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = FETCH_PAGE_SIZE
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { data: rows, error: null };
  }
}
