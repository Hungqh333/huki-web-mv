/**
 * Unit test cho engine bộ chọn thiết bị.
 *
 *   npm run test:engine
 *
 * Kiểm những chỗ dễ sai nhất: đánh giá điều kiện, công thức tính độ phân giải
 * theo CLAUDE.md mục 4, cách ghép kết quả theo priority, và nguyên tắc "chỉ leo
 * lên deep learning khi có luật nói rõ".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesCondition, validateCondition } from '../src/lib/selector/conditions';
import { deriveMetrics, DEFAULT_SAFETY_FACTOR } from '../src/lib/selector/derive';
import { runSelector } from '../src/lib/selector/engine';
import type { SelectorRule } from '../src/lib/selector/types';
import { PIXEL_FORMAT_BYTES } from '../src/lib/components/specs';
import { requiredPixels } from '../src/lib/vision/resolution';
import { getFieldDefs, visibleFieldDefs } from '../src/lib/selector/fields';
import { FALLBACK_FOV_ASPECT } from '../src/lib/selector/derive';

function rule(partial: Partial<SelectorRule> & { code: string }): SelectorRule {
  return {
    id: partial.code,
    task_type_id: 'task',
    condition_json: null,
    recommended_camera: null,
    recommended_lighting: null,
    recommended_lens: null,
    recommended_processing: null,
    recommended_accessories: null,
    ai_or_rule_based: 'rule_based',
    notes_vi: null,
    notes_en: null,
    priority: 100,
    is_active: true,
    ...partial,
  };
}

test('điều kiện rỗng là luật nền, luôn khớp', () => {
  assert.equal(matchesCondition(null, {}), true);
  assert.equal(matchesCondition({}, {}), true);
  assert.equal(matchesCondition({ all: [] }, {}), true);
});

test('so sánh số học', () => {
  const cond = { all: [{ field: 'tolerance_mm', op: 'lt' as const, value: 0.05 }] };
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.02 }), true);
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.05 }), false);
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.2 }), false);
});

test('trường bỏ trống thì luật gắn với trường đó không khớp', () => {
  const cond = { all: [{ field: 'tolerance_mm', op: 'lt' as const, value: 0.05 }] };
  assert.equal(matchesCondition(cond, { tolerance_mm: null }), false);
  assert.equal(matchesCondition(cond, {}), false);
});

test('op "in" khớp trên trường nhiều lựa chọn khi giao nhau khác rỗng', () => {
  const cond = { all: [{ field: 'environment', op: 'in' as const, value: ['vibration'] }] };
  assert.equal(matchesCondition(cond, { environment: ['dust', 'vibration'] }), true);
  assert.equal(matchesCondition(cond, { environment: ['dust'] }), false);
  assert.equal(matchesCondition(cond, { environment: [] }), false);
});

test('tất cả predicate phải cùng đúng', () => {
  const cond = {
    all: [
      { field: 'surface', op: 'eq' as const, value: 'metal' },
      { field: 'tolerance_mm', op: 'lt' as const, value: 0.05 },
    ],
  };
  assert.equal(matchesCondition(cond, { surface: 'metal', tolerance_mm: 0.01 }), true);
  assert.equal(matchesCondition(cond, { surface: 'metal', tolerance_mm: 0.5 }), false);
});

test('validateCondition bắt được định dạng sai', () => {
  assert.deepEqual(validateCondition({ all: [] }), []);
  assert.ok(validateCondition({ all: [{ field: 'x', op: 'bogus' }] }).length > 0);
  assert.ok(validateCondition({ all: [{ field: '', op: 'eq', value: 1 }] }).length > 0);
  assert.ok(validateCondition({ all: [{ field: 'x', op: 'in', value: 'khong-phai-mang' }] }).length > 0);
  assert.ok(validateCondition({ anyOf: [] }).length > 0);
});

test('công thức độ phân giải đúng theo CLAUDE.md mục 4', () => {
  // FOV 100mm, dung sai 0.1mm, hệ số 3 -> 100 / (0.1/3) = 3000 px
  const { context } = deriveMetrics(
    { fov_width_mm: 100, fov_height_mm: 50, tolerance_mm: 0.1 },
    3
  );
  assert.equal(context.fov_long_mm, 100, 'lấy trục dài hơn của FOV');
  assert.equal(context.required_resolution_px, 3000);
  assert.equal(context.px_per_mm, 30);
});

test('hệ số an toàn mặc định nằm trong khoảng 2-3 px/feature', () => {
  assert.ok(DEFAULT_SAFETY_FACTOR >= 2 && DEFAULT_SAFETY_FACTOR <= 3);
});

test('OCR cần ~20 px cho chiều cao ký tự, không phải 3 px như các bài khác', () => {
  // FOV 80mm, ký tự cao 2mm -> 80 / (2/20) = 800 px. Dùng nhầm 3 px se ra 120 px,
  // thấp hơn thực tế gần 7 lần và dẫn tới chọn camera không đọc nổi chữ.
  const { context, metrics } = deriveMetrics(
    { fov_width_mm: 80, fov_height_mm: 40, character_height_mm: 2 },
    3
  );
  assert.equal(context.px_per_feature, 20);
  assert.equal(context.required_resolution_px, 800);

  const formula = metrics.find((m) => m.key === 'required_resolution_px')?.formula ?? '';
  assert.ok(formula.includes('20 px'), `cong thuc phai hien dung he so: ${formula}`);
});

test('mã vạch dùng kích thước ô module làm đặc trưng', () => {
  const { context } = deriveMetrics(
    { fov_width_mm: 60, fov_height_mm: 60, module_size_mm: 0.2 },
    3
  );
  assert.equal(context.px_per_feature, 3);
  assert.equal(context.required_resolution_px, 900);
});

test('bài ngoại quan dùng kích thước lỗi nhỏ nhất thay cho dung sai', () => {
  const { context } = deriveMetrics(
    { fov_width_mm: 60, fov_height_mm: 60, defect_min_size_mm: 0.2 },
    3
  );
  assert.equal(context.required_resolution_px, 900);
});

test('luật priority nhỏ hơn thắng ở từng ô kết quả', () => {
  const result = runSelector(
    [
      rule({ code: 'BASE', priority: 100, recommended_lighting: 'đèn vòng', recommended_camera: 'area scan' }),
      rule({
        code: 'SPECIFIC',
        priority: 50,
        recommended_lighting: 'đèn dome',
        condition_json: { all: [{ field: 'surface', op: 'eq', value: 'reflective' }] },
      }),
    ],
    { surface: 'reflective' }
  );

  assert.equal(result.lighting, 'đèn dome', 'luật ưu tiên cao thắng');
  assert.equal(result.camera, 'area scan', 'ô luật ưu tiên cao bỏ trống thì lấy của luật nền');
});

test('mặc định là rule_based, chỉ leo lên khi có luật nói rõ', () => {
  const baseOnly = runSelector([rule({ code: 'BASE' })], {});
  assert.equal(baseOnly.approach, 'rule_based');

  const escalated = runSelector(
    [
      rule({ code: 'BASE' }),
      rule({
        code: 'DL',
        priority: 20,
        ai_or_rule_based: 'deep_learning',
        notes_vi: 'Lỗi biến thiên quá lớn.',
        notes_en: 'Defects vary too much.',
        condition_json: { all: [{ field: 'defect_variability', op: 'eq', value: 'high' }] },
      }),
    ],
    { defect_variability: 'high' }
  );
  assert.equal(escalated.approach, 'deep_learning');
  assert.equal(escalated.approachReason?.vi, 'Lỗi biến thiên quá lớn.', 'phải kèm lý do');
});

test('luật deep_learning không khớp thì không được leo thang', () => {
  const result = runSelector(
    [
      rule({ code: 'BASE' }),
      rule({
        code: 'DL',
        priority: 20,
        ai_or_rule_based: 'deep_learning',
        condition_json: { all: [{ field: 'defect_variability', op: 'eq', value: 'high' }] },
      }),
    ],
    { defect_variability: 'low' }
  );
  assert.equal(result.approach, 'rule_based');
  assert.equal(result.approachReason, null);
});

test('ghi chú gom từ mọi luật khớp và không trùng lặp', () => {
  const result = runSelector(
    [
      rule({ code: 'A', notes_vi: 'ghi chú A', notes_en: 'note A' }),
      rule({ code: 'B', priority: 50, notes_vi: 'ghi chú B', notes_en: 'note B' }),
      rule({ code: 'C', priority: 60, notes_vi: 'ghi chú A', notes_en: 'note A' }),
    ],
    {}
  );
  assert.deepEqual(
    result.notes.map((note) => note.vi),
    ['ghi chú B', 'ghi chú A']
  );
});

test('luật đã tắt thì bị bỏ qua', () => {
  const result = runSelector(
    [rule({ code: 'OFF', is_active: false, recommended_camera: 'không được dùng' })],
    {}
  );
  assert.equal(result.camera, null);
  assert.equal(result.noRuleMatched, true);
});

test('không luật nào khớp thì báo rõ thay vì trả kết quả rỗng im lặng', () => {
  const result = runSelector(
    [rule({ code: 'X', condition_json: { all: [{ field: 'surface', op: 'eq', value: 'metal' }] } })],
    { surface: 'matte' }
  );
  assert.equal(result.noRuleMatched, true);
  assert.equal(result.camera, null);
});

// ------------------------------------------------ BĂNG THÔNG & CỤM BOM MỚI --

test('băng thông dữ liệu tính đúng từ độ phân giải và nhịp sản xuất', () => {
  // FOV 100×100 mm, lỗi nhỏ nhất 0,1 mm, hệ số 3 px → 3000×3000 px = 9 MP.
  // 60 sp/phút = 1 ảnh/giây, ảnh đơn sắc → 9 MB/s.
  const { context } = deriveMetrics({
    fov_width_mm: 100,
    fov_height_mm: 100,
    defect_min_size_mm: 0.1,
    throughput_ppm: 60,
  });

  assert.equal(context.required_sensor_mp, 9);
  assert.equal(context.fps_required, 1);
  assert.equal(context.data_rate_mbytes_s, 9);
});

test('ảnh màu Bayer KHÔNG nhân băng thông lên ba lần — chỉ RGB8 mới nhân ba', () => {
  /* Test này trước đây khẳng định ảnh màu = 27 MB/s (3 byte/px) và vẫn xanh,
     nhưng nó đang BẢO VỆ MỘT HÀNH VI SAI: derive.ts tự khai
     `color_critical ? 3 : 1`, trong khi vision/timing.ts đã có bảng đúng nói
     BayerRG8 = 1 byte/px. Camera màu công nghiệp truyền Bayer thô, máy tính
     mới nội suy ra RGB. Con số phồng ba lần đó chảy vào
     maxCamerasByBandwidth() nên kéo sai cả số máy tính lẫn số card.

     Nay cả hai module tra chung PIXEL_FORMAT_BYTES, nên: cần màu KHÔNG làm
     đổi băng thông, và chỉ camera thật sự truyền RGB8 mới gấp ba. */
  const base = {
    fov_width_mm: 100,
    fov_height_mm: 100,
    defect_min_size_mm: 0.1,
    throughput_ppm: 60,
  };

  const mono = deriveMetrics({ ...base, color_critical: false }).context;
  const bayer = deriveMetrics({ ...base, color_critical: true }).context;

  assert.equal(mono.data_rate_mbytes_s, 9);
  assert.equal(bayer.data_rate_mbytes_s, 9, 'can mau van la Bayer 1 byte/px, khong phai 3');

  // Chỉ khi camera thật sự truyền RGB đã nội suy thì mới gấp ba.
  const rgb = deriveMetrics({ ...base, pixel_format: 'RGB8' }).context;
  assert.equal(rgb.data_rate_mbytes_s, 27, 'RGB8 = 3 byte/px');

  // Định dạng khai ở form thắng suy đoán từ color_critical.
  const mono16 = deriveMetrics({ ...base, color_critical: true, pixel_format: 'Mono16' }).context;
  assert.equal(mono16.data_rate_mbytes_s, 18, 'Mono16 = 2 byte/px');

  // Định dạng lạ thì lùi về mặc định, không đoán và không văng.
  const unknownRun = deriveMetrics({ ...base, pixel_format: 'Mono10packed' });
  assert.equal(unknownRun.context.data_rate_mbytes_s, 9, 'dinh dang la -> Mono8 mac dinh');
  // Công thức phải ghi định dạng THỰC SỰ đã dùng, không ghi tên định dạng lạ
  // bên cạnh số byte của Mono8.
  const unknownFormula = unknownRun.metrics.find((m) => m.key === 'data_rate_mbytes_s')!.formula;
  assert.ok(unknownFormula.includes('(Mono8)'), `phai ghi Mono8: ${unknownFormula}`);
  assert.ok(!unknownFormula.includes('Mono10packed'), `khong duoc ghi ten dinh dang la: ${unknownFormula}`);

  // Công thức phải nói rõ đang tính theo định dạng nào, nếu không 1 byte/px
  // cho ảnh màu trông như lỗi.
  const { metrics } = deriveMetrics({ ...base, color_critical: true });
  const formula = metrics.find((m) => m.key === 'data_rate_mbytes_s')!.formula;
  assert.ok(formula.includes('BayerRG8'), `cong thuc phai hien dinh dang: ${formula}`);
});

