/**
 * Test cho bộ tính toán bài Kiểm tra ngoại quan.
 *
 * Mỗi lỗi nguyên tắc đã sửa đều có một test canh, để nó không lặng lẽ quay lại:
 * tính hai trục riêng, kiểm ngược lại với camera thật, ngân sách thời gian thay
 * cho nhịp ảnh, nhoè chuyển động, và byte/px theo định dạng ảnh.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  airyDiskUm,
  analyseAppearance,
  cameraCount,
  cameraGrid,
  cameraTile,
  perspectiveCheck,
  perspectiveErrorMm,
  ERROR_WARN_SHARE,
  maxDeltaTK,
  thermalCheck,
  thermalErrorUm,
  K_STITCH,
  seamsCrossed,
  stitchCheck,
  cameraCoversNeed,
  cycleBudget,
  depthOfFieldMm,
  estimateLens,
  frameTransfer,
  maxExposureForBlur,
  peakHostBandwidth,
  PIXEL_FORMAT_BYTES,
  requiredLpPerMm,
  lineScanNeed,
  requiredPixels,
  measurementBudget,
  resolutionChecks,
  GRR_DIVISOR,
  K_SUBPIXEL,
  suggestLighting,
  verifyResolution,
  worstStatus,
  DEFAULT_APPEARANCE_INPUT,
  type AppearanceInput,
  type CameraLike,
} from '../src/lib/vision';
import {
  coversSensor,
  sensorDiagonalMm,
  INTERFACE_BANDWIDTH,
  SENSOR_FORMATS,
  SENSOR_FORMAT_KEYS,
  SPEC_FIELDS,
} from '../src/lib/components/specs';
import { appearanceInputFromForm } from '../src/lib/vision/fromInput';

// ------------------------------------------------------------ ĐỘ PHÂN GIẢI --

test('tính số pixel RIÊNG cho từng trục, không suy trục này từ trục kia', () => {
  // FOV 100 x 40 mm, lỗi 0,2 mm, N = 3 -> mm/px muc tieu = 0,0667
  const need = requiredPixels({
    fovWidthMm: 100,
    fovHeightMm: 40,
    defectMinSizeMm: 0.2,
    pxPerDefect: 3,
  })!;

  assert.equal(need.mmPerPxTarget, 0.2 / 3);
  assert.equal(need.nx, 1500);
  assert.equal(need.ny, 600, 'truc ngan phai ra so khac han truc dai');
  assert.notEqual(need.nx, need.ny, 'FOV khong vuong thi hai truc khong the bang nhau');
});

test('N đổi thì số pixel cần đổi theo — N không còn bị đóng cứng ở 3', () => {
  const base = { fovWidthMm: 100, fovHeightMm: 100, defectMinSizeMm: 0.2 };
  const n3 = requiredPixels({ ...base, pxPerDefect: 3 })!;
  const n9 = requiredPixels({ ...base, pxPerDefect: 9 })!;

  assert.equal(n3.nx, 1500);
  assert.equal(n9.nx, 4500, 'N = 9 (phan loai loi) doi gap ba lan so pixel');
});

test('camera đủ megapixel vẫn có thể THIẾU pixel trên một trục', () => {
  const need = requiredPixels({
    fovWidthMm: 200,
    fovHeightMm: 20,
    defectMinSizeMm: 0.2,
    pxPerDefect: 3,
  })!;
  assert.equal(need.nx, 3000);
  assert.equal(need.ny, 300);

  // 5 MP nhung ti le 4:3 -> chieu ngang chi 2592 px, thieu so voi 3000.
  const camera = { widthPx: 2592, heightPx: 1944 };
  assert.equal(camera.widthPx * camera.heightPx > need.nx * need.ny, true, 'du tong so pixel');
  assert.equal(cameraCoversNeed(camera, need), false, 'nhung van thieu tren truc ngang');
});

test('tính ngược từ camera thật ra mm/px và px/lỗi, kèm PASS/FAIL', () => {
  const input = { fovWidthMm: 100, fovHeightMm: 75, defectMinSizeMm: 0.2, pxPerDefect: 3 };
  const verdict = verifyResolution({ widthPx: 2592, heightPx: 1944 }, input)!;

  assert.equal(verdict.mmPerPxX, 0.03858);
  assert.equal(verdict.mmPerPxY, 0.03858);
  assert.equal(verdict.pxPerDefectX, 5.18);
  assert.equal(verdict.meetsTarget, true, '5,18 px >= 3 px muc tieu');

  // Cung camera nhung FOV rong gap ba -> khong con dat.
  const wide = verifyResolution(
    { widthPx: 2592, heightPx: 1944 },
    { ...input, fovWidthMm: 300, fovHeightMm: 225 }
  )!;
  assert.equal(wide.meetsTarget, false);
  assert.ok(wide.worstPxPerDefect < 3);
});

test('số camera phủ chiều dài, có tính chồng lấn', () => {
  // 1000 mm, FOV 100 mm, chong lan 10% -> moi camera phu hieu dung 90 mm
  assert.equal(cameraCount({ totalLengthMm: 1000, fovWidthMm: 100, overlapRatio: 0.1 }), 12);
  assert.equal(cameraCount({ totalLengthMm: 1000, fovWidthMm: 100, overlapRatio: 0 }), 10);
  assert.equal(cameraCount({ totalLengthMm: 0, fovWidthMm: 100, overlapRatio: 0.1 }), null);
});

// ------------------------------------------------------------- BĂNG THÔNG --

test('byte/px theo định dạng ảnh — không còn mặc định 3 byte cho ảnh màu', () => {
  assert.equal(PIXEL_FORMAT_BYTES.Mono8, 1);
  assert.equal(PIXEL_FORMAT_BYTES.BayerRG8, 1, 'camera mau truyen Bayer tho 1 byte/px');
  assert.equal(PIXEL_FORMAT_BYTES.Mono12packed, 1.5);
  assert.equal(PIXEL_FORMAT_BYTES.Mono16, 2);
  assert.equal(PIXEL_FORMAT_BYTES.RGB8, 3);
});

test('kích thước ảnh và thời gian truyền theo băng thông hữu dụng', () => {
  const transfer = frameTransfer({
    widthPx: 2592,
    heightPx: 1944,
    pixelFormat: 'Mono8',
    interfaceName: 'GigE',
  })!;

  assert.equal(transfer.frameSizeBytes, 2592 * 1944);
  assert.equal(transfer.usableMbytesS, 110, 'GigE lay 110 MB/s chu khong phai 125 ly thuyet');
  // 5.038.848 byte / 110 MB/s = 45,808 ms
  assert.equal(transfer.transferMs, 45.808);

  // Cung anh do nhung Mono16 thi nang gap doi.
  const mono16 = frameTransfer({
    widthPx: 2592,
    heightPx: 1944,
    pixelFormat: 'Mono16',
    interfaceName: 'GigE',
  })!;
  // Lam tron tung gia tri nen khong khop tuyet doi; dieu can khang dinh la GAP DOI.
  assert.ok(Math.abs(mono16.transferMs - transfer.transferMs * 2) < 0.01);
});

test('băng thông đỉnh khi nhiều camera truyền đồng thời', () => {
  assert.equal(peakHostBandwidth(110, 4), 440);
  assert.equal(peakHostBandwidth(110, 1), 110);
});

// ------------------------------------------------------ NHOÈ CHUYỂN ĐỘNG --

test('trần thời gian phơi sáng theo tốc độ băng tải', () => {
  // 1 px nhoe, 0,04 mm/px, 200 mm/s -> 0,2 ms
  const blur = maxExposureForBlur({ blurPx: 1, mmPerPx: 0.04, speedMmS: 200 })!;
  assert.equal(blur.maxExposureMs, 0.2);
  assert.equal(blur.needsStrobe, true, 'duoi 1 ms thi bat buoc global shutter + strobe');

  // Bang tai cham thi thoai mai hon.
  const slow = maxExposureForBlur({ blurPx: 1, mmPerPx: 0.04, speedMmS: 10 })!;
  assert.equal(slow.maxExposureMs, 4);
  assert.equal(slow.needsStrobe, false);

  // Loi nho doi chat hon: blur 0,5 px thi tran giam mot nua.
  const strict = maxExposureForBlur({ blurPx: 0.5, mmPerPx: 0.04, speedMmS: 10 })!;
  assert.equal(strict.maxExposureMs, 2);
});

// -------------------------------------------------- NGÂN SÁCH THỜI GIAN --

test('ngân sách thời gian chu kỳ thay cho chỉ số nhịp ảnh', () => {
  // 60 sp/phut -> chu ky 1000 ms; duty 0,5 -> kha dung 1000*0,5*0,7 = 350 ms
  const budget = cycleBudget({
    throughputPpm: 60,
    dutyRatio: 0.5,
    nView: 1,
    triggerMs: 1,
    exposureMs: 5,
    readoutMs: 5,
    transferMs: 45.8,
    processMs: 20,
    outputMs: 2,
  })!;

  assert.equal(budget.cycleMs, 1000);
  assert.equal(budget.availableMs, 350);
  assert.equal(budget.consumedMs, 78.8, '1x(1+5+5+45,8) + 20 + 2');
  assert.equal(budget.fits, true);
});

test('nhiều ảnh mỗi sản phẩm có thể làm vỡ ngân sách', () => {
  const common = {
    throughputPpm: 120,
    dutyRatio: 0.4,
    triggerMs: 1,
    exposureMs: 5,
    readoutMs: 5,
    transferMs: 45.8,
    processMs: 20,
    outputMs: 2,
  };

  assert.equal(cycleBudget({ ...common, nView: 1 })!.fits, true);
  assert.equal(cycleBudget({ ...common, nView: 4 })!.fits, false, '4 anh/sp thi khong kip');
});

// ------------------------------------------------------------- QUANG HỌC --

test('ước lượng tiêu cự và khoảng cách làm việc', () => {
  // Cam bien 8,8 mm, FOV 100 mm -> beta = 0,088; WD 300 mm
  const lens = estimateLens({ sensorSizeMm: 8.8, fovMm: 100, workingDistanceMm: 300 })!;

  assert.equal(lens.beta, 0.088);
  assert.equal(lens.focalLengthMm, 24.26);
  // Suy nguoc lai phai ra dung khoang cach ban dau.
  assert.equal(Math.round(lens.workingDistanceMm), 300);
});

test('đĩa Airy cảnh báo khi ống kính thành nút cổ chai', () => {
  // F/8 -> 2,44 * 0,55 * 8 = 10,736 um
  assert.equal(airyDiskUm(8), 10.736);
  // Pixel 3,45 um: 2 x 3,45 = 6,9 < 10,736 -> lens la nut co chai
  assert.ok(airyDiskUm(8)! > 2 * 3.45);
  // F/2,8 thi khong con la van de
  assert.ok(airyDiskUm(2.8)! < 2 * 3.45);
});

test('độ phân giải ống kính cần có theo cỡ pixel', () => {
  // Pixel 3,45 um = 0,00345 mm -> 1/(2*0,00345) = 145 lp/mm
  assert.equal(requiredLpPerMm(3.45), 144.9);
  // Pixel to hon thi de hon
  assert.ok(requiredLpPerMm(5.5)! < 100);
});

test('chiều sâu trường ảnh giảm rất nhanh khi độ phóng đại tăng', () => {
  const shallow = depthOfFieldMm({ fNumber: 5.6, circleOfConfusionMm: 0.0069, beta: 0.5 })!;
  const deep = depthOfFieldMm({ fNumber: 5.6, circleOfConfusionMm: 0.0069, beta: 0.088 })!;
  assert.ok(deep > shallow, 'beta nho (FOV rong) thi DOF sau hon nhieu');
});

// ------------------------------------------------------------ CHIẾU SÁNG --

test('bảng gợi ý chiếu sáng theo loại lỗi', () => {
  assert.equal(suggestLighting({ defectType: 'scratch', surface: null })?.lightType, 'darkfield');
  assert.equal(suggestLighting({ defectType: 'glossy_curved', surface: null })?.lightType, 'dome');
  assert.equal(suggestLighting({ defectType: 'print_color', surface: null })?.lightType, 'coaxial');
  assert.equal(
    suggestLighting({ defectType: 'profile_hole_burr', surface: null })?.lightType,
    'backlight'
  );
  assert.equal(
    suggestLighting({ defectType: 'shallow_dent', surface: null })?.lightType,
    'photometric_stereo'
  );
  assert.equal(suggestLighting({ defectType: null, surface: null }), null, 'khong doan bua');
});

test('bề mặt lấn át loại lỗi khi trong suốt hoặc bóng như gương', () => {
  // Xuoc tren mat guong: dark field thong thuong chi thay loa.
  assert.equal(
    suggestLighting({ defectType: 'scratch', surface: 'reflective' })?.lightType,
    'dome',
    'be mat bong phai thang loai loi'
  );
  assert.equal(
    suggestLighting({ defectType: 'scratch', surface: 'transparent' })?.lightType,
    'backlight'
  );
});

// ----------------------------------------------------------- TỔNG THỂ --

const CAMERA: CameraLike = {
  widthPx: 2592,
  heightPx: 1944,
  pixelSizeUm: 3.45,
  sensorFormat: '2/3',
  interfaceName: 'GigE',
};

function makeInput(over: Partial<AppearanceInput> = {}): AppearanceInput {
  return {
    ...DEFAULT_APPEARANCE_INPUT,
    fovWidthMm: 100,
    fovHeightMm: 75,
    defectMinSizeMm: 0.2,
    defectType: 'scratch',
    surface: 'matte',
    heightToleranceMm: 2,
    workingDistanceMm: 300,
    throughputPpm: 60,
    speedMmS: 100,
    totalLengthMm: null,
    fNumber: 5.6,
    ...over,
  };
}

test('phân tích tổng thể trả về đủ các nhóm và trạng thái xấu nhất', () => {
  const analysis = analyseAppearance(makeInput(), CAMERA, { imageCircleFormat: '2/3' });

  assert.deepEqual(
    analysis.sections.map((s) => s.key),
    ['resolution', 'timing', 'linescan', 'optics', 'lighting']
  );
  // Khoi line scan co y de rong o che do khac — nhung nhom con lai phai co.
  assert.ok(
    analysis.sections.filter((s) => s.key !== 'linescan').every((s) => s.checks.length > 0),
    'nhom nao cung phai co phep kiem'
  );
  assert.equal(analysis.standingWarningKey, 'contrastDisclaimer', 'canh bao co dinh luon co');
});

test('cấu hình bất khả thi bị đánh FAIL, không trả về im lặng', () => {
  // FOV rong gap ba -> khong du pixel/loi.
  const analysis = analyseAppearance(
    makeInput({ fovWidthMm: 400, fovHeightMm: 300 }),
    CAMERA,
    { imageCircleFormat: '2/3' }
  );

  const resolution = analysis.sections.find((s) => s.key === 'resolution')!;
  assert.equal(worstStatus(resolution.checks), 'fail');
  assert.equal(analysis.overall, 'fail');
});

test('vòng ảnh nhỏ hơn đường chéo cảm biến bị đánh FAIL', () => {
  const analysis = analyseAppearance(
    makeInput(),
    { ...CAMERA, sensorFormat: '1' },
    { imageCircleFormat: '2/3' }
  );

  const optics = analysis.sections.find((s) => s.key === 'optics')!;
  const check = optics.checks.find((c) => c.key === 'imageCircle')!;
  assert.equal(check.status, 'fail');
});

test('nhoè chuyển động siết phơi sáng xuống và cảnh báo strobe', () => {
  // Phai noi ro la chup khi vat dang chay — mac dinh gio la chup tinh.
  const analysis = analyseAppearance(
    makeInput({ captureMode: 'moving_area', speedMmS: 500 }),
    CAMERA,
    null
  );
  const timing = analysis.sections.find((s) => s.key === 'timing')!;
  const blur = timing.checks.find((c) => c.key === 'motionBlur')!;

  assert.equal(blur.status, 'warn');
  assert.equal(blur.noteKey, 'blurNeedsStrobe');
});

// ------------------------------------------------------------ KIỂU CHỤP --

test('chụp tĩnh thì KHÔNG có nhoè chuyển động', () => {
  const analysis = analyseAppearance(
    makeInput({ captureMode: 'static', speedMmS: 500 }),
    CAMERA,
    null
  );
  const timing = analysis.sections.find((s) => s.key === 'timing')!;
  const blur = timing.checks.find((c) => c.key === 'motionBlur')!;

  // Toc do 500 mm/s van nam trong input, nhung chup tinh thi no vo nghia.
  assert.equal(blur.status, 'pass');
  assert.equal(blur.noteKey, 'staticNoBlur');
});

test('chụp tĩnh cộng thời gian chờ hết rung vào ngân sách', () => {
  const base = makeInput({ captureMode: 'static', throughputPpm: 60, settleTimeMs: 0 });
  const withSettle = makeInput({ captureMode: 'static', throughputPpm: 60, settleTimeMs: 200 });

  /* Do HIEU SO thay vi nguong PASS/FAIL: dieu can khang dinh la thoi gian cho
     duoc CONG VAO, khong phai la no vuot nguong o mot cau hinh cu the. */
  const consumedMs = (input: AppearanceInput) => {
    const timing = analyseAppearance(input, CAMERA, null).sections.find((s) => s.key === 'timing')!;
    const formula = timing.checks.find((c) => c.key === 'timeConsumed')!.formula;
    // "... = 278.8 ms ≤ 350 ms" -> lấy con số ngay sau dấu bằng.
    return Number(formula.split('= ')[1].split(' ms')[0]);
  };

  assert.equal(
    Math.round(consumedMs(withSettle) - consumedMs(base)),
    200,
    'cho 200 ms het rung phai an vao ngan sach chu khong bien mat'
  );
});

