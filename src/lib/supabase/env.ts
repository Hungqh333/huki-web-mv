export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/**
 * Đọc cấu hình Supabase mà không ném lỗi.
 * Trả về null khi chưa cấu hình, để những chỗ chỉ "đọc thêm cho vui" (ví dụ
 * Header kiểm tra xem đã đăng nhập chưa) không làm sập cả trang khi dev mới
 * clone repo và chưa điền .env.local.
 */
export function getSupabaseEnvOptional(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function hasSupabaseEnv(): boolean {
  return getSupabaseEnvOptional() !== null;
}

/**
 * Dùng cho các thao tác bắt buộc phải có Supabase (đăng nhập, đăng ký, đọc dữ
 * liệu). Ném lỗi to và rõ thay vì thất bại âm thầm.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnvOptional();

  if (!env) {
    throw new Error(
      'Thiếu biến môi trường Supabase. Sao chép .env.example thành .env.local và điền ' +
        'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return env;
}
