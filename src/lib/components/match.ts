import { pickCard, pickPc } from './pc';
import {
  coversSensor,
  interfaceCarries,
  sensorWidthMm,
  specNumber,
  specString,
  type Component,
} from './specs';

/**
 * Chọn linh kiện cụ thể từ catalog cho một kết quả của bộ chọn thiết bị.
 *
 * Toàn bộ file này là hàm thuần: vào là catalog + yêu cầu, ra là thiết bị chọn
 * kèm danh sách thay thế. Không đụng database, không đụng React — nhờ vậy mới
 * test được từng quy tắc chọn một cách độc lập.
 *
 * Nguyên tắc xuyên suốt: KHÔNG chọn thiết bị dư thừa. Camera 20 MP cho bài cần
 * 4 MP là tiền vứt đi, và còn kéo theo băng thông lẫn ống kính đắt hơn.
 */

export type ComponentChoice<TFit> = {
  chosen: Component | null;
  /** Các lựa chọn khác cũng thoả, xếp theo mức phù hợp giảm dần. */
  alternatives: Component[];
  /** Con số dùng để chọn — hiển thị cho kỹ sư tự kiểm chứng. */
  fit: TFit;
};

export type CameraFit = {
  requiredMp: number | null;
  dataRateMbytesS: number | null;
  needsColor: boolean;
};

export type LensFit = {
  /** Tiêu cự cần, mm. Null khi thiếu dữ liệu hoặc khi dùng telecentric. */
  targetFocalMm: number | null;
  /** Độ phóng đại cần, cho telecentric. */
  targetMagnification: number | null;
  sensorWidthMm: number | null;
};

const active = (components: Component[], kind: Component['kind']) =>
  components.filter((c) => c.is_active && c.kind === kind);

/** Bỏ dấu tiếng Việt để so khớp từ khoá không phụ thuộc cách gõ. */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

/**
 * Tiêu cự cần thiết (mm), xấp xỉ thấu kính mỏng:
 *
 *   f ≈ bề_rộng_cảm_biến × khoảng_cách_làm_việc / bề_rộng_FOV
 *
 * Đúng khi khoảng cách làm việc lớn hơn nhiều so với tiêu cự — luôn đúng với
 * bài toán công nghiệp thông thường. Ở khoảng cách rất gần (macro) thì công
 * thức này lệch, lúc đó phải tra bảng của hãng.
 */
export function computeFocalLength(
  sensorWidth: number,
  workingDistanceMm: number,
  fovWidthMm: number
): number | null {
  if (sensorWidth <= 0 || workingDistanceMm <= 0 || fovWidthMm <= 0) return null;
  return (sensorWidth * workingDistanceMm) / fovWidthMm;
}

/**
 * Chọn camera.
 *
 * Lọc: đủ độ phân giải, đúng màu/đơn sắc, và giao tiếp tải nổi băng thông.
 * Xếp hạng: độ phân giải THẤP NHẤT mà vẫn đủ — dư megapixel chỉ làm đội giá và
 * nghẽn băng thông chứ không giúp gì.
 */
