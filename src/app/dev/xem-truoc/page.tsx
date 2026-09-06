import { notFound } from 'next/navigation';
import { SelectorForm } from '@/components/selector/SelectorForm';
import { SelectorResultPanel } from '@/components/selector/SelectorResultPanel';
import type { Component } from '@/lib/components/specs';
import { getFieldDefs } from '@/lib/selector/fields';
import type { SelectorInput, SelectorResult } from '@/lib/selector/types';

/**
 * Trang xem trước CHỈ CHẠY Ở MÁY LOCAL, đổ dữ liệu giả, không cần đăng nhập.
 *
 * Lý do tồn tại: bộ chọn thiết bị nằm sau cổng Member+, nên người phát triển
 * không tự nhìn được bố cục mà phải nhờ người khác chụp màn hình gửi lại. Vòng
 * lặp đó chậm và tốn. Trang này cắt hẳn nó: mở là thấy đúng những component
 * thật đang dùng, chỉ khác nguồn dữ liệu.
 *
 * KHÔNG có ở bản production — chặn ngay dòng đầu. Dữ liệu bên dưới là bịa hoàn
 * toàn, không đọc database, nên cũng không lộ gì.
 */

const APPEARANCE_FIELDS = [
  'capture_mode', 'fov_width_mm', 'fov_height_mm', 'defect_min_size_mm', 'px_per_defect', 'defect_type',
  'defect_variability', 'color_critical', 'surface', 'height_tolerance_mm',
  'working_distance_mm', 'throughput_ppm', 'line_speed_mms', 'n_view', 'duty_percent',
  'total_length_mm', 'settle_time_ms', 'trigger_jitter_ms', 'encoder_resolution_um',
  'environment', 'ip_rating',
  'pixel_format', 'f_number', 'blur_px', 'overlap_percent', 'exposure_ms', 'process_ms',
];

const INPUT: SelectorInput = {
  capture_mode: 'moving_area',
  fov_width_mm: 100,
  fov_height_mm: 75,
  defect_min_size_mm: 0.2,
  px_per_defect: 3,
  defect_type: 'scratch',
  defect_variability: 'medium',
  color_critical: false,
  surface: 'matte',
  height_tolerance_mm: 2,
  working_distance_mm: 300,
  throughput_ppm: 60,
  line_speed_mms: 100,
  n_view: 1,
  duty_percent: 50,
  total_length_mm: null,
  environment: ['vibration'],
  ip_rating: 'none',
  pixel_format: 'Mono8',
  f_number: 5.6,
  blur_px: 1,
  overlap_percent: 10,
  exposure_ms: 5,
  process_ms: 20,
};

const RESULT: SelectorResult = {
  camera: 'Area scan đơn sắc, ≥ 5 MP',
  lighting: 'Đèn vòng khuếch tán góc thấp',
  lens: 'Ống kính fixed focal, ngàm C',
  processing: 'GigE Vision, PC công nghiệp i5, 16 GB RAM, không cần GPU',
  accessories: 'Cáp GigE có khoá, gá camera 3 trục, nguồn 24 V cho đèn',
  approach: 'rule_based',
  approachReason: {
    ruleCode: 'APPEAR-BASE',
    vi: 'Cấu hình nền cho kiểm tra ngoại quan. Ưu tiên xử lý theo ngưỡng và blob analysis trước khi nghĩ tới deep learning.',
    en: 'Baseline configuration for appearance inspection.',
  },
  notes: [
    {
      ruleCode: 'APPEAR-BASE',
      vi: 'Cấu hình nền cho kiểm tra ngoại quan. Ưu tiên xử lý theo ngưỡng và blob analysis trước khi nghĩ tới deep learning.',
      en: 'Baseline configuration for appearance inspection.',
    },
  ],
  derived: [
    { key: 'fov_long_mm', value: 100, formula: 'max(100 mm, 75 mm) = 100 mm' },
    { key: 'required_sensor_mp', value: 1.8, formula: '1500 px × 1200 px ≈ 1.8 MP' },
  ],
  matchedRuleCodes: ['APPEAR-BASE'],
  noRuleMatched: false,
};

const part = (
  code: string,
  kind: Component['kind'],
  brand: string,
  model: string,
  spec: Record<string, unknown>,
  sortOrder: number
): Component => ({
  id: code,
  code,
  kind,
  brand,
  model,
  spec,
  price_vnd: null,
  datasheet_url: null,
  source: 'unverified',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: sortOrder,
});

