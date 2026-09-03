import type { KpiDataSource } from './types';

export type ContractInput = {
  locale: 'vi' | 'en';
  taskName: string;
  miss: number;
  falseReject: number;
  recheck: number;
  totalBurden: number;
  falseRejectWeek1: { min: number; max: number };
  rampUpWeeks: { min: number; max: number };
  p0: number | null;
  dataSource: KpiDataSource;
  generatedAt: string;
};

const n = (value: number) => value.toFixed(2).replace(/\.?0+$/, '');

/**
 * Câu mô tả bắt ảo tuần đầu.
 *
 * Chỉ khẳng định "cao hơn mức cam kết" khi nó thật sự cao hơn. Trước đây câu này
 * được viết cứng, nên với hệ số điều chỉnh lớn nó in ra một khoảng NHỎ HƠN mức
 * cam kết ngay phía trên kèm chữ "cao hơn" — điều khoản tự mâu thuẫn, khách hàng
 * đọc ra ngay.
 */
function week1Sentence(week1: { min: number; max: number }, committed: number, locale: 'vi' | 'en') {
  const isHigher = week1.max > committed;

  if (locale === 'en') {
    return isHigher
      ? `False rejects in the first two weeks are expected at ${n(week1.min)}–${n(week1.max)}%, above the
   committed level, because thresholds are set conservatively until the
   system has enough real production data.`
      : `False rejects in the first two weeks are expected at ${n(week1.min)}–${n(week1.max)}%. Thresholds are
   set conservatively until the system has enough real production data.`;
  }

  return isHigher
    ? `Tỷ lệ bắt ảo trong 2 tuần đầu dự kiến ở mức ${n(week1.min)}–${n(week1.max)}%, cao hơn
   mức cam kết do ngưỡng được đặt thiên về an toàn khi hệ thống chưa đủ dữ
   liệu thực tế.`
    : `Tỷ lệ bắt ảo trong 2 tuần đầu dự kiến ở mức ${n(week1.min)}–${n(week1.max)}%. Ngưỡng trong
   giai đoạn này được đặt thiên về an toàn khi hệ thống chưa đủ dữ liệu thực tế.`;
}

/**
 * Sinh BẢN NHÁP điều khoản chất lượng.
 *
 * Cố ý đóng dấu "BẢN NHÁP" ngay đầu văn bản và kèm khối cảnh báo. Lý do: các con
 * số trong bảng chỉ tiêu hiện là ƯỚC LƯỢNG, chưa đối chiếu với lịch sử dự án của
 * công ty. Một bản văn sạch sẽ với nút sao chép là lời mời dán thẳng vào hợp
 * đồng thật — và khi đó công ty bị ràng buộc pháp lý vào con số chưa ai kiểm.
 *
 * Khối cảnh báo chỉ biến mất khi dữ liệu đã được hiệu chỉnh (data_source khác
 * 'estimate'), và ngay cả khi đó vẫn giữ dòng nhắc rà soát phụ lục.
 */
export function buildContractDraft(input: ContractInput): string {
  return input.locale === 'en' ? buildEnglish(input) : buildVietnamese(input);
}

function warningBlock(input: ContractInput): string {
  const lines = [
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║  BẢN NHÁP — CHƯA ĐƯỢC DÙNG TRỰC TIẾP TRONG HỢP ĐỒNG                 ║',
    '╚══════════════════════════════════════════════════════════════════════╝',
    '',
    'Trước khi đưa vào hợp đồng, bắt buộc:',
    '',
    '  1. Điền Phụ lục A (danh mục lỗi) và Phụ lục B (điều kiện sản xuất).',
    '     Điều khoản này VÔ HIỆU nếu hai phụ lục đó để trống.',
    '  2. Đối chiếu con số với dự án tương tự công ty đã làm.',
    '  3. Trưởng bộ phận Vision và bộ phận pháp chế cùng duyệt.',
  ];

  if (input.dataSource === 'estimate') {
    lines.push(
      '',
      '  ⚠  Các chỉ tiêu dưới đây lấy từ dải ƯỚC LƯỢNG theo kinh nghiệm ngành,',
      '     CHƯA đối chiếu với lịch sử dự án của công ty. Đừng cam kết những con',
      '     số này khi chưa có người có kinh nghiệm xác nhận.'
    );
  }

  lines.push('', `Sinh lúc: ${input.generatedAt}`, '');
  return lines.join('\n');
}