export function pickCamera(
  components: Component[],
  req: {
    requiredMp: number | null;
    dataRateMbytesS: number | null;
    needsColor: boolean;
    /**
     * Số pixel cần trên từng trục. Bắt buộc phải kiểm RIÊNG hai trục: cảm biến
     * có tỉ lệ khung hình cố định, nên "đủ megapixel" không đồng nghĩa với đủ
     * pixel trên trục dài của FOV.
     */
    requiredWidthPx?: number | null;
    requiredHeightPx?: number | null;
    /**
     * 'area' hoặc 'line'. Hai họ camera không thay thế cho nhau được, nên đây là
     * điều kiện lọc cứng chứ không phải tiêu chí xếp hạng.
     */
    cameraType?: 'area' | 'line' | null;
  }
): ComponentChoice<CameraFit> {
  const fit: CameraFit = {
    requiredMp: req.requiredMp,
    dataRateMbytesS: req.dataRateMbytesS,
    needsColor: req.needsColor,
  };

  const candidates = active(components, 'camera').filter((camera) => {
    const mp = specNumber(camera.spec, 'resolution_mp');
    if (mp === null) return false;
    if (req.requiredMp !== null && mp < req.requiredMp) return false;

    const type = specString(camera.spec, 'camera_type') ?? 'area';
    if (req.cameraType && type !== req.cameraType) return false;

    if (type === 'line') {
      /* Line scan chỉ kiểm bề ngang: chiều dọc do quét sinh ra, không giới hạn
         bởi cảm biến. */
      const lineWidth = specNumber(camera.spec, 'line_width_px');
      if (req.requiredWidthPx != null && (lineWidth === null || lineWidth < req.requiredWidthPx)) {
        return false;
      }
    } else {
      const widthPx = specNumber(camera.spec, 'resolution_w_px');
      const heightPx = specNumber(camera.spec, 'resolution_h_px');
      if (req.requiredWidthPx != null) {
        if (widthPx === null || widthPx < req.requiredWidthPx) return false;
      }
      if (req.requiredHeightPx != null) {
        if (heightPx === null || heightPx < req.requiredHeightPx) return false;
      }
    }

    const color = specString(camera.spec, 'color');
    // Cần phân biệt màu thì bắt buộc camera màu. Không cần màu thì camera màu
    // vẫn chạy được, nên vẫn giữ làm phương án thay thế.
    if (req.needsColor && color !== 'color') return false;

    if (req.dataRateMbytesS !== null) {
      if (!interfaceCarries(specString(camera.spec, 'interface'), req.dataRateMbytesS)) return false;
    }
    return true;
  });

  const ranked = [...candidates].sort((a, b) => {
    // Line scan xếp theo số pixel một hàng; area scan xếp theo megapixel.
    const sizeOf = (c: Component) =>
      specString(c.spec, 'camera_type') === 'line'
        ? (specNumber(c.spec, 'line_width_px') ?? Infinity)
        : (specNumber(c.spec, 'resolution_mp') ?? Infinity);
    const mpA = sizeOf(a);
    const mpB = sizeOf(b);
    if (mpA !== mpB) return mpA - mpB;

    // Không cần màu thì ưu tiên đơn sắc: cùng megapixel, đơn sắc cho ảnh sắc
    // nét hơn vì không phải nội suy qua ma trận Bayer.
    if (!req.needsColor) {
      const monoA = specString(a.spec, 'color') === 'mono' ? 0 : 1;
      const monoB = specString(b.spec, 'color') === 'mono' ? 0 : 1;
      if (monoA !== monoB) return monoA - monoB;
    }
    return a.sort_order - b.sort_order;
  });

  return { chosen: ranked[0] ?? null, alternatives: ranked.slice(1), fit };
}

/**
 * Chọn ống kính cho MỘT camera cụ thể.
 *
 * Đây là chỗ thể hiện rõ nhất vì sao không tách "chọn lens" thành bước độc lập:
 * tiêu cự cần thiết phụ thuộc bề rộng cảm biến của camera đã chọn, và vòng ảnh
 * của lens phải phủ nổi chính cảm biến đó.
 */
export function pickLens(
  components: Component[],
  req: {
    camera: Component | null;
    fovWidthMm: number | null;
    workingDistanceMm: number | null;
    needTelecentric: boolean;
  }
): ComponentChoice<LensFit> {
  const sensorFormat = req.camera ? specString(req.camera.spec, 'sensor_format') : null;
  const sensorWidth = req.camera ? sensorWidthMm(req.camera.spec) : null;
  const cameraMount = req.camera ? specString(req.camera.spec, 'mount') : null;

  const fit: LensFit = {
    targetFocalMm: null,
    targetMagnification: null,
    sensorWidthMm: sensorWidth,
  };

  if (sensorWidth !== null && req.fovWidthMm !== null && req.fovWidthMm > 0) {
    // Telecentric không có tiêu cự để chọn — nó đặc trưng bằng độ phóng đại.
    fit.targetMagnification = sensorWidth / req.fovWidthMm;

    if (req.workingDistanceMm !== null) {
      fit.targetFocalMm = computeFocalLength(sensorWidth, req.workingDistanceMm, req.fovWidthMm);
    }
  }

  const usable = active(components, 'lens').filter((lens) => {
    const type = specString(lens.spec, 'lens_type');
    if (req.needTelecentric ? type !== 'telecentric' : type === 'telecentric') return false;

    // Vòng ảnh phải phủ nổi cảm biến, nếu không sẽ tối bốn góc.
    if (sensorFormat && !coversSensor(specString(lens.spec, 'image_circle'), sensorFormat)) {
      return false;
    }

    // Ngàm C gắn được lên thân CS (qua vòng đệm), ngược lại thì không.
    const lensMount = specString(lens.spec, 'mount');
    if (cameraMount && lensMount && lensMount !== cameraMount && lensMount !== 'C') return false;

    return true;
  });

  const ranked = [...usable].sort((a, b) => {
    if (req.needTelecentric && fit.targetMagnification !== null) {
      const diff = (lens: Component) =>
        Math.abs((specNumber(lens.spec, 'magnification') ?? Infinity) - fit.targetMagnification!);
      const d = diff(a) - diff(b);
      if (d !== 0) return d;
    } else if (fit.targetFocalMm !== null) {
      const diff = (lens: Component) =>
        Math.abs((specNumber(lens.spec, 'focal_length_mm') ?? Infinity) - fit.targetFocalMm!);
      const d = diff(a) - diff(b);
      if (d !== 0) return d;
    }
    return a.sort_order - b.sort_order;
  });

  return { chosen: ranked[0] ?? null, alternatives: ranked.slice(1), fit };
}

