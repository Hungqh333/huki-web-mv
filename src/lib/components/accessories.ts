/**
 * Phụ kiện MÁY TỰ THÊM, theo luật.
 *
 * Lý do có file này: form đã hỏi bề mặt có phản chiếu không, có yêu cầu IP
 * không, có encoder không, môi trường có rung không — rồi không dùng câu trả
 * lời vào đâu cả. Danh mục vật tư sinh ra vì thế thiếu đúng những món mà thiếu
 * là hệ chạy không ổn định, và thiếu thì báo giá hụt tiền.
 *
 * Nguyên tắc: chỉ đưa vào đây thứ có ĐIỀU KIỆN BẬT rõ ràng, suy được từ câu
 * hỏi form đã có. Gá, khung, tủ điện không suy được nên vẫn nằm ở danh sách
 * tích tay, không nhét vào đây cho đủ.
 */

import { specString, type Component } from './specs';

/** Vì sao món này được thêm — hiện lên giao diện để người dùng bỏ được. */
export type AccessoryReason =
  | 'reflective_surface'
  | 'ambient_light'
  | 'ip_rating'
  | 'line_scan_encoder'
  | 'triggered_capture'
  | 'vibration'
  | 'mount_mismatch';

export type RuleAccessory = {
  component: Component;
  reason: AccessoryReason;
  /** Số lượng nhân theo camera, theo đèn, hay cả hệ một cái. */
  qtyBasis: 'per_camera' | 'per_light' | 'per_system';
};

export type AccessoryRequest = {
  /** Giá trị của trường `surface` trong form. */
  surface: string | null;
  /** Các giá trị đã tích ở trường `environment`. */
  environment: string[];
  /** Giá trị trường `ip_rating`; 'none' hoặc null nghĩa là không yêu cầu. */
  ipRating: string | null;
  captureMode: 'static' | 'moving_area' | 'line_scan' | null;
  /** Ngàm của camera đã chọn, và ngàm của ống kính đã chọn. */
  cameraMount: string | null;
  lensMount: string | null;
  /** Màu đèn đã chọn — quyết định bước sóng kính lọc dải hẹp. */
  lightColor: string | null;
};

/** Bước sóng đỉnh của từng màu đèn, để khớp kính lọc dải hẹp. */
const WAVELENGTH_NM: Record<string, number> = {
  red: 630,
  blue: 470,
  green: 525,
  ir: 850,
  uv: 365,
};

function ofType(components: Component[], type: string): Component[] {
  return components
    .filter(
      (component) =>
        component.kind === 'accessory' &&
        component.is_active &&
        specString(component.spec, 'pick_mode') === 'rule' &&
        specString(component.spec, 'accessory_type') === type
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

function basisOf(component: Component): RuleAccessory['qtyBasis'] {
  const value = specString(component.spec, 'qty_basis');
  if (value === 'per_camera' || value === 'per_light' || value === 'per_system') return value;
  return 'per_system';
}

/**
 * Danh sách phụ kiện luật bật, theo thứ tự ưu tiên đọc.
 *
 * Trả về mảng rỗng khi không có luật nào khớp — đó là kết quả hợp lệ, không
 * phải lỗi. Món nào không có trong catalog thì lặng lẽ bỏ qua chứ không dựng
 * dòng trống, vì một dòng "chưa có trong catalog" mà không sửa được thì chỉ
 * làm nhiễu.
 */
export function pickRuleAccessories(
  components: Component[],
  req: AccessoryRequest
): RuleAccessory[] {
  const picked: RuleAccessory[] = [];
  const add = (list: Component[], reason: AccessoryReason) => {
    const first = list[0];
    if (first) picked.push({ component: first, reason, qtyBasis: basisOf(first) });
  };

  /* Bề mặt phản chiếu hoặc kim loại → phân cực. Phải thêm CẢ HAI: kính trên
     ống kính và tấm trước đèn. Mua mỗi kính lens thì không cắt được loá, vì
     ánh sáng tới vẫn chưa phân cực — đây là món hay mua thiếu một nửa nhất. */
  if (req.surface === 'reflective' || req.surface === 'metal') {
    add(ofType(components, 'polarizer_lens'), 'reflective_surface');
    add(ofType(components, 'polarizer_light'), 'reflective_surface');
  }

  /* Có ánh sáng môi trường lọt vào → kính lọc dải hẹp đúng màu đèn. Cách rẻ
     nhất để hệ khỏi trôi theo đèn trần và ánh nắng qua cửa sổ. */
  if (req.environment.includes('ambient_light')) {
    const wanted = req.lightColor ? WAVELENGTH_NM[req.lightColor] : undefined;
    const all = ofType(components, 'bandpass_filter');
    // Đèn trắng không lọc dải hẹp được — lọc màu nào cũng cắt mất phần lớn ánh sáng.
    const matching =
      wanted === undefined
        ? []
        : all.filter((filter) => filter.spec.wavelength_nm === wanted);
    add(matching, 'ambient_light');
  }

  if (req.ipRating && req.ipRating !== 'none') {
    add(ofType(components, 'ip_housing'), 'ip_rating');
  }

  /* Line scan không có encoder thì độ phân giải dọc trôi theo tốc độ băng tải.
     Form đã hỏi độ phân giải encoder — nghĩa là đã giả định có encoder. */
  if (req.captureMode === 'line_scan') {
    add(ofType(components, 'encoder'), 'line_scan_encoder');
    add(ofType(components, 'encoder_cable'), 'line_scan_encoder');
  }

  /* Chụp lúc vật đang chạy thì phải có gì đó báo "vật tới rồi". */
  if (req.captureMode === 'moving_area' || req.captureMode === 'line_scan') {
    add(ofType(components, 'trigger_sensor'), 'triggered_capture');
  }

  /* Rung làm trôi vòng nét và vòng khẩu. Vài chục nghìn, nhưng mất nét sau hai
     tuần chạy thì phải dừng chuyền để chỉnh lại. */
  if (req.environment.includes('vibration')) {
    add(ofType(components, 'lock_ring'), 'vibration');
  }

  /* Ngàm camera khác ngàm ống kính → phải có adapter. Hay gặp nhất ở line scan
     và cảm biến lớn hơn 1,1 inch: camera ngàm F hoặc M42, ống kính ngàm C. */
  if (req.cameraMount && req.lensMount && req.cameraMount !== req.lensMount) {
    add(ofType(components, 'mount_adapter'), 'mount_mismatch');
  }

  return picked;
}

/** Số lượng của một dòng phụ kiện, theo cơ sở nhân của nó. */
export function accessoryQty(
  item: RuleAccessory,
  counts: { cameras: number; lights: number }
): number {
  if (item.qtyBasis === 'per_camera') return Math.max(1, counts.cameras);
  if (item.qtyBasis === 'per_light') return Math.max(1, counts.lights);
  return 1;
}