function buildVietnamese(input: ContractInput): string {
  const p0 = input.p0 !== null ? n(input.p0) : '____';

  return `${warningBlock(input)}
════════════════════════════════════════════════════════════════════════

ĐIỀU ___ : CHỈ TIÊU CHẤT LƯỢNG HỆ THỐNG VISION

Bài toán: ${input.taskName}

1. ĐIỀU KIỆN BIÊN — chỉ tiêu chỉ có hiệu lực khi đồng thời thỏa mãn:
   a) Khuyết tật thuộc Danh mục lỗi tại Phụ lục A;
   b) Điều kiện sản xuất trong phạm vi Phụ lục B (vật liệu, nhà cung cấp,
      dung sai, độ bóng, độ sạch, cách cấp phôi, rung động, ánh sáng,
      chu kỳ vệ sinh quang học);
   c) Tỷ lệ NG đầu vào p ≤ ${p0}%;
   d) Tỷ trọng từng loại lỗi không lệch quá ±50% so với Phụ lục A.

2. CHỈ TIÊU CAM KẾT (nghiệm thu FAT)
   - Tỷ lệ bỏ sót       ≤ ${n(input.miss)}%   trên tổng số mẫu NG thật
   - Tỷ lệ bắt ảo       ≤ ${n(input.falseReject)}%   trên tổng số mẫu OK thật
   - Tỷ lệ tái kiểm     ≤ ${n(input.recheck)}%   trên tổng sản lượng
   - Tổng tải phụ       ≤ ${n(input.totalBurden)}%   trên tổng sản lượng
   Đo trên Bộ mẫu vàng niêm phong, chạy lặp 3 lần.

3. CHỈ TIÊU VẬN HÀNH — theo bảng bậc thang tại Phụ lục C. Đây là chỉ tiêu
   theo dõi và cải tiến, KHÔNG phải điều kiện nghiệm thu.

4. RAMP-UP ${n(input.rampUpWeeks.min)}–${n(input.rampUpWeeks.max)} tuần kể từ ngày sản xuất thương mại.
   Trong giai đoạn này chỉ tiêu vận hành là MỤC TIÊU THAM CHIẾU, KHÔNG phải
   điều kiện phạt.
   ${week1Sentence(input.falseRejectWeek1, input.falseReject, 'vi')}
   Kết thúc Ramp-up, hai bên lập biên bản chốt chỉ tiêu chính thức.

5. RE-BASELINE — chỉ tiêu vận hành được tính lại khi:
   (a) p trung bình 30 ngày vượt dải hiệu lực;
   (b) tỷ trọng loại lỗi bất kỳ thay đổi quá ±50% so với Phụ lục A;
   (c) xuất hiện loại lỗi mới ngoài Phụ lục A;
   (d) thay đổi vật liệu, nhà cung cấp, hoặc thông số quá trình phía trước.
   Hai bên họp trong 10 ngày làm việc. Chỉ tiêu tại mục 2 KHÔNG thay đổi.

6. FAIL-SAFE — mọi trường hợp mất kết nối, không thu được ảnh, timeout,
   không nhận diện được sản phẩm đều được xử lý như NG.

7. TRỌNG TÀI & TRUY VẾT
   Bên xác định NG thật: ________, theo tiêu chuẩn ________.
   Lưu 100% ảnh kèm điểm số, thời gian, mã sản phẩm, tối thiểu 30 ngày.
   Khi có lỗi lọt, truy ảnh gốc để phân loại nguyên nhân: ngoài Danh mục lỗi /
   ngoài Điều kiện biên / trong phạm vi cam kết.

════════════════════════════════════════════════════════════════════════
PHỤ LỤC A — DANH MỤC LỖI                                    [ CẦN ĐIỀN ]
PHỤ LỤC B — ĐIỀU KIỆN SẢN XUẤT                              [ CẦN ĐIỀN ]
PHỤ LỤC C — BẢNG BẬC THANG CHỈ TIÊU VẬN HÀNH                [ CẦN ĐIỀN ]
════════════════════════════════════════════════════════════════════════
`;
}

