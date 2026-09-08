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
  pickCard,
  pickPc,
  planPc,
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
