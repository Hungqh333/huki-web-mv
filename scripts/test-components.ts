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
  pickTube,
  pickCameraCable,
  pickCameraPowerCable,
  pickInterfaceCard,
  pickLightController,
  pickSoftware,
  listPcOptions,
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

test('lọc camera theo CẢ HAI trục, không chỉ theo megapixel', () => {
  // FOV rat dai va hep: can 3000 px ngang nhung chi 300 px doc.
  const wide = part('camera', 'Test', 'WIDE', {
    resolution_mp: 5, resolution_w_px: 2592, resolution_h_px: 1944,
    sensor_format: '2/3', mount: 'C', interface: 'GigE', color: 'mono',
  });
  const tall = part('camera', 'Test', 'BIG', {
    resolution_mp: 20, resolution_w_px: 5472, resolution_h_px: 3648,
    sensor_format: '1', mount: 'C', interface: 'GigE', color: 'mono',
  });

  const result = pickCamera([wide, tall], {
    requiredMp: 1,
    dataRateMbytesS: null,
    needsColor: false,
    requiredWidthPx: 3000,
    requiredHeightPx: 300,
  });

  assert.equal(result.chosen?.model, 'BIG', '2592 px ngang khong du 3000 du thua megapixel');
  assert.equal(result.alternatives.length, 0, 'camera thieu pixel truc ngang phai bi loai han');
});

// ------------------------------------------- CÁC CỤM CÒN LẠI CỦA DANH MỤC --

const TUBE_5 = part('tube', 'Generic', 'T5', { length_mm: 5, mount: 'C' });
const TUBE_10 = part('tube', 'Generic', 'T10', { length_mm: 10, mount: 'C' });
const TUBE_20 = part('tube', 'Generic', 'T20', { length_mm: 20, mount: 'C' });

test('không cần tube khi khoảng cách làm việc nằm trong tầm của ống kính', () => {
  const lens = part('lens', 'Coolens', 'FF2520', {
    lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C', wd_min_mm: 150,
  });

  const result = pickTube([TUBE_5, TUBE_10, TUBE_20], {
    lens,
    workingDistanceMm: 300, // xa hon 150 -> khong can
    magnification: 0.088,
  });

  assert.equal(result.fit.needed, false);
  assert.equal(result.chosen, null, 'khong can thi khong duoc ban kem');
});

test('cần tube khi cơ khí ép camera vào gần hơn ống kính cho phép', () => {
  const lens = part('lens', 'Coolens', 'FF2520', {
    lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C', wd_min_mm: 150,
  });

  const result = pickTube([TUBE_5, TUBE_10, TUBE_20], {
    lens,
    workingDistanceMm: 100, // gan hon 150 -> phai co tube
    magnification: 0.4, // 0,4 x 25 mm = 10 mm
  });

  assert.equal(result.fit.needed, true);
  assert.equal(result.fit.requiredLengthMm, 10);
  assert.equal(result.chosen?.model, 'T10', 'chon tube gan 10 mm nhat');
});

test('cáp camera phải khớp chuẩn giao tiếp, không gán bừa', () => {
  /* File BOM that tach rieng cap DATA va cap NGUON camera — gop lai thi bao gia
     thieu mot dong, nen day la ba loai khac nhau. */
  const cables = [
    part('cable', 'Generic', 'CAT6-5M', { cable_for: 'camera_data', connector: 'RJ45 Cat6', length_m: 5 }),
    part('cable', 'Generic', 'USB3-3M', { cable_for: 'camera_data', connector: 'USB3 Micro-B', length_m: 3 }),
    part('cable', 'Generic', 'POWER-10M', { cable_for: 'camera_power', connector: 'Hirose 6 chân', length_m: 10 }),
    part('cable', 'Generic', 'LIGHT-2M', { cable_for: 'light', connector: 'Hirose 4 chân', length_m: 2 }),
  ];

  assert.equal(pickCameraCable(cables, { interfaceName: 'GigE' }).chosen?.model, 'CAT6-5M');
  assert.equal(pickCameraCable(cables, { interfaceName: 'USB3' }).chosen?.model, 'USB3-3M');

  // Cap den khong duoc lot vao danh sach cap camera.
  const gige = pickCameraCable(cables, { interfaceName: 'GigE' });
  assert.ok(
    ![gige.chosen, ...gige.alternatives].some((c) => c?.model === 'LIGHT-2M'),
    'cap den khong phai cap camera'
  );

  // Cap NGUON cung khong duoc lot vao danh sach cap data.
  assert.ok(
    ![gige.chosen, ...gige.alternatives].some((c) => c?.model === 'POWER-10M'),
    'cap nguon khong phai cap data'
  );

  // Chuan la khong suy duoc thi liet ke chu khong gan bua.
  const unknown = pickCameraCable(cables, { interfaceName: 'CXP-6' });
  assert.equal(unknown.chosen, null, 'khong co cap coax thi khong duoc gan cap RJ45');

  // Cap nguon lay rieng, va chi lay dung loai do.
  const power = pickCameraPowerCable(cables);
  assert.equal(power.chosen?.model, 'POWER-10M');
  assert.equal(power.alternatives.length, 0, 'chi co mot cap nguon trong danh sach');
});

