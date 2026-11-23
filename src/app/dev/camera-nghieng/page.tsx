import { notFound, redirect } from 'next/navigation';

/** Xem trước cũ — chuyển sang trang thử Kiểm tra lắp đặt với khung Camera nghiêng mở sẵn (chốt 2026-11-23 vòng 2). */
export default function DevObliqueRedirect() {
  if (process.env.NODE_ENV === 'production') notFound();
  redirect('/dev/kiem-tra-lap-dat?nghieng=1');
}