test('derive và vision dùng CHUNG một bảng byte/px', () => {
  /* Chốt chặn cho lỗi vừa sửa: hai module từng khai riêng và lệch nhau ba lần.
     Nếu ai đó khai lại một bảng thứ hai ở đâu đó, test này không bắt được —
     nhưng nó bắt được việc hai đường tính cho ra hai con số khác nhau. */
  const megapixels = 9;
  const fps = 1;

  for (const [format, bytes] of Object.entries(PIXEL_FORMAT_BYTES)) {
    const { context } = deriveMetrics({
      fov_width_mm: 100,
      fov_height_mm: 100,
      defect_min_size_mm: 0.1,
      throughput_ppm: 60,
      pixel_format: format,
    });
    assert.equal(
      context.data_rate_mbytes_s,
      megapixels * bytes * fps,
      `${format}: derive phai dung dung ${bytes} byte/px nhu bang chung`
    );
  }
});

test('không nhập nhịp sản xuất thì không bịa ra băng thông', () => {
  const { context } = deriveMetrics({
    fov_width_mm: 100,
    fov_height_mm: 100,
    defect_min_size_mm: 0.1,
  });

  assert.equal(context.data_rate_mbytes_s, undefined);
  assert.equal(context.fps_required, undefined);
});

test('luật viết điều kiện được theo băng thông vừa tính', () => {
  const result = runSelector(
    [
      rule({ code: 'BASE', recommended_processing: 'GigE, PC i5', priority: 100 }),
      rule({
        code: 'FAST',
        priority: 10,
        condition_json: {
          all: [{ field: 'data_rate_mbytes_s', op: 'gt', value: 110 }],
        },
        recommended_processing: '5GigE hoac CoaXPress',
      }),
    ],
    // 200×200 mm, lỗi 0,1 mm → 6000×6000 px = 36 MP; 600 sp/phut = 10 fps
    // → 360 MB/s, vuot nguong 110.
    {
      fov_width_mm: 200,
      fov_height_mm: 200,
      defect_min_size_mm: 0.1,
      throughput_ppm: 600,
    }
  );

  assert.equal(result.processing, '5GigE hoac CoaXPress', 'luat uu tien cao thang');
});