test('động area scan vẫn tính nhoè như cũ', () => {
  const analysis = analyseAppearance(
    makeInput({ captureMode: 'moving_area', speedMmS: 500 }),
    CAMERA,
    null
  );
  const timing = analysis.sections.find((s) => s.key === 'timing')!;
  const blur = timing.checks.find((c) => c.key === 'motionBlur')!;

  assert.equal(blur.status, 'warn');
  assert.equal(blur.noteKey, 'blurNeedsStrobe');
});

// ------------------------------------------------------------- LINE SCAN --

const LINE_CAMERA: CameraLike = {
  cameraType: 'line',
  widthPx: 0,
  heightPx: 0,
  lineWidthPx: 4096,
  maxLineRateKhz: 45,
  pixelSizeUm: 3.5,
  sensorFormat: null,
  interfaceName: '5GigE',
};

test('tần số dòng cần thiết để pixel vuông', () => {
  // FOV 100 mm tren 4096 px -> 0,0244 mm/px. Toc do 200 mm/s -> 8192 dong/s.
  const need = lineScanNeed({
    speedMmS: 200,
    mmPerPxCross: 100 / 4096,
    lineWidthPx: 4096,
    bytesPerPixel: 1,
  })!;

  assert.equal(need.lineRateHz, 8192);
  assert.equal(need.maxExposureMs, 0.1221, 'moi dong chi duoc phoi sang 0,12 ms');
  // 4096 px x 8192 dong/s x 1 byte = 33,55 MB/s
  assert.equal(need.dataRateMbytesS, 33.55);
});

