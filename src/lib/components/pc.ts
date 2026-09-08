/**
 * Module MÁY TÍNH — tách hẳn khỏi bộ chọn của từng bài toán.
 *
 * Vì sao tách:
 *
 *  1. Máy tính dùng chung cho MỌI bài toán. Alignment, đo lường, kiểm tra
 *     ngoại quan, sau này 3D và OCR đều cần máy. Để logic này nằm trong bộ
 *     chọn ngoại quan nghĩa là thêm bài toán mới thì chép lại — trái với
 *     nguyên tắc "thêm bài toán chỉ bằng dữ liệu" trong CLAUDE.md.
 *
 *  2. Máy tính do người khác quyết, theo chu kỳ khác. IT và mua hàng chốt một
 *     dòng IPC chuẩn dùng cả năm; kỹ sư vision không đổi máy theo từng dự án.
 *
 *  3. SỐ MÁY trước đây bị đóng cứng bằng 1. Đúng với hai ba camera, sai khi
 *     dự án lớn: hết khe PCIe, hết core, hết băng thông thì phải hai máy.
 *     Không có chỗ nào tính được điều đó chừng nào máy tính chưa có luật riêng.
 *
 * Đầu vào là một BẢN YÊU CẦU thuần số — bộ chọn của bài toán nào cũng dựng
 * được, không cần biết gì về máy tính.
 */

import { INTERFACE_BANDWIDTH, specNumber, specString, type Component } from './specs';
import type { ComponentChoice } from './match';

export type PcRequirement = {
  /** Tổng số camera của cả dự án, đã nhân theo số trạm. */
  cameraCount: number;
  /** Chuẩn giao tiếp của camera đã chọn. */
  interfaceName: string | null;
  /** Băng thông MỘT camera sinh ra, MB/s. */
  dataRateMbytesS: number | null;
  /** Bài toán có phải chạy deep learning không. */
  needsGpu: boolean;
};

export type PcPlan = {
  pc: ComponentChoice<{ interfaceName: string | null; needsGpu: boolean }>;
  card: ComponentChoice<{ interfaceName: string | null; cameraCount: number }>;
  /** Số máy tính cần đặt. */
  pcCount: number;
  /** Số card giao tiếp cần đặt (tổng, đã cộng cho mọi máy). */
  cardCount: number;
  /** Số camera mỗi máy gánh được — cơ sở của phép chia ra pcCount. */
  camerasPerPc: number;
  /** Vì sao phải nhiều hơn một máy; null khi một máy là đủ. */
  splitReason: 'slots' | 'bandwidth' | null;
};

/**
 * Số camera một máy gánh được.
 *
 * Ưu tiên thông số `max_cameras` khai trong catalog — sửa được ở trang Quản
 * trị, đúng yêu cầu "không hard-code" của CLAUDE.md. Không khai thì suy từ số
 * khe PCIe; không có cả hai thì coi như 4, con số quen thuộc của một IPC phổ
 * thông chứ không phải vô hạn.
 */
const DEFAULT_CAMERAS_PER_PC = 4;

export function camerasPerPc(pc: Component | null, cardChannels: number): number {
  if (!pc) return DEFAULT_CAMERAS_PER_PC;

  const declared = specNumber(pc.spec, 'max_cameras');
  if (declared !== null && declared > 0) return Math.floor(declared);

  const slots = specNumber(pc.spec, 'pcie_slots');
  if (slots !== null && slots > 0 && cardChannels > 0) {
    return Math.floor(slots) * cardChannels;
  }

  return DEFAULT_CAMERAS_PER_PC;
}

/**
 * Băng thông tổng có vượt sức một máy không.
 *
 * Lấy trần theo chuẩn giao tiếp: bốn camera GigE cắm vào bốn cổng riêng thì
 * mỗi cổng vẫn đủ, nhưng tổng dữ liệu đổ vào một máy có giới hạn thật ở bus và
 * ở CPU. Dùng 4 lần băng thông một cổng làm mức trần thận trọng — vượt thì
 * tách máy, vì nghẽn kiểu này chỉ lộ ra khi lắp đủ camera, không lộ lúc chạy thử.
 */
const PC_BANDWIDTH_HEADROOM = 4;

export function maxCamerasByBandwidth(
  interfaceName: string | null,
  dataRateMbytesS: number | null
): number | null {
  if (!interfaceName || !dataRateMbytesS || dataRateMbytesS <= 0) return null;
  const perPort = INTERFACE_BANDWIDTH[interfaceName];
  if (!perPort) return null;
  return Math.max(1, Math.floor((perPort * PC_BANDWIDTH_HEADROOM) / dataRateMbytesS));
}

/**
 * Chọn máy: phải có đủ giao tiếp, và có GPU khi bài toán cần deep learning.
 *
 * Có tính cả SỐ MÁY phải đặt. Không tính thì dự án sáu camera sẽ ra ba máy
 * nhỏ thay vì hai máy to — vừa đắt hơn vừa thêm hai chỗ phải bảo trì, chỉ vì
 * máy nhỏ đứng trước trong danh sách.
 */