test('hai cụm mới gộp độc lập với các cụm cũ', () => {
  const result = runSelector(
    [
      rule({
        code: 'BASE',
        priority: 100,
        recommended_camera: 'Area scan 5 MP',
        recommended_processing: 'GigE, PC i5',
        recommended_accessories: 'Cap GigE, ga camera',
      }),
      // Luật ưu tiên cao chỉ quyết định phụ kiện, không đụng tới ô khác.
      rule({
        code: 'IP65',
        priority: 10,
        recommended_accessories: 'Vo bao ve IP65',
      }),
    ],
    {}
  );

  assert.equal(result.accessories, 'Vo bao ve IP65', 'luat cu the hon thang o phu kien');
  assert.equal(result.camera, 'Area scan 5 MP', 'o camera van do luat nen quyet dinh');
  assert.equal(result.processing, 'GigE, PC i5');
});

// ------------------------------------------- SỐ N & CÔNG THỨC ĐO 2D (GAP 1) --

test('lỗi nhỏ nhất dùng số N người dùng khai, không cố định 3 px', () => {
  // 60 mm ÷ (0,2 mm ÷ 5 px) = 1500 px — hệ số 3 cũ ra 900 px, thiếu gần một nửa.
  const { context, metrics } = deriveMetrics({
    fov_width_mm: 60,
    fov_height_mm: 60,
    defect_min_size_mm: 0.2,
    px_per_defect: 5,
  });
  assert.equal(context.px_per_feature, 5);
  assert.equal(context.required_resolution_px, 1500);
  const formula = metrics.find((m) => m.key === 'required_resolution_px')!.formula;
  assert.ok(formula.includes('5 px'), `cong thuc phai hien N: ${formula}`);

  // N rỗng hoặc vô nghĩa thì lùi về hệ số an toàn.
  for (const bad of [null, 0, -2]) {
    const { context: fallback } = deriveMetrics(
      { fov_width_mm: 60, fov_height_mm: 60, defect_min_size_mm: 0.2, px_per_defect: bad },
      3
    );
    assert.equal(fallback.required_resolution_px, 900, `N = ${bad}`);
  }
});