test('card giao tiếp phải đủ cổng cho số camera, không bán dư', () => {
  const cards = [
    part('interface_card', 'Onboard', '1CH', { interface: 'GigE', channels: 1 }),
    part('interface_card', 'ADLINK', '4CH', { interface: 'GigE', channels: 4 }),
    part('interface_card', 'iRayple', '4CH-5G', { interface: '5GigE', channels: 4 }),
  ];

  // Mot camera GigE -> dung cong san tren main, dung mua card 4 cong.
  assert.equal(
    pickInterfaceCard(cards, { interfaceName: 'GigE', cameraCount: 1 }).chosen?.model,
    '1CH'
  );

  // Hai camera -> cong onboard khong du, phai len card 4 cong.
  const two = pickInterfaceCard(cards, { interfaceName: 'GigE', cameraCount: 2 });
  assert.equal(two.chosen?.model, '4CH');
  assert.ok(
    ![two.chosen, ...two.alternatives].some((c) => c?.model === '1CH'),
    'card thieu cong phai bi loai han'
  );

  // Chuan giao tiep phai khop: camera 5GigE khong cam vao card GigE duoc.
  assert.equal(
    pickInterfaceCard(cards, { interfaceName: '5GigE', cameraCount: 2 }).chosen?.model,
    '4CH-5G'
  );
});

test('bộ điều khiển đèn phải có đánh xung khi phơi sáng dưới 1 ms', () => {
  const ctrls = [
    part('light_controller', 'HZ', '1CH', { channels: 1, strobe: 'no', max_current_a: 2 }),
    part('light_controller', 'HZ', '2CH-ST', { channels: 2, strobe: 'yes', max_current_a: 4 }),
    part('light_controller', 'HZ', '4CH-ST', { channels: 4, strobe: 'yes', max_current_a: 8 }),
  ];

  // Bang tai cham: khong can danh xung -> bo re nhat du kenh thang.
  const slow = pickLightController(ctrls, { lightCount: 1, needsStrobe: false });
  assert.equal(slow.chosen?.model, '1CH');

  // Nhoe chuyen dong ep phoi sang xuong duoi 1 ms -> bat buoc strobe.
  const fast = pickLightController(ctrls, { lightCount: 1, needsStrobe: true });
  assert.equal(fast.chosen?.model, '2CH-ST');
  assert.ok(
    ![fast.chosen, ...fast.alternatives].some((c) => c?.spec.strobe === 'no'),
    'bo khong danh xung phai bi loai han'
  );

  // Photometric stereo bon huong -> can bon kenh.
  const four = pickLightController(ctrls, { lightCount: 4, needsStrobe: false });
  assert.equal(four.chosen?.model, '4CH-ST', 'chi bo 4 kenh moi du');
});

test('bài cần deep learning thì không mặc định vào thư viện miễn phí', () => {
  const sw = [
    part('software', 'Open source', 'OpenCV', { software_type: 'free' }),
    part('software', 'MVTec', 'HALCON', { software_type: 'library' }),
  ];

  assert.equal(pickSoftware(sw, { needsDeepLearning: false }).chosen?.model, 'OpenCV');
  assert.equal(
    pickSoftware(sw, { needsDeepLearning: true }).chosen?.model,
    'HALCON',
    'ra hien truong khong ai ho tro thu vien mien phi'
  );
});

test('hàng đi kèm máy tính liệt kê đủ để người dùng tự tích', () => {
  const opts = [
    part('pc_option', 'Microsoft', 'Win11', { option_type: 'os' }),
    part('pc_option', 'Microsoft', 'Office', { option_type: 'office' }),
    part('pc_option', 'Generic', 'Man hinh', { option_type: 'monitor' }),
    part('pc_option', 'Generic', 'Ban phim', { option_type: 'keyboard' }),
    part('camera', 'X', 'khong-phai-pc-option', { resolution_mp: 5 }),
  ];

  const listed = listPcOptions(opts);
  assert.equal(listed.length, 4, 'chi lay dung pc_option');
  assert.deepEqual(
    listed.map((c) => c.spec.option_type),
    ['os', 'office', 'monitor', 'keyboard']
  );
});