test('line scan chỉ kiểm bề ngang, không kiểm chiều dọc', () => {
  // Camera line scan co heightPx = 0. Neu kiem ca hai truc thi luon FAIL.
  const analysis = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200 }),
    LINE_CAMERA,
    null
  );
  const resolution = analysis.sections.find((s) => s.key === 'resolution')!;
  const fits = resolution.checks.find((c) => c.key === 'sensorFits')!;

  // 100 mm / (0,2/3) = 1500 px can theo be ngang; 4096 >= 1500.
  assert.equal(fits.status, 'pass', 'chieu doc do quet sinh ra, khong bi cam bien gioi han');
});

test('khối line scan chỉ xuất hiện ở chế độ quét dòng', () => {
  const line = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200 }),
    LINE_CAMERA,
    null
  );
  const area = analyseAppearance(makeInput({ captureMode: 'moving_area' }), CAMERA, null);

  const lineSection = (a: typeof line) => a.sections.find((s) => s.key === 'linescan')!;
  assert.ok(lineSection(line).checks.length > 0, 'che do quet dong phai co khoi rieng');
  assert.equal(lineSection(area).checks.length, 0, 'che do khac thi khoi nay rong');
});

test('camera không chạy nổi tần số dòng thì FAIL', () => {
  const slowCamera: CameraLike = { ...LINE_CAMERA, maxLineRateKhz: 5 };
  const analysis = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200 }),
    slowCamera,
    null
  );
  const check = analysis.sections
    .find((s) => s.key === 'linescan')!
    .checks.find((c) => c.key === 'lineRateFits')!;

  // Can 8192 dong/s nhung camera chi 5000.
  assert.equal(check.status, 'fail');
  assert.equal(check.noteKey, 'lineRateTooHigh');
});