/**
 * Suy ra kiểu đèn từ câu mô tả trong bảng luật.
 *
 * ĐÂY LÀ SUY ĐOÁN TỪ KHOÁ, không phải dữ liệu có cấu trúc — bảng luật đang lưu
 * ánh sáng dưới dạng câu chữ tự do. Thứ tự kiểm tra có chủ đích: "đèn vòng
 * khuếch tán GÓC THẤP" phải ra darkfield chứ không phải ring, nên 'goc thap'
 * xét trước 'vong'. Muốn chắc chắn thì sau này thêm cột kiểu đèn vào bảng luật.
 */
export function inferLightType(text: string | null): string | null {
  if (!text) return null;
  const value = normalize(text);
  const rules: [string[], string][] = [
    [['dome'], 'dome'],
    [['backlight', 'den nen', 'chieu nen'], 'backlight'],
    [['coaxial', 'dong truc'], 'coaxial'],
    [['darkfield', 'dark field', 'goc thap'], 'darkfield'],
    [['bar light', 'den thanh'], 'bar'],
    [['ring', 'vong'], 'ring'],
  ];
  for (const [keywords, type] of rules) {
    if (keywords.some((keyword) => value.includes(keyword))) return type;
  }
  return null;
}

/** Chọn đèn theo kiểu suy ra từ luật; không suy được thì trả cả danh sách. */
export function pickLight(
  components: Component[],
  req: { lightingText: string | null }
): ComponentChoice<{ lightType: string | null }> {
  const lightType = inferLightType(req.lightingText);
  const all = active(components, 'light');

  const matching = lightType
    ? all.filter((light) => specString(light.spec, 'light_type') === lightType)
    : [];

  const ranked = (matching.length > 0 ? matching : all).sort((a, b) => a.sort_order - b.sort_order);

  return {
    // Không suy được kiểu đèn thì KHÔNG chọn bừa — chỉ liệt kê để người dùng tự chọn.
    chosen: matching.length > 0 ? ranked[0] : null,
    alternatives: matching.length > 0 ? ranked.slice(1) : ranked,
    fit: { lightType },
  };
}

/**
 * Chọn máy tính — nay chỉ là lối vào của module máy tính (pc.ts).
 *
 * Luật thật nằm ở đó vì máy tính dùng chung cho MỌI bài toán, không riêng gì
 * kiểm tra ngoại quan; để ở đây thì thêm bài toán mới là chép lại.
 */
export function pickController(
  components: Component[],
  req: { interfaceName: string | null; dataRateMbytesS: number | null; needsGpu: boolean }
): ComponentChoice<{ interfaceName: string | null; needsGpu: boolean }> {
  return pickPc(components, req);
}

// =============================================================================
// Các cụm còn lại của danh mục vật tư.
//
// Chia làm hai nhóm rõ ràng:
//   - TÍNH ĐƯỢC: tube (theo khoảng cách làm việc và độ phóng đại), cáp camera
//     (theo chuẩn giao tiếp), bộ điều khiển đèn (theo số đèn và nhu cầu đánh
//     xung). Những cụm này có điều kiện lọc thật.
//   - CHỈ GỢI Ý: cáp đèn, phần mềm, hàng đi kèm máy tính. Không có công thức
//     nào quyết định thay được, nên chỉ liệt kê cho người dùng chọn.
// =============================================================================

export type TubeFit = {
  /** Có cần tube không — và vì sao. */
  needed: boolean;
  /** Chiều dài nối thêm cần thiết (mm), xấp xỉ. */
  requiredLengthMm: number | null;
  lensMinWdMm: number | null;
};

