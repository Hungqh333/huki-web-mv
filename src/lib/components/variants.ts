/**
 * Dựng vài PHƯƠNG ÁN cấu hình để đặt cạnh nhau so sánh.
 *
 * Vì sao cần: bộ chọn đang đưa ra đúng một cấu hình — camera thấp nhất còn đủ
 * ngưỡng. Đó là lựa chọn hợp lý nhưng không nói được nó đủ SÁT SAO đến mức nào.
 * Một camera vừa đúng ngưỡng và một camera dư 70% trông giống hệt nhau trên
 * giao diện, trong khi ngoài hiện trường chúng là hai câu chuyện khác hẳn.
 *
 * Nguyên tắc dựng:
 *
 *  - Ba cột khác nhau ở BIÊN DƯ THẬT, không ở nhãn tự đặt. Không có "gói cao
 *    cấp", chỉ có "camera này dư 37%, camera kia dư 73%".
 *  - Chỉ dựng từ camera CÓ THẬT trong catalog và đã qua bộ lọc tương thích.
 *    Catalog chỉ có hai camera hợp lệ thì trả về hai cột, không bịa thêm cột
 *    thứ ba cho đủ bộ.
 *  - Mọi thứ suy ra từ camera (ống kính, vòng nối dài) được tính lại cho TỪNG
 *    phương án, vì tiêu cự phụ thuộc cỡ cảm biến. Lấy ống kính của phương án
 *    này gán cho phương án kia là sai ngay từ gốc.
 */

import { pickLens, pickTube } from './match';
import { specString, type Component } from './specs';

export type VariantKey = 'economy' | 'balanced' | 'headroom';

export type Variant = {
  key: VariantKey;
  camera: Component;
  lens: Component | null;
  tube: Component | null;
  /** Cần vòng nối dài hay không — để biết dòng đó có nằm trong báo giá. */
  needsTube: boolean;
  widthPx: number;
  heightPx: number;
  /** Biên dư so với số pixel cần, lấy theo TRỤC CHẶT HƠN. Đơn vị %. */
  marginPct: number | null;
  /** Kích thước một pixel trên vật, mm. Lấy trục thô hơn. */
  mmPerPx: number | null;
  interfaceName: string | null;
};

export type VariantRequest = {
  /** Số pixel cần trên mỗi trục. ny = null khi quét dòng. */
  need: { nx: number; ny: number | null } | null;
  fovWidthMm: number | null;
  fovHeightMm: number | null;
  workingDistanceMm: number | null;
  needTelecentric: boolean;
};

/**
 * Ngưỡng để một phương án được coi là "biên dư thoải mái".
 *
 * 50% không phải con số thiêng. Nó là chỗ mà sai lệch gá đặt, hao mòn đèn và
 * dung sai chế tạo cộng lại vẫn chưa ăn hết phần dư — dưới mức đó thì hệ chạy
 * được lúc nghiệm thu rồi trôi dần. Sửa được ở đây khi có số liệu dự án thật.
 */
export const COMFORTABLE_MARGIN_PCT = 50;

const widthOf = (camera: Component) => (camera.spec.resolution_w_px as number) ?? 0;
const heightOf = (camera: Component) => (camera.spec.resolution_h_px as number) ?? 0;

/** Biên dư theo trục chặt hơn. null khi chưa đủ dữ liệu để kết luận. */
export function marginOf(
  camera: Component,
  need: VariantRequest['need']
): number | null {
  if (!need || need.nx <= 0) return null;

  const w = widthOf(camera);
  if (w <= 0) return null;
  const marginX = ((w - need.nx) / need.nx) * 100;

  // Quét dòng không có chiều dọc trên cảm biến, nên chỉ xét bề ngang.
  if (need.ny === null || need.ny <= 0) return Math.round(marginX);

  const h = heightOf(camera);
  if (h <= 0) return Math.round(marginX);
  const marginY = ((h - need.ny) / need.ny) * 100;

  return Math.round(Math.min(marginX, marginY));
}