test('thiếu encoder thì cảnh báo, encoder thô hơn một pixel cũng cảnh báo', () => {
  const noEncoder = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200 }),
    LINE_CAMERA,
    null
  );
  const check = (a: typeof noEncoder) =>
    a.sections.find((s) => s.key === 'linescan')!.checks.find((c) => c.key === 'encoder')!;

  assert.equal(check(noEncoder).status, 'warn');
  assert.equal(check(noEncoder).noteKey, 'encoderMissing');

  // 0,0244 mm/px = 24,4 um. Encoder 50 um/xung la tho hon mot pixel.
  const coarse = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200, encoderResolutionUm: 50 }),
    LINE_CAMERA,
    null
  );
  assert.equal(check(coarse).status, 'warn');
  assert.equal(check(coarse).noteKey, 'encoderTooCoarse');

  const fine = analyseAppearance(
    makeInput({ captureMode: 'line_scan', speedMmS: 200, encoderResolutionUm: 10 }),
    LINE_CAMERA,
    null
  );
  assert.equal(check(fine).status, 'pass');
});

// ------------------------------------------------- CỠ CẢM BIẾN & GIAO TIẾP --

test('cảm biến 1.1" tính được tiêu cự, không còn rơi khỏi bảng cỡ cảm biến', () => {
  const sensor = SENSOR_FORMATS['1.1'];
  assert.equal(sensor.widthMm, 14.13);
  assert.equal(sensor.heightMm, 10.35);

  // FOV 380 mm, WD 300 mm -> beta = 14,13/380 = 0,0372; f = 300*beta/(1+beta)
  const lens = estimateLens({ sensorSizeMm: sensor.widthMm, fovMm: 380, workingDistanceMm: 300 })!;
  assert.equal(lens.beta, 0.0372);
  assert.equal(lens.focalLengthMm, 10.76);

  /* Quan trọng hơn con số: camera 1.1" đi qua bộ phân tích phải SINH RA phép
     kiểm tiêu cự. Trước đây tra bảng không thấy format thì khối quang học lặng
     lẽ thiếu hai phép kiểm — không FAIL, không cảnh báo, người dùng chỉ thấy
     một bảng kết quả ngắn hơn bình thường và không có cách nào biết vì sao.
     Đây là nhóm camera 12–24 MP đang dùng nhiều nhất, nên chỗ hổng này rơi
     trúng đúng phần lớn dự án. */
  const analysis = analyseAppearance(makeInput(), { ...CAMERA, sensorFormat: '1.1' }, {
    imageCircleFormat: '4/3',
  });
  const optics = analysis.sections.find((s) => s.key === 'optics')!;
  assert.ok(
    optics.checks.some((c) => c.key === 'focalLength'),
    'format co trong bang thi phai tinh duoc tieu cu'
  );
});

test('thêm format mới không làm hỏng phép kiểm vòng ảnh', () => {
  /* Đây là phép canh cho việc gộp SENSOR_FORMAT_ORDER vào SENSOR_FORMATS. Khi
     thứ tự còn nằm ở mảng riêng, thêm format vào bảng mà quên mảng thì
     coversSensor trả false cho MỌI ống kính: bộ chọn loại sạch lens khỏi kết
     quả, không FAIL, không cảnh báo. Nay thứ tự suy từ đường chéo nên chỉ khai
     kích thước là đủ. */
  // 14,13² + 10,35² → 17,5151 mm. Không so bằng số làm tròn: đường chéo nay
  // tính từ hai cạnh, không còn số khai sẵn nào để so.
  assert.ok(Math.abs(sensorDiagonalMm('1.1')! - 17.5151) < 0.0001);

  // 1.1" (17,52 mm) nằm GIỮA 1" (16 mm) và 4/3" (22 mm) — thêm vào cuối một
  // mảng viết tay là sai thứ tự, sort theo đường chéo thì tự đúng chỗ.
  const at = SENSOR_FORMAT_KEYS.indexOf('1.1');
  assert.equal(SENSOR_FORMAT_KEYS[at - 1], '1');
  assert.equal(SENSOR_FORMAT_KEYS[at + 1], '4/3');

  assert.equal(coversSensor('4/3', '1.1'), true, 'vong anh 22 mm phu duoc duong cheo 17,52 mm');
  assert.equal(coversSensor('1', '1.1'), false, 'vong anh 16 mm KHONG phu noi 17,52 mm');
  assert.equal(coversSensor('1.1', '2/3'), true);
  assert.equal(coversSensor('1.1', 'APS-C'), false);

  // Bảy format cũ phải cho đúng kết quả như thời còn so theo vị trí trong mảng.
  assert.equal(coversSensor('2/3', '1/1.8'), true);
  assert.equal(coversSensor('1/1.8', '2/3'), false);
  assert.equal(coversSensor('2/3', '2/3'), true, 'bang nhau thi van phu');
  assert.equal(coversSensor('4/3', null), false, 'thieu thong so thi loai, khong doan');

  // Và phải chạy thật tới đầu ra: lens 1" gắn cảm biến 1.1" bị đánh FAIL.
  const analysis = analyseAppearance(makeInput(), { ...CAMERA, sensorFormat: '1.1' }, {
    imageCircleFormat: '1',
  });
  const check = analysis.sections
    .find((s) => s.key === 'optics')!
    .checks.find((c) => c.key === 'imageCircle')!;
  assert.equal(check.status, 'fail');
});

test('đường chéo tính từ bề rộng và chiều cao, không có số khai sẵn', () => {
  /* Trước đây bảng khai sẵn diagonalMm làm tròn 2 chữ số, kèm một test chốt
     "số khai phải khớp hai cạnh trong 0,01 mm". Đó là chốt cho một nguồn thứ
     hai không nên tồn tại. Nay đường chéo tính lúc chạy, nên chốt đúng điều đó:
     không có trường khai sẵn, và giá trị trả ra đúng bằng √(w² + h²). */
  for (const [format, size] of Object.entries(SENSOR_FORMATS)) {
    assert.ok(!('diagonalMm' in size), `${format}: khong duoc khai san duong cheo`);
    assert.equal(
      sensorDiagonalMm(format),
      Math.sqrt(size.widthMm ** 2 + size.heightMm ** 2),
      `${format}: duong cheo phai tinh tu hai canh`
    );
  }
});

