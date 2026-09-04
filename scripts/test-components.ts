/**
 * Test cho phần chọn linh kiện cụ thể từ catalog.
 *
 * Trọng tâm là các quy tắc dễ sai mà không ai nhận ra: chọn dư megapixel, ghép
 * lens có vòng ảnh nhỏ hơn cảm biến, và bán máy có GPU cho bài không cần.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeFocalLength,
  inferLightType,
  pickCamera,
  pickController,
  pickLens,
  pickLight,
} from '../src/lib/components/match';
import type { Component, ComponentKind } from '../src/lib/components/specs';

let counter = 0;
function part(
  kind: ComponentKind,
  brand: string,
  model: string,
  spec: Record<string, unknown>,
  sortOrder = ++counter
): Component {
  return {
    id: `${model}-id`,
    code: model,
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
  };
}

const CAM_3MP_GIGE = part('camera', 'iRayple', 'A5031MG14', {
  resolution_mp: 3.1, sensor_format: '1/1.8', mount: 'C', interface: 'GigE', color: 'mono',
});
const CAM_5MP_GIGE = part('camera', 'Hikrobot', 'MV-CS050-10GM', {
  resolution_mp: 5, sensor_format: '2/3', mount: 'C', interface: 'GigE', color: 'mono',
});
const CAM_5MP_COLOR = part('camera', 'Basler', 'acA2440-35uc', {
  resolution_mp: 5, sensor_format: '2/3', mount: 'C', interface: 'USB3', color: 'color',
});
const CAM_20MP_GIGE = part('camera', 'Hikrobot', 'MV-CS200-10GC', {
  resolution_mp: 20, sensor_format: '1', mount: 'C', interface: 'GigE', color: 'color',
});
const CAM_16MP_5GIGE = part('camera', 'Basler', 'a2A5320-23gm', {
  resolution_mp: 16, sensor_format: '1', mount: 'C', interface: '5GigE', color: 'mono',
});

const CAMERAS = [CAM_3MP_GIGE, CAM_5MP_GIGE, CAM_5MP_COLOR, CAM_20MP_GIGE, CAM_16MP_5GIGE];

// ----------------------------------------------------------------- CAMERA --

test('chọn camera đủ độ phân giải THẤP NHẤT, không chọn dư', () => {
  const result = pickCamera(CAMERAS, {
    requiredMp: 4,
    dataRateMbytesS: null,
    needsColor: false,
  });

  assert.equal(result.chosen?.model, 'MV-CS050-10GM', '5 MP la muc thap nhat con >= 4');
  assert.ok(
    !result.alternatives.some((c) => c.model === 'A5031MG14'),
    '3,1 MP khong du nen phai bi loai han'
  );
});

test('cùng megapixel thì ưu tiên đơn sắc khi không cần màu', () => {
  const result = pickCamera([CAM_5MP_COLOR, CAM_5MP_GIGE], {
    requiredMp: 5,
    dataRateMbytesS: null,
    needsColor: false,
  });

  assert.equal(result.chosen?.model, 'MV-CS050-10GM', 'mono thang khi khong can mau');
});

test('cần phân biệt màu thì loại hẳn camera đơn sắc', () => {
  const result = pickCamera(CAMERAS, {
    requiredMp: 4,
    dataRateMbytesS: null,
    needsColor: true,
  });

  assert.equal(specColor(result.chosen), 'color');
  assert.ok(
    result.alternatives.every((c) => c.spec.color === 'color'),
    'khong con camera don sac nao trong danh sach'
  );
});

test('giao tiếp không tải nổi băng thông thì camera bị loại', () => {
  // 300 MB/s: GigE (~110 MB/s thuc dung) khong the tai noi.
  const result = pickCamera(CAMERAS, {
    requiredMp: 10,
    dataRateMbytesS: 300,
    needsColor: false,
  });

  assert.equal(result.chosen?.model, 'a2A5320-23gm', '5GigE moi tai noi');
  assert.ok(
    !result.alternatives.some((c) => c.spec.interface === 'GigE'),
    'moi camera GigE deu phai bi loai'
  );
});

function specColor(component: Component | null): unknown {
  return component?.spec.color;
}

// ------------------------------------------------------------------- LENS --

test('tiêu cự tính đúng theo công thức thấu kính mỏng', () => {
  // Cam bien 8,8 mm, khoang cach 300 mm, FOV 100 mm -> 26,4 mm
  assert.equal(computeFocalLength(8.8, 300, 100), 26.4);
  assert.equal(computeFocalLength(0, 300, 100), null, 'thieu du lieu thi tra null');
});

const LENS_8 = part('lens', 'Coolens', 'FF0820', { lens_type: 'fixed', focal_length_mm: 8, image_circle: '2/3', mount: 'C' });
const LENS_25 = part('lens', 'Coolens', 'FF2520', { lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C' });
const LENS_50_BIG = part('lens', 'Coolens', 'FF5020', { lens_type: 'fixed', focal_length_mm: 50, image_circle: '1', mount: 'C' });
const LENS_TC05 = part('lens', 'Coolens', 'TC05', { lens_type: 'telecentric', magnification: 0.5, image_circle: '2/3', mount: 'C' });
const LENSES = [LENS_8, LENS_25, LENS_50_BIG, LENS_TC05];

test('chọn ống kính có tiêu cự gần nhất với tiêu cự cần', () => {
  const result = pickLens(LENSES, {
    camera: CAM_5MP_GIGE, // cam bien 2/3" = 8,8 mm
    fovWidthMm: 100,
    workingDistanceMm: 300,
    needTelecentric: false,
  });

  assert.equal(result.fit.targetFocalMm, 26.4);
  assert.equal(result.chosen?.model, 'FF2520', '25 mm gan 26,4 nhat');
});

test('vòng ảnh nhỏ hơn cảm biến thì loại — nếu không sẽ tối bốn góc', () => {
  const result = pickLens([LENS_25, LENS_50_BIG], {
    camera: CAM_20MP_GIGE, // cam bien 1 inch
    fovWidthMm: 100,
    workingDistanceMm: 400,
    needTelecentric: false,
  });

  assert.equal(result.chosen?.model, 'FF5020', 'chi lens phu duoc 1 inch moi dung duoc');
  assert.equal(result.alternatives.length, 0, 'lens 2/3 inch phai bi loai han');
});

test('cần telecentric thì chọn theo độ phóng đại, không theo tiêu cự', () => {
  const result = pickLens(LENSES, {
    camera: CAM_5MP_GIGE, // 8,8 mm
    fovWidthMm: 17.6, // -> can 0,5x
    workingDistanceMm: 110,
    needTelecentric: true,
  });

  assert.equal(result.fit.targetMagnification, 0.5);
  assert.equal(result.chosen?.model, 'TC05');
});

// ------------------------------------------------------------------ LIGHT --

test('suy kiểu đèn từ câu mô tả trong bảng luật', () => {
  assert.equal(inferLightType('Đèn dome khuếch tán toàn phần'), 'dome');
  assert.equal(inferLightType('Đèn nền chuẩn trực'), 'backlight');
  assert.equal(inferLightType('Chiếu sáng đồng trục'), 'coaxial');
  assert.equal(inferLightType('Đèn dark field góc thấp'), 'darkfield');
  assert.equal(
    inferLightType('Đèn vòng khuếch tán góc thấp'),
    'darkfield',
    '"goc thap" phai thang "vong" — day la den truong toi'
  );
  assert.equal(inferLightType('Đèn vòng khuếch tán'), 'ring');
  assert.equal(inferLightType('mô tả không rõ ràng'), null);
});

test('không suy được kiểu đèn thì không chọn bừa', () => {
  const lights = [
    part('light', 'HZ', 'HZ-DM150-W', { light_type: 'dome', color: 'white' }),
    part('light', 'HZ', 'HZ-RL9070-W', { light_type: 'ring', color: 'white' }),
  ];

  const unclear = pickLight(lights, { lightingText: 'chiếu sáng phù hợp' });
  assert.equal(unclear.chosen, null, 'khong doan bua');
  assert.equal(unclear.alternatives.length, 2, 'nhung van liet ke de nguoi dung tu chon');

  const clear = pickLight(lights, { lightingText: 'Đèn dome' });
  assert.equal(clear.chosen?.model, 'HZ-DM150-W');
});

// ------------------------------------------------------------- CONTROLLER --

const PC_BASIC = part('controller', 'Generic', 'IPC-i5', { interfaces: ['GigE', 'USB3'], ram_gb: 16 });
const PC_GPU = part('controller', 'Generic', 'IPC-RTX', { interfaces: ['GigE', '5GigE'], gpu: 'RTX 8GB' });
const PCS = [PC_BASIC, PC_GPU];

test('không cần deep learning thì không bán máy có GPU', () => {
  const result = pickController(PCS, {
    interfaceName: 'GigE',
    dataRateMbytesS: 50,
    needsGpu: false,
  });

  assert.equal(result.chosen?.model, 'IPC-i5');
});

test('cần deep learning thì bắt buộc máy có GPU', () => {
  const result = pickController(PCS, {
    interfaceName: 'GigE',
    dataRateMbytesS: 50,
    needsGpu: true,
  });

  assert.equal(result.chosen?.model, 'IPC-RTX');
  assert.equal(result.alternatives.length, 0, 'may khong GPU phai bi loai han');
});

test('máy không có giao tiếp cần thiết thì bị loại', () => {
  const result = pickController(PCS, {
    interfaceName: '5GigE',
    dataRateMbytesS: 400,
    needsGpu: false,
  });

  assert.equal(result.chosen?.model, 'IPC-RTX', 'chi may nay co 5GigE');
});