export function pickPc(
  components: Component[],
  req: Pick<PcRequirement, 'interfaceName' | 'needsGpu'> & { cameraCount?: number }
): PcPlan['pc'] {
  const cameras = Math.max(1, req.cameraCount ?? 1);

  const candidates = components.filter((pc) => {
    if (pc.kind !== 'controller' || !pc.is_active) return false;
    const interfaces = pc.spec.interfaces;
    if (req.interfaceName && Array.isArray(interfaces) && !interfaces.includes(req.interfaceName)) {
      return false;
    }
    if (req.needsGpu && !specString(pc.spec, 'gpu')) return false;
    return true;
  });

  const ranked = [...candidates].sort((a, b) => {
    // Không cần GPU thì đừng bán máy có GPU — đắt mà không dùng tới.
    if (!req.needsGpu) {
      const gpuA = specString(a.spec, 'gpu') ? 1 : 0;
      const gpuB = specString(b.spec, 'gpu') ? 1 : 0;
      if (gpuA !== gpuB) return gpuA - gpuB;
    }

    // Rồi mới tới ít máy nhất. Cùng số máy thì máy nhỏ hơn thắng theo sort_order.
    const unitsA = Math.ceil(cameras / Math.max(1, camerasPerPc(a, 1)));
    const unitsB = Math.ceil(cameras / Math.max(1, camerasPerPc(b, 1)));
    if (unitsA !== unitsB) return unitsA - unitsB;

    return a.sort_order - b.sort_order;
  });

  return {
    chosen: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    fit: { interfaceName: req.interfaceName, needsGpu: req.needsGpu },
  };
}

/**
 * Card giao tiếp: đúng chuẩn của camera, và ĐỦ CỔNG cho số camera.
 *
 * Dùng chung một cổng qua switch thì các camera chia nhau băng thông — chạy
 * được lúc thử một camera, rồi nghẽn khi lắp đủ.
 *
 * Không lọc bỏ card thiếu cổng mà tính xem cần mấy card, cùng lý do với bộ
 * điều khiển đèn: tám camera mà catalog chỉ có tới card 4 cổng thì ngoài đời
 * là đặt hai card, không phải "không có lựa chọn nào".
 */
export function pickCard(
  components: Component[],
  req: Pick<PcRequirement, 'interfaceName' | 'cameraCount'>
): PcPlan['card'] {
  const need = Math.max(1, req.cameraCount);

  const candidates = components.filter((card) => {
    if (card.kind !== 'interface_card' || !card.is_active) return false;
    if (req.interfaceName && specString(card.spec, 'interface') !== req.interfaceName) return false;
    return specNumber(card.spec, 'channels') !== null;
  });

  const unitsFor = (card: Component) =>
    Math.ceil(need / Math.max(1, specNumber(card.spec, 'channels') ?? 1));

  const ranked = [...candidates].sort((a, b) => {
    const unitsA = unitsFor(a);
    const unitsB = unitsFor(b);
    if (unitsA !== unitsB) return unitsA - unitsB;

    const wasteA = unitsA * (specNumber(a.spec, 'channels') ?? 0) - need;
    const wasteB = unitsB * (specNumber(b.spec, 'channels') ?? 0) - need;
    if (wasteA !== wasteB) return wasteA - wasteB;

    return a.sort_order - b.sort_order;
  });

  return {
    chosen: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    fit: { interfaceName: req.interfaceName, cameraCount: need },
  };
}

/**
 * Số card cần, khi camera chia đều cho `pcCount` máy.
 *
 * Không phải là ceil(số_camera / số_cổng). Card cắm vào MỘT máy, không chia
 * được cho hai — ba camera trên hai máy vẫn cần hai card dù một card 4 cổng
 * "đủ cổng" trên giấy.
 */
export function cardUnits(card: Component | null, cameraCount: number, pcCount = 1): number {
  if (!card) return 0;
  const machines = Math.max(1, pcCount);
  const channels = specNumber(card.spec, 'channels');
  if (channels === null || channels <= 0) return machines;

  const camerasPerMachine = Math.ceil(Math.max(1, cameraCount) / machines);
  return machines * Math.ceil(camerasPerMachine / channels);
}

/**
 * Lên phương án máy tính cho cả dự án.
 *
 * Nhận thêm `pc` và `card` đã được người dùng chốt (có thể là thứ họ tự đổi)
 * để tính lại số lượng theo đúng thứ họ chọn, chứ không theo thứ máy đề xuất.
 */
export function planPc(
  components: Component[],
  req: PcRequirement,
  chosen?: { pc?: Component | null; card?: Component | null }
): PcPlan {
  const pc = pickPc(components, req);
  const card = pickCard(components, req);


  const activePc = chosen?.pc ?? pc.chosen;
  const activeCard = chosen?.card ?? card.chosen;

  const cardChannels = activeCard ? (specNumber(activeCard.spec, 'channels') ?? 1) : 1;
  const bySlots = camerasPerPc(activePc, cardChannels);
  const byBandwidth = maxCamerasByBandwidth(req.interfaceName, req.dataRateMbytesS);

  const limit = byBandwidth === null ? bySlots : Math.min(bySlots, byBandwidth);
  const cameras = Math.max(1, req.cameraCount);
  const pcCount = Math.ceil(cameras / Math.max(1, limit));

  return {
    pc,
    card,
    pcCount,
    cardCount: cardUnits(activeCard, cameras, pcCount),
    camerasPerPc: limit,
    splitReason:
      pcCount <= 1 ? null : byBandwidth !== null && byBandwidth < bySlots ? 'bandwidth' : 'slots',
  };
}