test('đo 2D: ±0,1 mm → (0,2 ÷ 10) × 3 = 0,06 mm/px, không phải 0,1 ÷ 3', () => {
  const input = { fov_width_mm: 100, fov_height_mm: 50, tolerance_mm: 0.1 };

  const measure = deriveMetrics(input, 3, '2d-measurement');
  // 100 ÷ 0,06 = 1666,7 → 1667 px.
  assert.equal(measure.context.required_resolution_px, 1667);
  assert.equal(measure.context.px_per_mm, 16.667);
  assert.equal(measure.context.required_sensor_mp, 1.389, '1666,7 × 833,3 px');
  const formula = measure.metrics.find((m) => m.key === 'required_resolution_px')!.formula;
  assert.ok(formula.includes('0.06 mm/px'), formula);
  assert.ok(formula.includes('÷ 10) × 3 px'), formula);

  // Alignment cùng trường tolerance_mm nhưng chưa đổi công thức.
  assert.equal(deriveMetrics(input, 3, 'alignment').context.required_resolution_px, 3000);
  assert.equal(deriveMetrics(input, 3).context.required_resolution_px, 3000, 'khong co slug');

  // Dung sai chặt thì vẫn vượt ngưỡng 5000 px của luật MEAS-HIGH-RES.
  const tight = deriveMetrics({ ...input, tolerance_mm: 0.02 }, 3, '2d-measurement').context;
  assert.equal(tight.required_resolution_px, 8334, '100 / 0,012');
});