function buildEnglish(input: ContractInput): string {
  const p0 = input.p0 !== null ? n(input.p0) : '____';

  const warning = [
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║  DRAFT — NOT FOR DIRECT USE IN A CONTRACT                            ║',
    '╚══════════════════════════════════════════════════════════════════════╝',
    '',
    'Before this goes into a contract you must:',
    '',
    '  1. Complete Appendix A (defect list) and Appendix B (production',
    '     conditions). This clause is VOID if either is left blank.',
    '  2. Cross-check the numbers against comparable delivered projects.',
    '  3. Obtain sign-off from the Vision department head and from legal.',
  ];

  if (input.dataSource === 'estimate') {
    warning.push(
      '',
      '  ⚠  The targets below come from ESTIMATED industry ranges and have NOT',
      '     been checked against this company\'s project history. Do not commit',
      '     to them without confirmation from an experienced engineer.'
    );
  }

  warning.push('', `Generated: ${input.generatedAt}`, '');

  return `${warning.join('\n')}
════════════════════════════════════════════════════════════════════════

ARTICLE ___ : VISION SYSTEM QUALITY TARGETS

Application: ${input.taskName}

1. BOUNDARY CONDITIONS — the targets apply only while all of the following hold:
   a) The defect falls within the Defect List in Appendix A;
   b) Production conditions stay within Appendix B (material, supplier,
      tolerance, gloss, cleanliness, feeding method, vibration, lighting,
      optical cleaning schedule);
   c) Incoming NG rate p ≤ ${p0}%;
   d) The share of each defect class stays within ±50% of Appendix A.

2. COMMITTED TARGETS (FAT acceptance)
   - Miss rate          ≤ ${n(input.miss)}%   of all true NG samples
   - False reject rate  ≤ ${n(input.falseReject)}%   of all true OK samples
   - Recheck rate       ≤ ${n(input.recheck)}%   of total volume
   - Total burden       ≤ ${n(input.totalBurden)}%   of total volume
   Measured on the sealed Golden Sample Set, three repeated runs.

3. OPERATIONAL TARGETS — per the ladder in Appendix C. These are monitoring
   and improvement targets, NOT acceptance conditions.

4. RAMP-UP ${n(input.rampUpWeeks.min)}–${n(input.rampUpWeeks.max)} weeks from the start of commercial production.
   During this period the operational targets are REFERENCE GOALS, not
   grounds for penalty.
   ${week1Sentence(input.falseRejectWeek1, input.falseReject, 'en')}
   At the end of ramp-up both parties record the final targets in writing.

5. RE-BASELINE — operational targets are recalculated when:
   (a) the 30-day average p moves outside the valid range;
   (b) the share of any defect class changes by more than ±50% vs Appendix A;
   (c) a defect class appears that is not in Appendix A;
   (d) material, supplier or upstream process parameters change.
   Both parties meet within 10 working days. The targets in clause 2 do NOT change.

6. FAIL-SAFE — loss of connection, failure to capture an image, timeout, or
   failure to identify the product are all handled as NG.

7. ARBITRATION & TRACEABILITY
   Party determining true NG: ________, per standard ________.
   Store 100% of images with scores, timestamps and product IDs for at least 30 days.
   On an escape, retrieve the original image and classify the cause: outside the
   Defect List / outside the Boundary Conditions / within the committed scope.

════════════════════════════════════════════════════════════════════════
APPENDIX A — DEFECT LIST                                  [ TO BE FILLED ]
APPENDIX B — PRODUCTION CONDITIONS                        [ TO BE FILLED ]
APPENDIX C — OPERATIONAL TARGET LADDER                    [ TO BE FILLED ]
════════════════════════════════════════════════════════════════════════
`;
}