/**
 * Vòng nối dài chỉ cần khi cơ khí buộc đặt camera GẦN hơn khoảng cách làm việc
 * tối thiểu của ống kính. Chiều dài xấp xỉ theo công thức quen dùng:
 *
 *   extension ≈ độ_phóng_đại × tiêu_cự
 *
 * Là ƯỚC LƯỢNG cho thấu kính mỏng — tube thật phải thử trên bàn quang học, vì
 * lắp tube là mất khả năng lấy nét vô cực.
 */
export function pickTube(
  components: Component[],
  req: {
    lens: Component | null;
    workingDistanceMm: number | null;
    magnification: number | null;
  }
): ComponentChoice<TubeFit> {
  const lensMinWd = req.lens ? specNumber(req.lens.spec, 'wd_min_mm') : null;
  const focal = req.lens ? specNumber(req.lens.spec, 'focal_length_mm') : null;

  const needed =
    lensMinWd !== null && req.workingDistanceMm !== null && req.workingDistanceMm < lensMinWd;

  const requiredLengthMm =
    needed && focal !== null && req.magnification !== null
      ? Math.round(req.magnification * focal * 10) / 10
      : null;

  const fit: TubeFit = { needed, requiredLengthMm, lensMinWdMm: lensMinWd };

  if (!needed) return { chosen: null, alternatives: [], fit };

  const lensMount = req.lens ? specString(req.lens.spec, 'mount') : null;
  const usable = active(components, 'tube').filter(
    (tube) => !lensMount || specString(tube.spec, 'mount') === lensMount
  );

  const ranked = [...usable].sort((a, b) => {
    if (requiredLengthMm !== null) {
      const diff = (tube: Component) =>
        Math.abs((specNumber(tube.spec, 'length_mm') ?? Infinity) - requiredLengthMm);
      const d = diff(a) - diff(b);
      if (d !== 0) return d;
    }
    return a.sort_order - b.sort_order;
  });

  return { chosen: ranked[0] ?? null, alternatives: ranked.slice(1), fit };
}

/** Chuẩn giao tiếp camera → từ khoá đầu nối của cáp. */
const CONNECTOR_FOR_INTERFACE: Record<string, string> = {
  GigE: 'RJ45',
  '5GigE': 'RJ45',
  '10GigE': 'RJ45',
  USB3: 'USB3',
  'CXP-6': 'Coax',
  'CXP-12': 'Coax',
};

/** Cáp camera: đầu nối phải khớp chuẩn giao tiếp của camera đã chọn. */
export function pickCameraCable(
  components: Component[],
  req: { interfaceName: string | null }
): ComponentChoice<{ connectorKeyword: string | null }> {
  const keyword = req.interfaceName ? CONNECTOR_FOR_INTERFACE[req.interfaceName] : undefined;
  const all = active(components, 'cable').filter(
    (cable) => specString(cable.spec, 'cable_for') === 'camera_data'
  );

  const matching = keyword
    ? all.filter((cable) => (specString(cable.spec, 'connector') ?? '').includes(keyword))
    : [];

  const ranked = (matching.length > 0 ? matching : all).sort((a, b) => a.sort_order - b.sort_order);

  return {
    // Không suy được đầu nối thì liệt kê hết chứ không gán bừa một sợi sai chuẩn.
    chosen: matching.length > 0 ? ranked[0] : null,
    alternatives: matching.length > 0 ? ranked.slice(1) : ranked,
    fit: { connectorKeyword: keyword ?? null },
  };
}

/** Cáp đèn: không có gì để tính, chỉ liệt kê theo thứ tự. */
export function pickLightCable(components: Component[]): ComponentChoice<null> {
  const ranked = active(components, 'cable')
    .filter((cable) => specString(cable.spec, 'cable_for') === 'light')
    .sort((a, b) => a.sort_order - b.sort_order);
  return { chosen: ranked[0] ?? null, alternatives: ranked.slice(1), fit: null };
}

/**
 * Bộ điều khiển đèn: đủ kênh cho số đèn, và PHẢI có đánh xung khi thời gian
 * phơi sáng bị nhoè chuyển động ép xuống dưới 1 ms.
 *
 * Không lọc bỏ bộ thiếu kênh mà tính xem cần MẤY BỘ. Trước đây hàm này loại
 * mọi bộ có ít kênh hơn số đèn — dự án 8 đèn mà catalog chỉ có tới loại 4 kênh
 * thì không còn lựa chọn nào, trong khi ngoài đời chỉ là đặt hai bộ.
 */