test('ngoại quan có dung sai đo: derive ra đúng số pixel như bộ chọn thiết bị', () => {
  const base = {
    fov_width_mm: 380,
    fov_height_mm: 280,
    defect_min_size_mm: 0.5,
    px_per_defect: 5,
    throughput_ppm: 60,
  };
  const need = requiredPixels({
    fovWidthMm: 380,
    fovHeightMm: 280,
    defectMinSizeMm: 0.5,
    pxPerDefect: 5,
    measurementToleranceMm: 0.1,
  })!;

  const withMeasurement = deriveMetrics({ ...base, measurement_tolerance_mm: 0.1 }, 3, 'appearance-inspection');
  assert.equal(withMeasurement.context.required_resolution_px, need.nx, 'cung 6334 px');
  assert.ok(
    Math.abs((withMeasurement.context.required_sensor_mp as number) - (need.nx * need.ny) / 1e6) < 0.01,
    'cung ~29,6 MP'
  );
  const formula = withMeasurement.metrics.find((m) => m.key === 'required_resolution_px')!.formula;
  assert.ok(formula.includes('sai số đo'), formula);

  // Không có nhánh đo: 380 ÷ 0,1 = 3800 px, 10,64 MP.
  const detectionOnly = deriveMetrics(base, 3, 'appearance-inspection').context;
  assert.equal(detectionOnly.required_resolution_px, 3800);
  assert.equal(detectionOnly.required_sensor_mp, 10.64);

  // Băng thông đi theo số pixel đúng — trước đây bị tính thiếu gần ba lần.
  assert.ok(
    (withMeasurement.context.data_rate_mbytes_s as number) > 2.7 * (detectionOnly.data_rate_mbytes_s as number)
  );

  // Dung sai lỏng (±1 mm → 0,6 mm/px) thì nhánh phát hiện lỗi vẫn quyết định.
  const loose = deriveMetrics({ ...base, measurement_tolerance_mm: 1 }, 3, 'appearance-inspection').context;
  assert.equal(loose.required_resolution_px, 3800);
});

test('runSelector truyền slug xuống derive, luật thấy đúng con số', () => {
  const rules = [
    rule({ code: 'BASE', priority: 100, recommended_camera: 'area scan' }),
    rule({
      code: 'HIGH-RES',
      priority: 50,
      recommended_camera: 'area scan lớn',
      condition_json: { all: [{ field: 'required_resolution_px', op: 'gt', value: 2000 }] },
    }),
  ];
  const input = { fov_width_mm: 100, fov_height_mm: 50, tolerance_mm: 0.1 };

  const measure = runSelector(rules, input, '2d-measurement');
  assert.ok(!measure.matchedRuleCodes.includes('HIGH-RES'), '1667 px khong vuot 2000');
  assert.equal(measure.camera, 'area scan');

  const alignment = runSelector(rules, input, 'alignment');
  assert.ok(alignment.matchedRuleCodes.includes('HIGH-RES'), '3000 px vuot 2000');
});