test('CXP-12 và Camera Link Full tính được thời gian truyền ảnh', () => {
  assert.equal(INTERFACE_BANDWIDTH['CXP-12'], 1200);
  assert.equal(INTERFACE_BANDWIDTH['CameraLink-Full'], 680);

  const shot = { widthPx: 4096, heightPx: 3000, pixelFormat: 'Mono8' as const };

  // 12.288.000 byte / 1200 MB/s = 10,24 ms
  const cxp = frameTransfer({ ...shot, interfaceName: 'CXP-12' })!;
  assert.equal(cxp.usableMbytesS, 1200);
  assert.equal(cxp.transferMs, 10.24);

  // 12.288.000 byte / 680 MB/s ≈ 18,07 ms
  const cameraLink = frameTransfer({ ...shot, interfaceName: 'CameraLink-Full' })!;
  assert.ok(Math.abs(cameraLink.transferMs - 18.07) < 0.01, `${cameraLink.transferMs}`);

  /* Chuẩn thiếu trong bảng thì frameTransfer trả null và khối băng thông biến
     mất khỏi kết quả — cấu hình 12 MP chạy GigE trông "không có vấn đề" chỉ vì
     phép kiểm không chạy. So với GigE mới thấy vì sao phải có hai chuẩn này. */
  const gige = frameTransfer({ ...shot, interfaceName: 'GigE' })!;
  assert.ok(gige.transferMs > cxp.transferMs * 10, 'cung anh do, GigE cham hon 10 lan');
  assert.equal(frameTransfer({ ...shot, interfaceName: 'CXP-25' }), null, 'chuan la thi tra null');
});

test('dropdown cỡ cảm biến sắp theo đường chéo tăng dần, không theo thứ tự khai báo', () => {
  /* Hai ô chọn của form admin (sensor_format của camera, image_circle của lens)
     trước đây lấy từ mảng SENSOR_FORMAT_ORDER viết tay. Nay lấy từ
     SENSOR_FORMAT_KEYS suy ra bằng sort theo đường chéo. Test này chốt ba
     điều: thứ tự đúng, nó thật sự đơn điệu theo đường chéo, và hai ô chọn
     dùng đúng danh sách đó chứ không phải một bản sao nào khác. */
  assert.deepEqual(SENSOR_FORMAT_KEYS, [
    '1/3',
    '1/2.5',
    '1/2',
    '1/1.8',
    '2/3',
    '1',
    '1.1',
    '4/3',
    'APS-C',
  ]);

  // Đường chéo phải TĂNG ĐƠN ĐIỆU. Đây là bất biến thật: ai khai thêm format
  // vào giữa object cũng không làm lệch được, vì thứ tự do sort quyết định.
  const diagonals = SENSOR_FORMAT_KEYS.map((key) => sensorDiagonalMm(key)!);
  for (let i = 1; i < diagonals.length; i += 1) {
    assert.ok(
      diagonals[i] > diagonals[i - 1],
      `${SENSOR_FORMAT_KEYS[i]} (${diagonals[i]} mm) phai lon hon ${SENSOR_FORMAT_KEYS[i - 1]} (${diagonals[i - 1]} mm)`
    );
  }

  // Không rơi và không thừa khoá so với bảng gốc.
  assert.deepEqual([...SENSOR_FORMAT_KEYS].sort(), Object.keys(SENSOR_FORMATS).sort());

  // Và hai ô chọn của form admin phải trỏ đúng vào danh sách này.
  const sensorField = SPEC_FIELDS.camera.find((f) => f.key === 'sensor_format')!;
  const imageCircleField = SPEC_FIELDS.lens.find((f) => f.key === 'image_circle')!;
  assert.deepEqual(sensorField.options, SENSOR_FORMAT_KEYS, 'o chon sensor_format');
  assert.deepEqual(imageCircleField.options, SENSOR_FORMAT_KEYS, 'o chon image_circle');
});

test('Camera Link tách theo cấu hình, không còn khoá chung dễ gán nhầm', () => {
  /* Khoá chung `CameraLink: 800` cũ không khớp cấu hình nào, và gán cho camera
     Base thì hệ được tính dư ba lần. Số dưới đây theo Gidel và Agmanic. */
  assert.equal(INTERFACE_BANDWIDTH.CameraLink, undefined, 'khong con khoa chung');
  assert.equal(INTERFACE_BANDWIDTH['CameraLink-Base'], 255);
  assert.equal(INTERFACE_BANDWIDTH['CameraLink-Medium'], 510);
  assert.equal(INTERFACE_BANDWIDTH['CameraLink-Full'], 680);
  assert.equal(INTERFACE_BANDWIDTH['CameraLink-Deca'], 850);
});

// ---------------------------------------------- NHÁNH ĐO LƯỜNG (GAP 1) --
// Số tham chiếu lấy từ docs/UI_CONTENT_V1.md phần A.2 (bài GT-002) — KHÔNG lấy
// từ mockup.

test('ngân sách đo: ±0,1 mm → T = 0,2 → U = 0,02 → 0,06 mm/px', () => {
  assert.equal(GRR_DIVISOR, 10);
  assert.equal(K_SUBPIXEL, 3);

  const budget = measurementBudget(0.1)!;
  assert.ok(Math.abs(budget.totalToleranceMm - 0.2) < 1e-12, 'dung sai ± phai nhan doi');
  assert.ok(Math.abs(budget.uncertaintyBudgetMm - 0.02) < 1e-12);
  assert.ok(Math.abs(budget.mmPerPx - 0.06) < 1e-12);

  assert.equal(measurementBudget(null), null, 'khong co dung sai thi khong co nhanh do');
  assert.equal(measurementBudget(0), null);
  assert.equal(measurementBudget(-0.1), null);
});

test('hai nhánh độc lập, lấy min — ở GT-002 nhánh đo lường quyết định', () => {
  const need = requiredPixels({
    fovWidthMm: 380,
    fovHeightMm: 280,
    defectMinSizeMm: 0.5,
    pxPerDefect: 5,
    measurementToleranceMm: 0.1,
  })!;

  assert.ok(Math.abs(need.mmPerPxDetection - 0.1) < 1e-12, '0,5 / 5');
  assert.ok(Math.abs(need.mmPerPxMeasurement! - 0.06) < 1e-12, '(0,2 / 10) x 3');
  assert.equal(need.governing, 'measurement');
  assert.ok(Math.abs(need.mmPerPxTarget - 0.06) < 1e-12, 'min, khong phai trung binh');

  // Tài liệu ghi 6333 × 4667 vì làm tròn thường. Cần ĐỦ pixel thì phải làm
  // tròn LÊN: 380 / 0,06 = 6333,3 → 6334.
  assert.equal(need.nx, 6334);
  assert.equal(need.ny, 4667);
  assert.ok(Math.abs((need.nx * need.ny) / 1e6 - 29.6) < 1.0, 'tai lieu: 29,6 MP, sai so 1,0');

  // Chênh 1,67× giữa hai nhánh.
  assert.ok(Math.abs(need.mmPerPxDetection / need.mmPerPxMeasurement! - 1.67) < 0.01);
});

test('lưới 4 camera 200 × 150 mm: mỗi camera cần ~8,3 MP chứ không phải 3,0 MP', () => {
  const base = { fovWidthMm: 200, fovHeightMm: 150, defectMinSizeMm: 0.5, pxPerDefect: 5 };
  const detectionOnly = requiredPixels(base)!;
  const withMeasurement = requiredPixels({ ...base, measurementToleranceMm: 0.1 })!;

  assert.ok(Math.abs((detectionOnly.nx * detectionOnly.ny) / 1e6 - 3.0) < 0.1);
  assert.ok(
    Math.abs((withMeasurement.nx * withMeasurement.ny) / 1e6 - 8.3) < 0.5,
    'bo qua dung sai la chon camera thieu gan ba lan'
  );
});

