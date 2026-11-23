import { redirect } from 'next/navigation';

/**
 * Trang riêng Camera nghiêng đã gộp vào Kiểm tra lắp đặt thành khung gập (chốt 2026-11-23 vòng 2, Q1).
 * Giữ đường dẫn cũ: chuyển sang /kiem-tra-lap-dat với khung Camera nghiêng mở sẵn.
 */
export default function ObliqueRedirect() {
  redirect('/kiem-tra-lap-dat?nghieng=1');
}
