import { getTranslations } from 'next-intl/server';

/**
 * Đổi lỗi thô của Postgres thành câu người dùng hiểu được. Chỉ dùng phía server.
 *
 * Trước đây admin lưu trùng slug thì nhận nguyên văn:
 *   duplicate key value violates unique constraint "kpi_problem_types_slug_key"
 * Vừa không nói được phải sửa gì, vừa để lộ tên bảng và tên ràng buộc ra giao
 * diện. Nguyên văn vẫn được ghi vào log server để còn lần được khi cần.
 */

export type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

/** Mã lỗi Postgres → khoá dịch trong namespace admin.dbErrors. */
const CODE_TO_KEY: Record<string, string> = {
  '23502': 'missingField', // not_null_violation
  '23503': 'inUse', // foreign_key_violation
  '23505': 'duplicate', // unique_violation
  '23514': 'checkFailed', // check_violation
  '22003': 'outOfRange', // numeric_value_out_of_range
  '22P02': 'badFormat', // invalid_text_representation
  '42501': 'notAllowed', // insufficient_privilege — thường là RLS chặn
};

/**
 * @param error   lỗi trả về từ supabase-js
 * @param context nhãn ngắn ghi kèm vào log để biết chỗ nào hỏng
 */
export async function dbError(error: DbErrorLike, context: string): Promise<string> {
  console.error(`[db] ${context}`, {
    code: error.code,
    message: error.message,
    details: error.details,
  });

  const t = await getTranslations('admin.dbErrors');
  const key = error.code ? CODE_TO_KEY[error.code] : undefined;
  return t(key ?? 'unknown');
}