test('không nhập dung sai đo thì kết quả y hệt trước khi có nhánh đo lường', () => {
  const base = { fovWidthMm: 100, fovHeightMm: 40, defectMinSizeMm: 0.2, pxPerDefect: 3 };
  const omitted = requiredPixels(base)!;
  const explicitNull = requiredPixels({ ...base, measurementToleranceMm: null })!;

  assert.equal(omitted.mmPerPxMeasurement, null);
  assert.equal(omitted.governing, 'detection');
  assert.equal(omitted.mmPerPxTarget, 0.2 / 3);
  assert.equal(omitted.nx, 1500);
  assert.equal(omitted.ny, 600);
  assert.deepEqual(explicitNull, omitted);

  const checks = resolutionChecks({ ...base, totalLengthMm: null, overlapRatio: 0.1 }, null);
  assert.ok(checks.some((c) => c.key === 'mmPerPxTarget'), 'giu nguyen cach trinh bay cu');
  assert.ok(!checks.some((c) => c.key === 'governingResolution'));
  assert.ok(!checks.some((c) => c.key === 'measurementBudget'));
});

test('dung sai lỏng thì nhánh phát hiện lỗi vẫn quyết định', () => {
  // ±1 mm → 0,6 mm/px, thô hơn nhiều so với 0,2 / 3 = 0,0667 mm/px.
  const input = {
    fovWidthMm: 100,
    fovHeightMm: 40,
    defectMinSizeMm: 0.2,
    pxPerDefect: 3,
    measurementToleranceMm: 1,
  };
  const need = requiredPixels(input)!;
  assert.equal(need.governing, 'detection');
  assert.ok(Math.abs(need.mmPerPxMeasurement! - 0.6) < 1e-12);
  assert.equal(need.nx, 1500, 'khong doi so pixel can');

  const checks = resolutionChecks({ ...input, totalLengthMm: null, overlapRatio: 0.1 }, null);
  const governing = checks.find((c) => c.key === 'governingResolution')!;
  assert.equal(governing.noteKey, 'governedByDetection');
});

test('camera thật được kiểm theo ngân sách đo, trên trục THÔ hơn', () => {
  const input = {
    fovWidthMm: 200,
    fovHeightMm: 150,
    defectMinSizeMm: 0.5,
    pxPerDefect: 5,
    measurementToleranceMm: 0.1,
    totalLengthMm: null,
    overlapRatio: 0.1,
  };

  /* 12 MP 4096 × 3000: ngang 200/4096 = 0,0488, dọc 150/3000 = 0,050 mm/px.
     docs/UI_CONTENT_V1.md ghi "0,0488 mm/px, dư 1,23×" — chỉ tính trục ngang.
     Kích thước cần đo có thể nằm theo trục dọc, nên trục thô hơn (0,050)
     quyết định: biên đúng là 0,06 / 0,05 = 1,2×. */
  const good = resolutionChecks(input, { widthPx: 4096, heightPx: 3000 });
  const pass = good.find((c) => c.key === 'measurementResolution')!;
  assert.equal(pass.status, 'pass');
  assert.ok(pass.formula.includes('biên 1.2×'), pass.formula);
  assert.ok(good.some((c) => c.key === 'detectionBudget'));
  assert.ok(good.some((c) => c.key === 'measurementBudget'));
  assert.equal(good.find((c) => c.key === 'governingResolution')!.noteKey, 'governedByMeasurement');
  assert.ok(!good.some((c) => c.key === 'mmPerPxTarget'), 'hai nhanh thay cho mot dong cu');

  // 5 MP 2592 × 1944: 0,0772 mm/px > 0,06 — thấy được lỗi 0,5 mm nhưng không đo nổi ±0,1.
  const coarse = resolutionChecks(input, { widthPx: 2592, heightPx: 1944 });
  const fail = coarse.find((c) => c.key === 'measurementResolution')!;
  assert.equal(fail.status, 'fail');
  assert.equal(fail.noteKey, 'measurementTooCoarse');
});

test('form đọc measurement_tolerance_mm, để trống thì null', () => {
  const withTolerance = appearanceInputFromForm({
    fov_width_mm: 380,
    defect_min_size_mm: 0.5,
    measurement_tolerance_mm: 0.1,
  })!;
  assert.equal(withTolerance.measurementToleranceMm, 0.1);

  const without = appearanceInputFromForm({ fov_width_mm: 380, defect_min_size_mm: 0.5 })!;
  assert.equal(without.measurementToleranceMm, null);
  assert.equal(DEFAULT_APPEARANCE_INPUT.measurementToleranceMm, null, 'mac dinh khong co yeu cau do');
});

// ------------------------------------------------ CHIA CAMERA & PHỐI CẢNH --
// V1b B2 — RES-005 (chia vùng nhìn) và OPT-008 (sai số phối cảnh), chốt 2026-09-16.

test('lưới camera gần vuông, đúng bằng số camera, chiều nhiều camera theo trục dài', () => {
  const grid = (cameraCount: number, fovWidthMm = 380, fovHeightMm = 280) =>
    cameraGrid({ cameraCount, fovWidthMm, fovHeightMm });

  assert.deepEqual(grid(1), { cols: 1, rows: 1 });
  assert.deepEqual(grid(2), { cols: 2, rows: 1 });
  assert.deepEqual(grid(3), { cols: 3, rows: 1 });
  assert.deepEqual(grid(4), { cols: 2, rows: 2 });
  assert.deepEqual(grid(6), { cols: 3, rows: 2 });
  assert.deepEqual(grid(5), { cols: 5, rows: 1 }, 'so nguyen to thanh mot hang dai');
  assert.deepEqual(grid(2, 100, 300), { cols: 1, rows: 2 }, 'vat dung thi xep theo truc doc');

  assert.equal(grid(0), null);
  assert.equal(grid(2.5), null);
  assert.equal(grid(2, 0, 280), null);
});

test('vùng nhìn một camera = ô lưới + chồng lấn max(10%, 20 px); trục một camera không chồng lấn', () => {
  // GT-001: 380 × 280, 4 camera, 0,06 mm/px → ô 190 × 140, chồng lấn 19 và 14 (10% thắng 1,2 mm).
  const gt001 = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 })!;
  assert.deepEqual(gt001.grid, { cols: 2, rows: 2 });
  assert.equal(gt001.widthMm, 209);
  assert.equal(gt001.heightMm, 154);
  assert.equal(gt001.halfDiagonalMm, 129.805);

  // Pixel thô: 20 px × 0,5 mm = 10 mm thắng 10% của ô 50 mm.
  const coarse = cameraTile({ fovWidthMm: 100, fovHeightMm: 40, cameraCount: 2, mmPerPx: 0.5 })!;
  assert.equal(coarse.overlapXMm, 10);
  assert.equal(coarse.widthMm, 60);
  assert.equal(coarse.overlapYMm, 0, 'mot hang thi khong co duong ghep doc');
  assert.equal(coarse.heightMm, 40);

  const single = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 1, mmPerPx: null })!;
  assert.equal(single.widthMm, 380);
  assert.equal(single.halfDiagonalMm, 236.008);
});

