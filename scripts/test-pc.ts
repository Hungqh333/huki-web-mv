/**
 * Test cho module máy tính.
 *
 * Trọng tâm là con số trước đây bị đóng cứng bằng 1: SỐ MÁY. Đúng với hai ba
 * camera, sai khi dự án lớn — và sai theo kiểu chỉ lộ ra lúc lắp đủ camera,
 * không lộ lúc chạy thử một cái.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cardUnits,
  camerasPerPc,
  maxCamerasByBandwidth,
  pcBandwidthBudget,
  pickCard,
  pickPc,
  planPc,
  planPcForLines,
  type VisionLine,
} from '../src/lib/components/pc';
import type { Component, ComponentKind } from '../src/lib/components/specs';

let counter = 0;
function part(
  kind: ComponentKind,
  model: string,
  spec: Record<string, unknown>,
  sortOrder = ++counter
): Component {
  return {
    id: `${model}-id`,
    code: model,
    kind,
    brand: 'Generic',
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

const PC_SMALL = part('controller', 'IPC-i5', {
  interfaces: ['GigE', 'USB3'],
  max_cameras: 2,
  pcie_slots: 1,
});
const PC_BIG = part('controller', 'IPC-i7', {
  interfaces: ['GigE', 'USB3', '5GigE'],
  max_cameras: 4,
  pcie_slots: 2,
});
const PC_GPU = part('controller', 'IPC-RTX', {
  interfaces: ['GigE', '5GigE'],
  gpu: 'RTX 8GB',
  max_cameras: 4,
});

const CARD_1 = part('interface_card', 'ONBOARD', { interface: 'GigE', channels: 1 });
const CARD_4 = part('interface_card', 'GIE74V', { interface: 'GigE', channels: 4 });
const CARD_5G = part('interface_card', '5G-2CH', { interface: '5GigE', channels: 2 });

const CATALOG = [PC_SMALL, PC_BIG, PC_GPU, CARD_1, CARD_4, CARD_5G];

// ------------------------------------------------------------------- CHỌN --

test('khong can deep learning thi khong ban may co GPU', () => {
  const plain = pickPc(CATALOG, { interfaceName: 'GigE', needsGpu: false });
  assert.equal(plain.chosen?.spec.gpu, undefined, 'may khong GPU phai thang');

  const dl = pickPc(CATALOG, { interfaceName: 'GigE', needsGpu: true });
  assert.equal(dl.chosen?.model, 'IPC-RTX');
  assert.ok(
    [dl.chosen, ...dl.alternatives].every((pc) => pc?.spec.gpu),
    'may khong GPU phai bi loai han khi bai can deep learning'
  );
});

test('may khong co chuan giao tiep cua camera thi bi loai', () => {
  const fast = pickPc(CATALOG, { interfaceName: '5GigE', needsGpu: false });
  assert.ok(
    ![fast.chosen, ...fast.alternatives].some((pc) => pc?.model === 'IPC-i5'),
    'IPC-i5 khong co 5GigE'
  );
});

test('card giao tiep phai dung chuan va du cong', () => {
  assert.equal(
    pickCard(CATALOG, { interfaceName: 'GigE', cameraCount: 1 }).chosen?.model,
    'ONBOARD',
    'mot camera thi dung cong san, dung ban card 4 cong'
  );
  assert.equal(
    pickCard(CATALOG, { interfaceName: 'GigE', cameraCount: 2 }).chosen?.model,
    'GIE74V',
    'hai camera qua mot cong la chia nhau bang thong'
  );
  assert.equal(pickCard(CATALOG, { interfaceName: '5GigE', cameraCount: 2 }).chosen?.model, '5G-2CH');
});

test('nhieu camera hon so cong cua card lon nhat thi dat NHIEU CARD', () => {
  const many = pickCard(CATALOG, { interfaceName: 'GigE', cameraCount: 10 });
  assert.equal(many.chosen?.model, 'GIE74V', 'chon card nhieu cong nhat de it card nhat');
  assert.equal(cardUnits(many.chosen, 10), 3, 'ceil(10 / 4) = 3 card');
  assert.ok(many.chosen !== null, 'khong duoc de trong khi so camera vuot mot card');

  assert.equal(cardUnits(CARD_4, 8), 2, 'chia het thi khong lam tron len');
  assert.equal(cardUnits(null, 4), 0);
});

test('moi may phai co card cua rieng no — card khong cam chung hai may', () => {
  // Ba camera, hai may, card 4 cong: "du cong" tren giay nhung van phai hai card.
  assert.equal(cardUnits(CARD_4, 3, 2), 2, 'chia 2+1 camera thi moi may mot card');
  assert.equal(cardUnits(CARD_4, 8, 2), 2, 'moi may 4 camera, moi may mot card 4 cong');
  assert.equal(cardUnits(CARD_1, 2, 2), 2, 'moi may mot camera, moi may mot cong');
  assert.equal(cardUnits(CARD_4, 3, 1), 1, 'mot may thi mot card');

  const plan = planPc(CATALOG, {
    cameraCount: 3,
    interfaceName: 'GigE',
    dataRateMbytesS: 20,
    needsGpu: false,
  }, { pc: PC_SMALL, card: CARD_4 });
  assert.equal(plan.pcCount, 2, 'may ganh 2 camera thi 3 camera can 2 may');
  assert.equal(plan.cardCount, 2, 'so card khong duoc it hon so may');
  assert.ok(plan.cardCount >= plan.pcCount, 'moi may luon phai co it nhat mot card');
});

// ------------------------------------------------------------- SỐ MÁY TÍNH --

test('so camera moi may lay theo max_cameras khai trong catalog', () => {
  assert.equal(camerasPerPc(PC_SMALL, 4), 2, 'max_cameras thang so khe PCIe');
  assert.equal(camerasPerPc(PC_BIG, 4), 4);
});

test('khong khai max_cameras thi suy tu so khe PCIe nhan so cong moi card', () => {
  const pc = part('controller', 'IPC-slots', { interfaces: ['GigE'], pcie_slots: 3 });
  assert.equal(camerasPerPc(pc, 4), 12, '3 khe x 4 cong');

  // Khong khai gi ca -> mot con so quen thuoc, khong phai vo han.
  const bare = part('controller', 'IPC-bare', { interfaces: ['GigE'] });
  assert.equal(camerasPerPc(bare, 4), 4);
  assert.equal(camerasPerPc(null, 4), 4);
});

test('bang thong tong vuot suc mot may thi phai tach may', () => {
  // GigE thuc dung ~110 MB/s, tran than trong = 4 lan = 440 MB/s.
  assert.equal(maxCamerasByBandwidth('GigE', 100), 4, 'floor(440 / 100)');
  assert.equal(maxCamerasByBandwidth('GigE', 500), 1, 'mot camera da vuot mot cong');
  assert.equal(maxCamerasByBandwidth(null, 100), null, 'thieu du lieu thi khong ket luan');
  assert.equal(maxCamerasByBandwidth('GigE', null), null);
});

test('SO MAY khong con dong cung bang 1', () => {
  // Sau camera GigE nhe. IPC-i5 ganh 2 (-> 3 may), IPC-i7 ganh 4 (-> 2 may):
  // phai chon may to hon, vi ba may nho vua dat hon vua them cho phai bao tri.
  const big = planPc(CATALOG, {
    cameraCount: 6,
    interfaceName: 'GigE',
    dataRateMbytesS: 20,
    needsGpu: false,
  });
  assert.equal(big.pc.chosen?.model, 'IPC-i7', 'it may nhat thang, khong phai may dau danh sach');
  assert.equal(big.pcCount, 2, 'ceil(6 / 4) = 2 may');
  assert.equal(big.splitReason, 'slots');

  // Ba camera, moi cai 200 MB/s: tran bang thong la floor(440/200) = 2.
  const heavy = planPc(CATALOG, {
    cameraCount: 3,
    interfaceName: 'GigE',
    dataRateMbytesS: 200,
    needsGpu: false,
  });
  assert.equal(heavy.camerasPerPc, 2, 'bang thong siet chat hon so khe');
  assert.equal(heavy.pcCount, 2);
  assert.equal(heavy.splitReason, 'bandwidth', 'phai noi ro vi sao tach, bang thong hay khe cam');
});

test('mot may du thi khong bia them may thu hai', () => {
  const small = planPc(CATALOG, {
    cameraCount: 2,
    interfaceName: 'GigE',
    dataRateMbytesS: 20,
    needsGpu: false,
  });
  assert.equal(small.pcCount, 1);
  assert.equal(small.splitReason, null);
  assert.equal(small.cardCount, 1);
});

test('doi may tay thi so may tinh lai theo may NGUOI DUNG chon', () => {
  const req = {
    cameraCount: 4,
    interfaceName: 'GigE' as const,
    dataRateMbytesS: 20,
    needsGpu: false,
  };

  // De may tu chon: IPC-i7 ganh du 4 camera -> mot may.
  const auto = planPc(CATALOG, req);
  assert.equal(auto.pc.chosen?.model, 'IPC-i7');
  assert.equal(auto.pcCount, 1);

  // Nguoi dung doi tay sang may nho hon -> so may phai tang theo, khong duoc
  // giu nguyen con so cua may ma HE THONG de xuat.
  const manual = planPc(CATALOG, req, { pc: PC_SMALL, card: CARD_4 });
  assert.equal(manual.pcCount, 2, 'may chi ganh 2 camera thi 4 camera can 2 may');
  assert.equal(manual.splitReason, 'slots');
});

// ============================================================ NHIỀU BÀI TOÁN --
// Ly do module nay phai tach thanh trang rieng: mot du an that hay co ba bai
// toan chay tren CUNG mot may. Moi bai tu sinh dong may tinh cua no thi bao
// gia ra ba may, trong khi thuc te chi mua mot.

const line = (over: Partial<VisionLine> = {}): VisionLine => ({
  id: `L${++counter}`,
  label: '',
  cameraCount: 1,
  interfaceName: 'GigE',
  dataRateMbytesS: 20,
  needsGpu: false,
  ...over,
});

test('ba bai toan dung chung mot may thi van chi la MOT may', () => {
  const plan = planPcForLines(CATALOG, [
    line({ label: 'Can chinh', cameraCount: 1 }),
    line({ label: 'Do luong', cameraCount: 1 }),
    line({ label: 'Ngoai quan', cameraCount: 2 }),
  ]);

  assert.equal(plan.totalCameras, 4, 'cong don camera cua ca ba bai');
  assert.equal(plan.pc.chosen?.model, 'IPC-i7', 'may ganh 4 camera');
  assert.equal(plan.pcCount, 1, 'ba bai toan KHONG duoc ra ba may');
  assert.equal(plan.splitReason, null);
});

test('may phai do duoc MOI chuan giao tiep co mat, khong phai chi mot', () => {
  const plan = planPcForLines(CATALOG, [
    line({ cameraCount: 2, interfaceName: 'GigE' }),
    line({ cameraCount: 1, interfaceName: '5GigE' }),
  ]);

  assert.deepEqual(plan.interfaces.sort(), ['5GigE', 'GigE']);
  // IPC-i5 chi co GigE va USB3 -> phai bi loai han.
  assert.ok(
    ![plan.pc.chosen, ...plan.pc.alternatives].some((pc) => pc?.model === 'IPC-i5'),
    'may thieu 5GigE khong the chay bai 5GigE'
  );
  assert.equal(plan.pc.chosen?.model, 'IPC-i7');
});

test('moi chuan giao tiep mot dong card rieng, camera cong don theo chuan', () => {
  const plan = planPcForLines(CATALOG, [
    line({ cameraCount: 2, interfaceName: 'GigE' }),
    line({ cameraCount: 1, interfaceName: 'GigE' }),
    line({ cameraCount: 2, interfaceName: '5GigE' }),
  ]);

  assert.equal(plan.cards.length, 2, 'hai chuan -> hai dong card');

  const gige = plan.cards.find((card) => card.interfaceName === 'GigE');
  assert.equal(gige?.cameraCount, 3, 'hai bai cung GigE thi cong don vao MOT dong card');
  assert.equal(gige?.choice.chosen?.model, 'GIE74V');
  // Nam camera vuot suc mot may (IPC-i7 ganh 4) -> hai may, nen GigE la chuan
  // chinh phai co card o ca hai may.
  assert.equal(plan.pcCount, 2);
  assert.equal(gige?.count, 2);

  const fast = plan.cards.find((card) => card.interfaceName === '5GigE');
  assert.equal(fast?.cameraCount, 2);
  assert.equal(fast?.choice.chosen?.model, '5G-2CH');
});

test('mot bai can GPU thi ca may phai co GPU', () => {
  const plan = planPcForLines(CATALOG, [
    line({ cameraCount: 1, needsGpu: false }),
    line({ cameraCount: 1, needsGpu: true }),
  ]);

  assert.equal(plan.needsGpu, true, 'mot bai deep learning la du de ca may can GPU');
  assert.equal(plan.pc.chosen?.model, 'IPC-RTX');
});

test('tong bang thong vuot suc mot may thi tach may, khong am tham cho qua', () => {
  // Tran GigE = 110 x 4 = 440 MB/s. Bon camera x 200 = 800 MB/s.
  const plan = planPcForLines(CATALOG, [line({ cameraCount: 4, dataRateMbytesS: 200 })]);

  assert.equal(plan.totalRateMbytesS, 800);
  assert.equal(plan.splitReason, 'bandwidth');
  assert.ok(plan.pcCount >= 2, 'phai tach may');
});

test('so card khong bao gio it hon so may — ke ca TRONG TUNG DONG', () => {
  // Nam camera GigE, may IPC-i5 ganh 2 -> 3 may. Card 4 cong "du cong" tren
  // giay nhung card cam vao MOT may, khong chia duoc.
  const plan = planPcForLines(CATALOG, [line({ cameraCount: 5 })], {
    pc: PC_SMALL,
    cards: { GigE: CARD_4 },
  });

  assert.equal(plan.pcCount, 3, 'ceil(5 / 2)');
  assert.ok(plan.cardTotal >= plan.pcCount, `moi may phai co card rieng: ${plan.cardTotal}`);
  // Loi da tung mac: sua o TONG ma quen sua o dong, nen bang hien "1 card /
  // 2 may". Con so nguoi dung doc la con so o dong, khong phai o tong.
  assert.equal(plan.cards[0].count, 3, 'dong card phai tu no da du, khong chi rieng tong');
});

test('bon camera hai may thi dong card phai la 2, khong phai 1', () => {
  // Dung tinh huong bat duoc loi: ba bai toan cong lai 4 camera, IPC-i5 ganh
  // 2 nen phai 2 may. Card 4 cong "du cong" cho ca 4 camera, nhung hai may.
  const plan = planPcForLines(
    CATALOG,
    [line({ cameraCount: 1 }), line({ cameraCount: 1 }), line({ cameraCount: 2 })],
    { pc: PC_SMALL, cards: { GigE: CARD_4 } }
  );

  assert.equal(plan.pcCount, 2);
  assert.equal(plan.cards[0].count, 2);
});

test('chuan phu gom ve mot may thi khong nhan theo so may', () => {
  // GigE la chuan chinh (4 cam) nen trai ra khap may; 5GigE chi 1 cam nen gom
  // ve mot may — dung ban 2 card 5GigE cho mot camera.
  const plan = planPcForLines(
    CATALOG,
    [line({ cameraCount: 4, interfaceName: 'GigE' }), line({ cameraCount: 1, interfaceName: '5GigE' })],
    { pc: PC_SMALL, cards: { GigE: CARD_4, '5GigE': CARD_5G } }
  );

  const gige = plan.cards.find((card) => card.interfaceName === 'GigE');
  const fast = plan.cards.find((card) => card.interfaceName === '5GigE');
  assert.ok(plan.pcCount >= 2);
  assert.equal(gige?.count, plan.pcCount, 'chuan chinh trai ra khap may');
  assert.equal(fast?.count, 1, 'chuan phu mot camera thi mot card la du');
});

test('bang thong khai rieng trong catalog thang quy uoc suy ra', () => {
  const declared = part('controller', 'IPC-declared', {
    interfaces: ['GigE'],
    max_cameras: 8,
    max_bandwidth_mbytes_s: 200,
  });

  assert.equal(pcBandwidthBudget(declared, ['GigE']), 200, 'lay so khai trong catalog');
  assert.equal(pcBandwidthBudget(null, ['GigE']), 440, 'khong khai thi 110 x 4');
  assert.equal(pcBandwidthBudget(null, []), null, 'khong biet chuan nao thi khong ket luan');
});

test('dong khong co camera thi khong tinh vao', () => {
  const plan = planPcForLines(CATALOG, [
    line({ cameraCount: 2 }),
    line({ cameraCount: 0, interfaceName: '5GigE' }),
  ]);

  assert.equal(plan.totalCameras, 2);
  assert.deepEqual(plan.interfaces, ['GigE'], 'dong bo trong khong duoc keo theo chuan cua no');
});
