/**
 * Bảng ký hiệu của Sổ tay công thức — mục "0. Bảng ký hiệu" trên /admin/cong-thuc
 * (chốt 2026-11-10: Q1 A chỉ trong sổ tay, Q2 A không vẽ hình riêng, trỏ tới hình của mục).
 * Chỉ là chữ giải thích, không có số engine: hằng số và ngưỡng vẫn nằm ở mục tương ứng.
 * Cột "see" là mã mục trong FORMULA_BOOK (scripts/test-formula-book.ts kiểm mã tồn tại).
 */

import { WAVELENGTH_UM } from '@/lib/vision/optics';

export type FormulaSymbol = {
  symbol: string;
  name: string;
  unit: string;
  meaning: string;
  /** Mã mục trong sổ tay có công thức / hình minh hoạ cho ký hiệu này. */
  see: string[];
};

export type FormulaSymbolGroup = { title: string; rows: FormulaSymbol[] };

export const FORMULA_SYMBOLS: readonly FormulaSymbolGroup[] = [
  {
    title: 'Hình học ống kính',
    rows: [
      {
        symbol: 'f',
        name: 'Tiêu cự',
        unit: 'mm',
        meaning: 'Ghi trên ống (ống 50 mm → f = 50). Cùng khoảng cách, f lớn thì nhìn hẹp, vật to hơn trên ảnh.',
        see: ['OPT-001', 'LNS-002'],
      },
      {
        symbol: 'WD',
        name: 'Khoảng cách làm việc',
        unit: 'mm',
        meaning: 'Từ MẶT TRƯỚC ống tới bề mặt vật (cùng cách đo với MOD trong datasheet).',
        see: ['OPT-001', 'LNS-002', 'OPT-012'],
      },
      {
        symbol: 'MOD',
        name: 'Khoảng cách lấy nét gần nhất',
        unit: 'mm',
        meaning: 'Vật gần hơn MOD thì vặn hết vòng lấy nét vẫn mờ; muốn gần hơn phải thêm ống nối. Datasheet ghi "M.O.D." hoặc "Min. object distance".',
        see: ['OPT-001', 'OPT-010'],
      },
      {
        symbol: 'sF',
        name: 'Khoảng tiêu điểm trước',
        unit: 'mm',
        meaning: 'Từ mặt trước ống tới tiêu điểm trước F. Có thể âm (F nằm trong thân ống, hay gặp ở ống góc rộng). Ống chưa khai coi = 0 và hiện "≈".',
        see: ['OPT-001', 'OPT-010'],
      },
      {
        symbol: 'x · x′',
        name: 'Khoảng cách Newton',
        unit: 'mm',
        meaning: 'x = vật → tiêu điểm trước = WD − sF; x′ = tiêu điểm sau → ảnh. Quan hệ x × x′ = f².',
        see: ['OPT-001', 'OPT-010'],
      },
      {
        symbol: 'β',
        name: 'Độ phóng đại quang học',
        unit: '×',
        meaning: 'Cỡ ảnh trên cảm biến ÷ cỡ vật thật. β = f ÷ (WD − sF) = cạnh cảm biến ÷ cạnh vùng nhìn. β 0,05 là nhìn rộng; β ≈ 1 là macro. Telecentric ghi sẵn β trên ống.',
        see: ['OPT-001', 'LNS-001', 'LNS-002'],
      },
      {
        symbol: 'β_MOD · β_WD',
        name: 'Độ phóng đại tại MOD / tại WD cần',
        unit: '×',
        meaning: 'β_MOD = f ÷ (MOD − sF): β lớn nhất ống tự đạt được. β_WD = β ở khoảng cách anh cần. β_WD > β_MOD thì phải thêm ống nối.',
        see: ['OPT-010'],
      },
      {
        symbol: 'β_phủ · β_cần',
        name: 'Độ phóng đại để phủ vật / để đủ mm/px',
        unit: '×',
        meaning: 'β_phủ = lớn nhất mà vùng nhìn còn phủ hết vật; β_cần = nhỏ nhất mà mm/px còn đạt. Ống tốt có β nằm giữa hai số này.',
        see: ['OPT-001'],
      },
      {
        symbol: 'FOV',
        name: 'Vùng nhìn',
        unit: 'mm',
        meaning: 'Phần vật camera thấy được = cạnh cảm biến ÷ β (rộng × cao).',
        see: ['OPT-001', 'LNS-001', 'LNS-005'],
      },
      {
        symbol: 'góc nhìn',
        name: 'Góc nhìn tại WD',
        unit: '°',
        meaning: '2 × atan(vùng nhìn ÷ (2 × WD)) — góc mở từ ống ra hai mép vùng nhìn.',
        see: ['LNS-003'],
      },
      {
        symbol: 'θ',
        name: 'Góc nghiêng camera',
        unit: '°',
        meaning: 'Góc giữa trục camera và pháp tuyến bề mặt; trục dài bị nén theo cos θ.',
        see: ['OPT-009'],
      },
    ],
  },
  {
    title: 'Phụ kiện ống kính',
    rows: [
      {
        symbol: 'e',
        name: 'Chiều dài ống nối (extension tube)',
        unit: 'mm',
        meaning: 'Vòng đệm giữa ống và camera, đẩy ống ra xa cảm biến để lấy nét gần hơn MOD. Cần e trong [f × (β_WD − β_MOD); f × β_WD]. Ở mục sai số đo, e là sai số (xem dưới).',
        see: ['OPT-010'],
      },
      {
        symbol: 'ren',
        name: 'Độ đẩy ra của vòng lấy nét',
        unit: 'mm',
        meaning: 'Vòng nét ở vạch ∞ thì ren = 0, vặn hết về MOD thì ren = f × β_MOD. Cùng ống nối tạo độ đẩy x′ = e + ren = f × β_WD; ren cần vặn = f × β_WD − e.',
        see: ['OPT-010'],
      },
      {
        symbol: 'độ dư lấy nét',
        name: 'Khoảng cách từ WD tới mép dải nét',
        unit: '% WD',
        meaning: 'min(WD − WD gần; WD xa − WD) ÷ WD khi đã lắp ống nối. Nhỏ thì vật lệch một chút là mất nét; mép gần tính ra còn có thể lạc quan so với bảng hãng.',
        see: ['OPT-010'],
      },
      {
        symbol: 'k',
        name: 'Hệ số bộ nhân tiêu cự (rear converter)',
        unit: '×',
        meaning: 'Bộ nhân 2× biến ống 25 mm thành 50 mm: β, F# và vòng ảnh nhân k, lp/mm chia k.',
        see: ['OPT-011'],
      },
      {
        symbol: 'stop',
        name: 'Nấc sáng',
        unit: 'stop',
        meaning: 'Mỗi stop là ánh sáng giảm một nửa. Ống nối mất 2 × log₂(1 + β) stop; bộ nhân k mất 2 × log₂(k) stop.',
        see: ['OPT-010', 'OPT-011'],
      },
    ],
  },
  {
    title: 'Khẩu & nhiễu xạ',
    rows: [
      {
        symbol: 'F# · F/…',
        name: 'Số khẩu (vòng khẩu)',
        unit: '—',
        meaning: 'Số trên vòng khẩu: F/2,8 mở to (sáng, nông), F/8 khép nhỏ (tối, sâu). "F nhỏ nhất" của ống = khẩu mở to nhất.',
        see: ['OPT-004', 'OPT-005'],
      },
      {
        symbol: 'N_hiệu dụng',
        name: 'F# hiệu dụng phía cảm biến',
        unit: '—',
        meaning: 'Khi chụp gần, ánh sáng đi xa hơn tới cảm biến nên tối hơn số trên vòng: N = F# × (1 + β). Telecentric ghi sẵn F# làm việc.',
        see: ['OPT-004'],
      },
      {
        symbol: 'F#max',
        name: 'F# lớn nhất theo nhiễu xạ',
        unit: '—',
        meaning: 'Khép quá số này thì vệt nhiễu xạ lớn hơn 2 pixel, ảnh mờ dù lấy nét đúng. F#max = 2 × pitch ÷ (2,44 × λ), trên vòng khẩu chia thêm (1 + β).',
        see: ['OPT-004'],
      },
      {
        symbol: 'λ',
        name: 'Bước sóng ánh sáng',
        unit: 'µm',
        meaning: `Engine tính ở ${String(WAVELENGTH_UM).replace('.', ',')} µm (xanh lá). Đèn xanh dương bước sóng ngắn hơn nên vệt nhiễu xạ nhỏ hơn.`,
        see: ['OPT-004', 'LGT-009..016'],
      },
      {
        symbol: 'Airy',
        name: 'Đĩa Airy (vệt nhiễu xạ)',
        unit: 'µm',
        meaning: 'Một điểm sáng qua ống không thành điểm mà thành vệt tròn đường kính 2,44 × λ × N_hiệu dụng. Luật: ≤ 2 pixel.',
        see: ['OPT-004'],
      },
      {
        symbol: 'F_cần',
        name: 'F# cần cho độ sâu',
        unit: '—',
        meaning: 'Khẩu phải khép tới đâu để cả chênh cao Δh đều nét. F_cần > F#max là xung đột độ sâu ↔ nhiễu xạ.',
        see: ['OPT-005'],
      },
      {
        symbol: 'c',
        name: 'Vòng mờ cho phép',
        unit: 'µm',
        meaning: 'Vệt mờ lớn nhất còn coi là nét = số px × pitch.',
        see: ['OPT-005'],
      },
      {
        symbol: 'Δh',
        name: 'Chênh cao vật',
        unit: 'mm',
        meaning: 'Bề mặt cao thấp chênh nhau bao nhiêu (độ sâu cần nét).',
        see: ['OPT-005', 'OPT-008'],
      },
    ],
  },
  {
    title: 'Cảm biến & độ phân giải',
    rows: [
      {
        symbol: 'pitch',
        name: 'Cỡ điểm ảnh (pixel size)',
        unit: 'µm',
        meaning: 'Cạnh một pixel trên cảm biến, ví dụ 3,45 µm. Pixel nhỏ đòi ống nét hơn và khẩu mở to hơn.',
        see: ['OPT-001', 'OPT-003', 'OPT-004'],
      },
      {
        symbol: 'W × H',
        name: 'Số pixel ngang × dọc',
        unit: 'px',
        meaning: 'Độ phân giải cảm biến, ví dụ 2448 × 2048 (5 MP). Nx × Ny là số pixel cần.',
        see: ['RES-004'],
      },
      {
        symbol: 'm · mm/px',
        name: 'Kích thước vật trên một pixel',
        unit: 'mm/px',
        meaning: 'm_cần = mm/px bài toán đòi; mm/px thật = pitch ÷ β. Số càng nhỏ càng chi tiết.',
        see: ['RES-001', 'RES-002', 'OPT-001'],
      },
      {
        symbol: 'lp/mm',
        name: 'Cặp vạch trên mỗi mm',
        unit: 'lp/mm',
        meaning: 'Độ nét ống kính. Cần ≥ 1000 ÷ (2 × pitch) để ống không mờ hơn pixel.',
        see: ['OPT-003'],
      },
      {
        symbol: 'Φ · vòng ảnh',
        name: 'Đường kính vòng ảnh',
        unit: 'mm / inch',
        meaning: 'Vùng tròn ống chiếu sáng đủ trên cảm biến (ví dụ Φ19,3 = 1,2"). Phải ≥ đường chéo cảm biến, nếu không góc ảnh bị tối.',
        see: ['OPT-002'],
      },
      {
        symbol: '2/3" · 1"…',
        name: 'Cỡ cảm biến danh nghĩa',
        unit: 'inch',
        meaning: 'Tên gọi cỡ cảm biến theo quy ước cũ, không phải đường chéo thật (2/3" ≈ 11 mm chéo).',
        see: ['OPT-002'],
      },
    ],
  },
  {
    title: 'Đo lường, nhiệt & cơ khí',
    rows: [
      {
        symbol: 'U · dung sai',
        name: 'Dung sai đo',
        unit: 'mm',
        meaning: 'Sai số cho phép của phép đo; chia vào ngân sách cho từng nguồn sai số (pixel, phối cảnh, nhiệt, ghép ảnh).',
        see: ['RES-002', 'OPT-008'],
      },
      {
        symbol: 'α',
        name: 'Hệ số giãn nở nhiệt',
        unit: 'µm/(m·K)',
        meaning: 'Vật dài 1 m nở thêm bao nhiêu µm khi nóng lên 1 °C. Giá trị theo vật liệu là ngưỡng admin (xem ASM-ALPHA).',
        see: ['MEC-001', 'ASM-ALPHA'],
      },
      {
        symbol: 'e (sai số)',
        name: 'Sai số một nguồn',
        unit: 'µm · mm',
        meaning: 'Ở MEC-001, OPT-008, ASM-SEAM chữ e là sai số do nhiệt / phối cảnh / ghép ảnh, so với U. Khác e ống nối ở OPT-010.',
        see: ['MEC-001', 'OPT-008', 'ASM-SEAM'],
      },
      {
        symbol: 'L · ΔT',
        name: 'Chiều dài đo / dải nhiệt độ',
        unit: 'm · K',
        meaning: 'L = kích thước cần đo; ΔT = cả dải nhiệt độ dao động (không chia đôi).',
        see: ['MEC-001', 'ASM-SPAN'],
      },
      {
        symbol: 'r',
        name: 'Nửa đường chéo vùng nhìn',
        unit: 'mm',
        meaning: 'Từ tâm tới góc vùng nhìn một camera; điểm ở góc chịu sai số phối cảnh lớn nhất.',
        see: ['OPT-008', 'OPT-007'],
      },
      {
        symbol: 'k_stitch',
        name: 'Sai số ghép ảnh',
        unit: 'px',
        meaning: 'Số pixel lệch ở mỗi đường ghép khi một kích thước vắt qua nhiều camera.',
        see: ['MEC-003', 'ASM-SEAM'],
      },
    ],
  },
  {
    title: 'Tốc độ & thời gian',
    rows: [
      {
        symbol: 'ppm · T_nhịp',
        name: 'Nhịp sản xuất',
        unit: 'sp/phút · ms',
        meaning: 'ppm = sản phẩm mỗi phút; T_nhịp = 60 000 ÷ ppm là thời gian cho một sản phẩm.',
        see: ['ASM-PPM', 'THR-003'],
      },
      {
        symbol: 'v',
        name: 'Tốc độ băng tải / vật',
        unit: 'mm/s',
        meaning: 'Vật chạy liên tục khi chụp thì gây nhoè và lệch vị trí chụp.',
        see: ['THR-005', 'THR-007'],
      },
      {
        symbol: 't_max · k_blur',
        name: 'Phơi sáng tối đa / nhoè cho phép',
        unit: 'µs · px',
        meaning: 't_max = k_blur × m_cần ÷ v. k_blur = số pixel nhoè chấp nhận, bài đo và bài phát hiện lỗi có ngưỡng admin riêng.',
        see: ['THR-005'],
      },
      {
        symbol: 'fps',
        name: 'Số ảnh mỗi giây',
        unit: 'ảnh/s',
        meaning: 'fps camera so với số ảnh cần trong một nhịp.',
        see: ['THR-006', 'CAM-002'],
      },
      {
        symbol: 'Δx',
        name: 'Lệch vị trí chụp',
        unit: 'mm',
        meaning: 'Vật chạy thêm bao xa giữa lúc có trigger và lúc cảm biến bắt đầu phơi = v × (đáp ứng + jitter).',
        see: ['THR-007'],
      },
      {
        symbol: 'duty',
        name: 'Tỉ lệ thời gian đèn sáng',
        unit: '%',
        meaning: 'Thời gian đèn strobe bật ÷ chu kỳ; overdrive mà duty cao thì đèn quá nhiệt.',
        see: ['LGT-024'],
      },
    ],
  },
];