test('sai số phối cảnh = Δh ÷ WD × r — ví dụ spec §4.2 ra 0,83 mm', () => {
  assert.equal(round4(perspectiveErrorMm({ heightVariationMm: 2, workingDistanceMm: 300, offAxisMm: 125 })!), 0.8333);
  assert.equal(perspectiveErrorMm({ heightVariationMm: 0, workingDistanceMm: 300, offAxisMm: 125 }), 0);
  assert.equal(perspectiveErrorMm({ heightVariationMm: 2, workingDistanceMm: 0, offAxisMm: 125 }), null);
  assert.equal(perspectiveErrorMm({ heightVariationMm: -1, workingDistanceMm: 300, offAxisMm: 125 }), null);
});

test('GT-001: phối cảnh vượt ngân sách đo ~43 lần → FAIL, dùng CẢ dải Δh và r của MỘT camera', () => {
  const tile = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 });
  const budget = measurementBudget(0.1)!; // U = 0,02 mm
  const check = perspectiveCheck({
    heightVariationMm: 2,
    workingDistanceMm: 300,
    tile,
    uncertaintyBudgetMm: budget.uncertaintyBudgetMm,
    perspectiveFree: false,
  })!;

  assert.equal(check.key, 'perspectiveError');
  assert.equal(check.status, 'fail');
  assert.equal(check.noteKey, 'perspectiveExceedsBudget');
  assert.equal(check.noteValues!.error, 0.8654, 'ca dai 2 mm, khong chia doi; r = 129,8 mm cua mot camera');
  assert.equal(check.noteValues!.budget, 0.02);
  assert.ok(check.formula.includes('> U 0.02 mm'), check.formula);
});

test('phối cảnh: quá nửa ngân sách → WARN, dưới nửa → PASS', () => {
  const tile = cameraTile({ fovWidthMm: 200, fovHeightMm: 0.0001, cameraCount: 1, mmPerPx: null })!; // r ≈ 100 mm
  const run = (heightVariationMm: number) =>
    perspectiveCheck({ heightVariationMm, workingDistanceMm: 300, tile, uncertaintyBudgetMm: 0.02, perspectiveFree: false })!;

  assert.equal(ERROR_WARN_SHARE, 0.5);
  const eats = run(0.05); // 0,05 ÷ 300 × 100 = 0,0167 mm = 83% U
  assert.equal(eats.status, 'warn');
  assert.equal(eats.noteKey, 'perspectiveEatsBudget');
  assert.equal(eats.noteValues!.share, 83);

  const fine = run(0.01); // 0,0033 mm = 17% U
  assert.equal(fine.status, 'pass');
  assert.equal(fine.noteKey, undefined);
});

test('phối cảnh: khách yêu cầu đo không phối cảnh → WARN cần telecentric, không FAIL', () => {
  const tile = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 });
  const check = perspectiveCheck({ heightVariationMm: 2, workingDistanceMm: 300, tile, uncertaintyBudgetMm: 0.02, perspectiveFree: true })!;
  assert.equal(check.status, 'warn');
  assert.equal(check.noteKey, 'perspectiveNeedsTelecentric');
});

test('phối cảnh: không có dung sai đo hoặc thiếu Δh / WD / vùng nhìn → không có phép kiểm, không đoán', () => {
  const tile = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 });
  const base = { heightVariationMm: 2, workingDistanceMm: 300, tile, uncertaintyBudgetMm: 0.02, perspectiveFree: false };
  assert.equal(perspectiveCheck({ ...base, uncertaintyBudgetMm: null }), null);
  assert.equal(perspectiveCheck({ ...base, heightVariationMm: null }), null);
  assert.equal(perspectiveCheck({ ...base, workingDistanceMm: null }), null);
  assert.equal(perspectiveCheck({ ...base, tile: null }), null);
});

test('nhãn phép kiểm phối cảnh đủ ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    const vision = messages.selector.vision;
    assert.ok(vision.checks.perspectiveError, `${locale}: checks.perspectiveError`);
    for (const note of ['perspectiveExceedsBudget', 'perspectiveEatsBudget', 'perspectiveNeedsTelecentric']) {
      assert.ok(vision.notes[note]?.includes('{error}'), `${locale}: notes.${note}`);
    }
  }
});

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// ------------------------------------------------------------ GIÃN NỞ NHIỆT --
// V1b B3 — MEC-001, chốt 2026-09-16.

test('giãn nở nhiệt = α × L × ΔT — GT-001 nhôm 380 mm, ΔT 10 K ra 87 µm', () => {
  assert.equal(round4(thermalErrorUm({ alphaUmPerMK: 23, lengthMm: 380, deltaTK: 10 })!), 87.4);
  assert.equal(thermalErrorUm({ alphaUmPerMK: 23, lengthMm: 380, deltaTK: 0 }), 0);
  assert.equal(thermalErrorUm({ alphaUmPerMK: -1, lengthMm: 380, deltaTK: 10 }), null);
});

test('dao động nhiệt tối đa = U ÷ (α × L) — GT-001 chỉ được 2,29 K, tức ±1,14 K', () => {
  assert.equal(round4(maxDeltaTK({ uncertaintyBudgetMm: 0.02, alphaUmPerMK: 23, lengthMm: 380 })!), 2.2883);
  assert.equal(maxDeltaTK({ uncertaintyBudgetMm: 0.02, alphaUmPerMK: 0, lengthMm: 380 }), null, 'alpha 0 thi nhiet khong gioi han');
});

test('GT-001: giãn nở nhiệt vượt ngân sách đo ~4,4 lần → FAIL, kèm dao động nhiệt tối đa để làm việc với khách', () => {
  const check = thermalCheck({ alphaUmPerMK: 23, lengthMm: 380, deltaTK: 10, uncertaintyBudgetMm: 0.02 })!;
  assert.equal(check.key, 'thermalError');
  assert.equal(check.status, 'fail');
  assert.equal(check.noteKey, 'thermalExceedsBudget');
  assert.deepEqual(check.noteValues, {
    error: 0.0874,
    budget: 0.02,
    ratio: 4.4,
    share: 437,
    maxDeltaT: 2.29,
    halfDeltaT: 1.14,
  });
  assert.ok(check.formula.includes('= 87.4 µm > U 20 µm'), check.formula);
  assert.ok(check.formula.includes('dao động nhiệt tối đa 2.29 K'), check.formula);
});