function buildOne(
  components: Component[],
  camera: Component,
  key: VariantKey,
  req: VariantRequest
): Variant {
  /* Ống kính tính lại theo ĐÚNG cảm biến của phương án này — tiêu cự cần bằng
     bề rộng cảm biến × khoảng cách ÷ FOV, nên đổi camera là đổi ống kính. */
  const lensChoice = pickLens(components, {
    camera,
    fovWidthMm: req.fovWidthMm,
    workingDistanceMm: req.workingDistanceMm,
    needTelecentric: req.needTelecentric,
  });
  const lens = lensChoice.chosen;

  const tubeChoice = pickTube(components, {
    lens,
    workingDistanceMm: req.workingDistanceMm,
    magnification: lensChoice.fit.targetMagnification,
  });

  const w = widthOf(camera);
  const h = heightOf(camera);
  const mmPerPx =
    req.fovWidthMm && w > 0
      ? req.fovHeightMm && h > 0
        ? Math.max(req.fovWidthMm / w, req.fovHeightMm / h)
        : req.fovWidthMm / w
      : null;

  return {
    key,
    camera,
    lens,
    tube: tubeChoice.fit.needed ? tubeChoice.chosen : null,
    needsTube: tubeChoice.fit.needed,
    widthPx: w,
    heightPx: h,
    marginPct: marginOf(camera, req.need),
    mmPerPx,
    interfaceName: specString(camera.spec, 'interface'),
  };
}

/**
 * Ba phương án, xếp theo độ phân giải tăng dần.
 *
 * `cameras` phải là danh sách ĐÃ LỌC tương thích (chosen + alternatives của
 * pickCamera), xếp theo thứ tự ưu tiên của hàm đó — thấp nhất mà vẫn đủ đứng
 * trước. Hàm này không lọc lại, chỉ chọn ra ba mốc.
 */
export function buildVariants(
  components: Component[],
  cameras: Component[],
  req: VariantRequest
): Variant[] {
  if (cameras.length === 0) return [];

  // Xếp lại theo số pixel ngang để "tiết kiệm → hiệu năng" đọc đúng chiều.
  const sorted = [...cameras].sort((a, b) => widthOf(a) - widthOf(b));

  const economy = sorted[0];
  const headroom = sorted[sorted.length - 1];

  /* Cột giữa: camera đầu tiên có biên dư thoải mái. Không có cái nào đạt thì
     lấy cái ở giữa danh sách — vẫn là một mốc thật, chỉ là chưa thoải mái, và
     biên dư hiển thị sẽ tự nói ra điều đó. */
  const comfortable = sorted.find((camera) => {
    const margin = marginOf(camera, req.need);
    return margin !== null && margin >= COMFORTABLE_MARGIN_PCT;
  });
  const balanced = comfortable ?? sorted[Math.floor((sorted.length - 1) / 2)];

  /* Thứ tự này quyết định nhãn nào được giữ khi hai mốc trùng camera, nên
     "đề xuất" phải đứng đầu: catalog chỉ có hai camera thì mốc tiết kiệm và
     mốc đề xuất rơi vào cùng một mã, và nhãn đáng giữ là "đề xuất" — bỏ nó đi
     là người dùng còn hai cột mà không cột nào nói "chọn cái này". */
  const picked: [VariantKey, Component][] = [
    ['balanced', balanced],
    ['economy', economy],
    ['headroom', headroom],
  ];

  /* Bỏ trùng: catalog ít camera thì hai ba mốc rơi vào cùng một mã. Thà hiện
     hai cột thật còn hơn ba cột mà hai cột giống hệt nhau. */
  const seen = new Set<string>();
  const variants: Variant[] = [];
  for (const [key, camera] of picked) {
    if (seen.has(camera.code)) continue;
    seen.add(camera.code);
    variants.push(buildOne(components, camera, key, req));
  }

  // Trả về theo độ phân giải tăng dần để đọc từ trái sang phải là từ ít tới nhiều.
  return variants.sort((a, b) => a.widthPx - b.widthPx);
}