export function pickLightController(
  components: Component[],
  req: { lightCount: number; needsStrobe: boolean }
): ComponentChoice<{ lightCount: number; needsStrobe: boolean; unitsNeeded: number }> {
  const need = Math.max(1, req.lightCount);

  const candidates = active(components, 'light_controller').filter((ctrl) => {
    if (specNumber(ctrl.spec, 'channels') === null) return false;
    // Đánh xung thì không thay thế được: bộ chỉ cấp nguồn liên tục là loại thẳng.
    if (req.needsStrobe && specString(ctrl.spec, 'strobe') !== 'yes') return false;
    return true;
  });

  const unitsFor = (ctrl: Component) =>
    Math.ceil(need / Math.max(1, specNumber(ctrl.spec, 'channels') ?? 1));

  const ranked = [...candidates].sort((a, b) => {
    // Ít bộ nhất trước — hai bộ 2 kênh tốn dây và chỗ hơn một bộ 4 kênh.
    const unitsA = unitsFor(a);
    const unitsB = unitsFor(b);
    if (unitsA !== unitsB) return unitsA - unitsB;

    // Cùng số bộ thì đừng bán dư kênh.
    const wasteA = unitsA * (specNumber(a.spec, 'channels') ?? 0) - need;
    const wasteB = unitsB * (specNumber(b.spec, 'channels') ?? 0) - need;
    if (wasteA !== wasteB) return wasteA - wasteB;

    return a.sort_order - b.sort_order;
  });

  const chosen = ranked[0] ?? null;

  return {
    chosen,
    alternatives: ranked.slice(1),
    fit: {
      lightCount: need,
      needsStrobe: req.needsStrobe,
      unitsNeeded: chosen ? unitsFor(chosen) : 0,
    },
  };
}

/** Số bộ điều khiển cần cho một bộ cụ thể — dùng lại khi người dùng đổi tay. */
export function lightControllerUnits(controller: Component | null, lightCount: number): number {
  if (!controller) return 0;
  const channels = specNumber(controller.spec, 'channels');
  if (channels === null || channels <= 0) return 1;
  return Math.ceil(Math.max(1, lightCount) / channels);
}

/**
 * Phần mềm xử lý ảnh: không có công thức nào chọn thay được, chỉ gợi ý.
 *
 * Ràng buộc duy nhất áp được: bài cần deep learning thì đừng mặc định vào thư
 * viện miễn phí — không phải vì nó không làm được, mà vì ra hiện trường không
 * có ai hỗ trợ.
 */
export function pickSoftware(
  components: Component[],
  req: { needsDeepLearning: boolean }
): ComponentChoice<{ needsDeepLearning: boolean }> {
  const ranked = active(components, 'software').sort((a, b) => {
    if (req.needsDeepLearning) {
      const freeA = specString(a.spec, 'software_type') === 'free' ? 1 : 0;
      const freeB = specString(b.spec, 'software_type') === 'free' ? 1 : 0;
      if (freeA !== freeB) return freeA - freeB;
    }
    return a.sort_order - b.sort_order;
  });

  return {
    chosen: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    fit: { needsDeepLearning: req.needsDeepLearning },
  };
}

/** Hàng đi kèm máy tính (Windows, Office, màn hình, bàn phím) — người dùng tự tích. */
export function listPcOptions(components: Component[]): Component[] {
  return active(components, 'pc_option').sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Phụ kiện TÍCH TAY — gá, khung, tủ, cáp phụ.
 *
 * Loại trừ phụ kiện có luật (pick_mode = 'rule'): những món đó đã nằm sẵn
 * trong bảng vật tư do máy tự thêm, liệt kê lại ở đây là mời người dùng đặt
 * hai lần cùng một thứ.
 */
export function listAccessories(components: Component[]): Component[] {
  return active(components, 'accessory')
    .filter((item) => specString(item.spec, 'pick_mode') !== 'rule')
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Cáp nguồn camera: không suy được gì từ thông số, chỉ liệt kê. */
export function pickCameraPowerCable(components: Component[]): ComponentChoice<null> {
  const ranked = active(components, 'cable')
    .filter((cable) => specString(cable.spec, 'cable_for') === 'camera_power')
    .sort((a, b) => a.sort_order - b.sort_order);
  return { chosen: ranked[0] ?? null, alternatives: ranked.slice(1), fit: null };
}

/** Card giao tiếp — lối vào của module máy tính, xem pc.ts. */
export function pickInterfaceCard(
  components: Component[],
  req: { interfaceName: string | null; cameraCount: number }
): ComponentChoice<{ interfaceName: string | null; cameraCount: number }> {
  return pickCard(components, req);
}