test('giãn nở nhiệt: quá nửa ngân sách → WARN, dưới nửa → PASS (ngưỡng chung với phối cảnh)', () => {
  const run = (deltaTK: number) => thermalCheck({ alphaUmPerMK: 12, lengthMm: 100, deltaTK, uncertaintyBudgetMm: 0.02 })!;

  const eats = run(10); // thép, 100 mm, 10 K → 12 µm = 60% U
  assert.equal(eats.status, 'warn');
  assert.equal(eats.noteKey, 'thermalEatsBudget');
  assert.equal(eats.noteValues!.share, 60);

  const fine = run(2); // 2,4 µm = 12% U
  assert.equal(fine.status, 'pass');
  assert.equal(fine.noteKey, undefined);
});

test('giãn nở nhiệt: bài không có dung sai đo, hoặc thiếu α / L / ΔT → không kiểm, không đoán', () => {
  const base = { alphaUmPerMK: 23, lengthMm: 380, deltaTK: 10, uncertaintyBudgetMm: 0.02 };
  assert.equal(thermalCheck({ ...base, uncertaintyBudgetMm: null }), null);
  assert.equal(thermalCheck({ ...base, alphaUmPerMK: null }), null);
  assert.equal(thermalCheck({ ...base, lengthMm: null }), null);
  assert.equal(thermalCheck({ ...base, deltaTK: null }), null);
});

test('nhãn phép kiểm giãn nở nhiệt đủ ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const vision = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).selector.vision;
    assert.ok(vision.checks.thermalError, `${locale}: checks.thermalError`);
    for (const note of ['thermalExceedsBudget', 'thermalEatsBudget']) {
      assert.ok(vision.notes[note]?.includes('{maxDeltaT}') && vision.notes[note].includes('{halfDeltaT}'), `${locale}: notes.${note}`);
    }
  }
});

// ------------------------------------------------------- GHÉP ẢNH GIỮA CAMERA --
// V1b B4 — MEC-003, chốt 2026-09-16.

test('số đường ghép chiều dài đo vắt qua: theo trục nhiều camera, tối thiểu 1, không quá số camera − 1', () => {
  const gt001 = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 })!;
  assert.equal(seamsCrossed({ tile: gt001, spanLengthMm: 380 }), 1, '380 mm tren luoi 2x2, moi o 190 mm');

  const row3 = cameraTile({ fovWidthMm: 600, fovHeightMm: 100, cameraCount: 3, mmPerPx: 0.1 })!; // bước lưới 200 mm
  assert.equal(seamsCrossed({ tile: row3, spanLengthMm: 600 }), 2);
  assert.equal(seamsCrossed({ tile: row3, spanLengthMm: 150 }), 1, 'da xac nhan vat qua thi it nhat 1');
  assert.equal(seamsCrossed({ tile: row3, spanLengthMm: 5000 }), 2, 'khong qua so duong ghep co that');
  assert.equal(seamsCrossed({ tile: row3, spanLengthMm: null }), 1);

  const tall = cameraTile({ fovWidthMm: 100, fovHeightMm: 300, cameraCount: 2, mmPerPx: null })!;
  assert.equal(seamsCrossed({ tile: tall, spanLengthMm: 300 }), 1, 'vat dung: tinh theo truc doc');

  const single = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 1, mmPerPx: 0.06 })!;
  assert.equal(seamsCrossed({ tile: single, spanLengthMm: 380 }), 0);
});

test('GT-001: ghép ảnh 0,03 mm + nhiệt 0,087 mm = 0,117 mm, gấp ~5,9 lần U → FAIL', () => {
  const tile = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 });
  const thermal = thermalErrorUm({ alphaUmPerMK: 23, lengthMm: 380, deltaTK: 10 })! / 1000;
  const check = stitchCheck({
    tile,
    crossesCameraSeam: true,
    spanLengthMm: 380,
    mmPerPx: 0.06,
    thermalErrorMm: thermal,
    uncertaintyBudgetMm: 0.02,
  })!;

  assert.equal(K_STITCH, 0.5);
  assert.equal(check.key, 'stitchError');
  assert.equal(check.status, 'fail');
  assert.equal(check.noteKey, 'stitchExceedsBudget');
  assert.deepEqual(check.noteValues, {
    seams: 1,
    stitch: 0.03,
    thermal: 0.0874,
    total: 0.1174,
    budget: 0.02,
    ratio: 5.9,
    share: 587,
  });
  assert.ok(check.formula.includes('1 đường ghép × 0.5 × 0.06 mm/px = 0.03 mm + nhiệt 0.0874 mm = 0.1174 mm > U 0.02 mm'), check.formula);
});

test('ghép ảnh: quá nửa ngân sách → WARN, dưới nửa → PASS; không có nhiệt thì chỉ tính phần ghép', () => {
  const tile = cameraTile({ fovWidthMm: 200, fovHeightMm: 50, cameraCount: 2, mmPerPx: 0.02 }); // 1 đường ghép
  const run = (uncertaintyBudgetMm: number) =>
    stitchCheck({ tile, crossesCameraSeam: true, spanLengthMm: null, mmPerPx: 0.02, thermalErrorMm: null, uncertaintyBudgetMm })!;

  const eats = run(0.015); // 0,01 mm = 67% U
  assert.equal(eats.status, 'warn');
  assert.equal(eats.noteKey, 'stitchEatsBudget');
  assert.equal(eats.noteValues!.share, 67);
  assert.equal(eats.noteValues!.thermal, 0);
  assert.ok(!eats.formula.includes('nhiệt'), eats.formula);

  assert.equal(run(0.05).status, 'pass');
});

test('ghép ảnh: không vắt qua, một camera, chưa có số camera, không có dung sai đo → không kiểm', () => {
  const tile = cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 4, mmPerPx: 0.06 });
  const base = { tile, crossesCameraSeam: true, spanLengthMm: 380, mmPerPx: 0.06, thermalErrorMm: 0.0874, uncertaintyBudgetMm: 0.02 };
  assert.equal(stitchCheck({ ...base, crossesCameraSeam: false }), null);
  assert.equal(stitchCheck({ ...base, crossesCameraSeam: null }), null, 'tang Yeu cau da gia dinh truoc khi toi day');
  assert.equal(stitchCheck({ ...base, tile: null }), null, 'chua co so camera thi khong chia duoc luoi');
  assert.equal(
    stitchCheck({ ...base, tile: cameraTile({ fovWidthMm: 380, fovHeightMm: 280, cameraCount: 1, mmPerPx: 0.06 }) }),
    null
  );
  assert.equal(stitchCheck({ ...base, uncertaintyBudgetMm: null }), null);
  assert.equal(stitchCheck({ ...base, mmPerPx: null }), null);
});

test('nhãn phép kiểm ghép ảnh đủ ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const vision = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).selector.vision;
    assert.ok(vision.checks.stitchError, `${locale}: checks.stitchError`);
    for (const note of ['stitchExceedsBudget', 'stitchEatsBudget']) {
      for (const slot of ['{seams}', '{stitch}', '{thermal}', '{total}', '{budget}']) {
        assert.ok(vision.notes[note]?.includes(slot), `${locale}: notes.${note} ${slot}`);
      }
    }
  }
});