const COMPONENTS: Component[] = [
  part('CAM-IRAYPLE-A5031MG', 'camera', 'iRayple', 'A5031MG14', {
    camera_type: 'area', resolution_mp: 3.1, resolution_w_px: 2048, resolution_h_px: 1536,
    sensor_format: '1/1.8', pixel_size_um: 3.45, mount: 'C', interface: 'GigE', color: 'mono',
  }, 60),
  part('CAM-HIK-MVCS050-GM', 'camera', 'Hikrobot', 'MV-CS050-10GM', {
    camera_type: 'area', resolution_mp: 5, resolution_w_px: 2448, resolution_h_px: 2048,
    sensor_format: '2/3', pixel_size_um: 3.45, mount: 'C', interface: 'GigE', color: 'mono',
  }, 40),
  part('CAM-BASLER-A2A2590-GM', 'camera', 'Basler', 'a2A2590-22gmBAS', {
    camera_type: 'area', resolution_mp: 5, resolution_w_px: 2592, resolution_h_px: 1944,
    sensor_format: '1/1.8', pixel_size_um: 2.74, mount: 'C', interface: 'GigE', color: 'mono',
  }, 10),
  part('LENS-COOLENS-FF16', 'lens', 'Coolens', 'FF1620-5M', {
    lens_type: 'fixed', focal_length_mm: 16, image_circle: '2/3', mount: 'C',
  }, 130),
  part('LENS-COOLENS-FF25', 'lens', 'Coolens', 'FF2520-5M', {
    lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C',
  }, 140),
  part('LIGHT-HZ-DARKFIELD-W', 'light', 'HZ', 'HZ-DF12010-W', {
    light_type: 'darkfield', color: 'white', size_mm: 120,
  }, 260),
  part('PC-STD-GIGE', 'controller', 'Generic', 'IPC-i5-16G', {
    cpu: 'Intel i5', ram_gb: 16, interfaces: ['GigE', 'USB3'],
  }, 310),

  // Các cụm còn lại của danh mục vật tư — thiếu chúng thì trang xem trước
  // hiện "không có thiết bị nào" và không kiểm được bố cục chín cụm.
  part('TUBE-C-5', 'tube', 'Generic', 'C-Mount 5mm', { length_mm: 5, mount: 'C' }, 410),
  part('TUBE-C-10', 'tube', 'Generic', 'C-Mount 10mm', { length_mm: 10, mount: 'C' }, 420),
  part('CABLE-CAM-GIGE-5', 'cable', 'Generic', 'Cat6 RJ45 5m', {
    cable_for: 'camera_data', connector: 'RJ45 Cat6', length_m: 5,
  }, 510),
  part('CABLE-CAM-GIGE-10', 'cable', 'Generic', 'Cat6 RJ45 10m', {
    cable_for: 'camera_data', connector: 'RJ45 Cat6', length_m: 10,
  }, 520),
  part('CABLE-CAM-POWER-10', 'cable', 'Hikrobot', 'MV-ACP-H6p-open-HF-10m', {
    cable_for: 'camera_power', connector: 'Hirose 6 chân', length_m: 10,
  }, 540),
  part('IFCARD-ADLINK-4CH', 'interface_card', 'ADLINK', 'PCIe-GIE74V', {
    interface: 'GigE', channels: 4,
  }, 620),
  part('IFCARD-ONBOARD-1CH', 'interface_card', 'Onboard', 'Cổng mạng sẵn trên main', {
    interface: 'GigE', channels: 1,
  }, 630),
  part('CABLE-LIGHT-2', 'cable', 'Generic', 'Cáp đèn 2m', {
    cable_for: 'light', connector: 'Hirose 4 chân', length_m: 2,
  }, 610),
  part('LCTRL-HZ-1CH', 'light_controller', 'HZ', 'HZ-PS1CH-24V', {
    channels: 1, strobe: 'no', max_current_a: 2,
  }, 710),
  part('LCTRL-HZ-2CH-STROBE', 'light_controller', 'HZ', 'HZ-ST2CH-24V', {
    channels: 2, strobe: 'yes', max_current_a: 4,
  }, 720),
  part('SW-HALCON', 'software', 'MVTec', 'HALCON Runtime', {
    software_type: 'library', license: 'Runtime theo máy',
  }, 810),
  part('SW-OPENCV', 'software', 'Open source', 'OpenCV', {
    software_type: 'free', license: 'Apache 2.0',
  }, 830),
  part('PCOPT-WIN11-PRO', 'pc_option', 'Microsoft', 'Windows 11 Pro OEM', { option_type: 'os' }, 910),
  part('PCOPT-OFFICE', 'pc_option', 'Microsoft', 'Office LTSC', { option_type: 'office' }, 920),
  part('PCOPT-MONITOR-24', 'pc_option', 'Generic', 'Màn hình 24 inch', { option_type: 'monitor' }, 930),
  part('PCOPT-KEYBOARD', 'pc_option', 'Generic', 'Bàn phím + chuột', { option_type: 'keyboard' }, 940),
  part('ACC-MOUNT', 'accessory', 'Generic', 'Gá camera 3 trục', {}, 990),
  part('ACC-FILTER-POL', 'accessory', 'Generic', 'Kính lọc phân cực', {}, 995),
];

export default function DevPreviewPage() {
  // Chặn ở production. Trang này là công cụ phát triển, không phải tính năng.
  if (process.env.NODE_ENV === 'production') notFound();

  const fields = getFieldDefs(APPEARANCE_FIELDS);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Dữ liệu bịa, không đọc database.
      </p>

      <h1 className="text-2xl font-bold tracking-tight">Kiểm tra ngoại quan — xem trước bố cục</h1>

      <div className="mt-8">
        <SelectorForm taskSlug="appearance-inspection" fields={fields} canExport={false} />
      </div>

      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="mb-6 text-lg font-semibold">Khung kết quả (dữ liệu giả)</h2>
        <SelectorResultPanel
          result={RESULT}
          input={INPUT}
          components={COMPONENTS}
          historySaved={false}
          canExport={false}
        />
      </div>
    </section>
  );
}
