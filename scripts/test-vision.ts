/**
 * Test cho bộ tính toán bài Kiểm tra ngoại quan.
 *
 * Mỗi lỗi nguyên tắc đã sửa đều có một test canh, để nó không lặng lẽ quay lại:
 * tính hai trục riêng, kiểm ngược lại với camera thật, ngân sách thời gian thay
 * cho nhịp ảnh, nhoè chuyển động, và byte/px theo định dạng ảnh.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  airyDiskUm,
  analyseAppearance,
  cameraCount,
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
  suggestLighting,
  verifyResolution,
  worstStatus,
  DEFAULT_APPEARANCE_INPUT,
  type AppearanceInput,
  type CameraLike,
} from '../src/lib/vision';

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