// ------------------------------------------- CHIỀU CAO FOV (sửa lỗi MP dư) --
// Trước khi sửa: sáu bài không hỏi `capture_mode` không bao giờ hiện ô
// fov_height_mm, và derive lấy chiều cao = chiều rộng. FOV 100 × 50 mm ra 9 MP.

const ALIGNMENT_FIELDS = [
  'fov_width_mm', 'fov_height_mm', 'tolerance_mm', 'rotation_range_deg',
  'working_distance_mm', 'throughput_ppm', 'surface', 'environment', 'ip_rating',
];

test('bài không khai capture_mode vẫn hỏi chiều cao FOV', () => {
  const shown = visibleFieldDefs(getFieldDefs(ALIGNMENT_FIELDS), () => null).map((d) => d.key);
  assert.ok(shown.includes('fov_height_mm'));
});

test('bài ngoại quan vẫn ẩn/hiện chiều cao theo capture_mode như cũ', () => {
  const defs = getFieldDefs(['capture_mode', 'fov_width_mm', 'fov_height_mm', 'blur_px']);
  const keys = (mode: string | null) =>
    visibleFieldDefs(defs, (k) => (k === 'capture_mode' ? mode : null)).map((d) => d.key);

  assert.ok(!keys(null).includes('fov_height_mm'), 'chua chon kieu chup thi chua hoi');
  assert.ok(!keys('line_scan').includes('fov_height_mm'), 'line scan khong co chieu cao');
  assert.ok(keys('static').includes('fov_height_mm'));
  assert.ok(!keys('static').includes('blur_px'), 'blur chi hoi khi chup dong');
});

test('FOV 100×50 ra 4,5 MP, KHÔNG phải 9 MP', () => {
  const { context, assumptions } = deriveMetrics(
    { fov_width_mm: 100, fov_height_mm: 50, tolerance_mm: 0.1 },
    DEFAULT_SAFETY_FACTOR,
    'alignment'
  );
  assert.equal(context.required_resolution_px, 3000);
  assert.equal(context.fov_short_mm, 50);
  assert.equal(context.required_sensor_mp, 4.5);
  assert.deepEqual(assumptions, [], 'du hai canh thi khong gia dinh gi');
});

test('FOV 100×100 không đổi so với trước', () => {
  const { context, assumptions } = deriveMetrics(
    { fov_width_mm: 100, fov_height_mm: 100, tolerance_mm: 0.1 },
    DEFAULT_SAFETY_FACTOR,
    'alignment'
  );
  assert.equal(context.required_resolution_px, 3000);
  assert.equal(context.required_sensor_mp, 9);
  assert.deepEqual(assumptions, []);
});

test('thiếu chiều cao: giả định 4:3 (không phải vuông) và báo rõ trong kết quả', () => {
  assert.equal(FALLBACK_FOV_ASPECT, 0.75);
  const input = { fov_width_mm: 100, tolerance_mm: 0.1 };
  const { context, metrics, assumptions } = deriveMetrics(input, DEFAULT_SAFETY_FACTOR, 'alignment');

  assert.equal(context.fov_short_mm, 75);
  assert.equal(context.required_sensor_mp, 6.75, '3000 x 2250, khong phai 3000 x 3000');
  assert.equal(assumptions.length, 1);
  assert.equal(assumptions[0].key, 'fov_height_mm');
  assert.equal(assumptions[0].value, 75);
  assert.equal(assumptions[0].ratio, '4:3');
  assert.ok(assumptions[0].vi.includes('75 mm') && assumptions[0].vi.includes('4:3'), assumptions[0].vi);
  assert.ok(assumptions[0].en.includes('75 mm'), assumptions[0].en);

  const fovFormula = metrics.find((m) => m.key === 'fov_long_mm')!.formula;
  assert.ok(fovFormula.includes('(giả định)'), fovFormula);

  const result = runSelector([rule({ code: 'BASE', priority: 100 })], input, 'alignment');
  assert.deepEqual(result.assumptions, assumptions, 'engine phai mang gia dinh ra ket qua');
});

test('line scan thiếu chiều cao là đúng thiết kế: không giả định, số không đổi', () => {
  const { context, assumptions } = deriveMetrics(
    { capture_mode: 'line_scan', fov_width_mm: 100, defect_min_size_mm: 0.2 },
    DEFAULT_SAFETY_FACTOR,
    'appearance-inspection'
  );
  assert.deepEqual(assumptions, []);
  assert.equal(context.fov_short_mm, 100);
});
