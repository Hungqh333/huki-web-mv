/**
 * Test cho phần dựng ba phương án so sánh.
 *
 * Trọng tâm là những chỗ dễ dựng ra một bảng đẹp mà sai: bịa đủ ba cột khi
 * catalog chỉ có hai camera, và gán chung một ống kính cho cả ba phương án
 * trong khi tiêu cự phụ thuộc cỡ cảm biến.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildVariants,
  marginOf,
  COMFORTABLE_MARGIN_PCT,
  type VariantRequest,
} from '../src/lib/components/variants';
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
    brand: 'X',
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

const cam = (model: string, w: number, h: number, format: string) =>
  part('camera', model, {
    camera_type: 'area',
    resolution_w_px: w,
    resolution_h_px: h,
    resolution_mp: (w * h) / 1e6,
    sensor_format: format,
    mount: 'C',
    interface: 'GigE',
    color: 'mono',
  });

// Ba camera thật trong seed, cùng chuẩn GigE, khác cỡ cảm biến.
const CAM_3MP = cam('A5031MG14', 2048, 1536, '1/1.8');
const CAM_5MP = cam('MV-CS050', 2448, 2048, '2/3');
const CAM_5MP_BIG = cam('a2A2590', 2592, 1944, '1/1.8');

const LENS_16 = part('lens', 'FF1620', {
  lens_type: 'fixed', focal_length_mm: 16, image_circle: '2/3', mount: 'C',
});
const LENS_25 = part('lens', 'FF2520', {
  lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C',
});
const LENS_50 = part('lens', 'FF5020', {
  lens_type: 'fixed', focal_length_mm: 50, image_circle: '1', mount: 'C',
});

const CATALOG = [CAM_3MP, CAM_5MP, CAM_5MP_BIG, LENS_16, LENS_25, LENS_50];

// FOV 100 × 75 mm, lỗi 0,2 mm, N = 3 -> cần 1500 × 1125 px.
const REQ: VariantRequest = {
  need: { nx: 1500, ny: 1125 },
  fovWidthMm: 100,
  fovHeightMm: 75,
  workingDistanceMm: 300,
  needTelecentric: false,
};

// ------------------------------------------------------------------ BIÊN DƯ --

test('bien du lay theo TRUC CHAT HON, khong lay truc rong rai', () => {
  // 2048/1500 = +36.5% ngang; 1536/1125 = +36.5% doc -> can bang.
  assert.equal(marginOf(CAM_3MP, REQ.need), 37);
  // 2448/1500 = +63% ngang; 2048/1125 = +82% doc -> phai lay 63.
  assert.equal(marginOf(CAM_5MP, REQ.need), 63);
  // 2592/1500 = +73% ngang; 1944/1125 = +73% doc.
  assert.equal(marginOf(CAM_5MP_BIG, REQ.need), 73);
});

test('quet dong chi xet be ngang, khong lay chieu doc cua cam bien', () => {
  const lineNeed = { nx: 1500, ny: null };
  assert.equal(marginOf(CAM_5MP, lineNeed), 63, 'chi tinh 2448 so voi 1500');
  assert.equal(marginOf(CAM_5MP, null), null, 'chua co nhu cau thi khong ket luan');
});

// ----------------------------------------------------------- DUNG PHUONG AN --

test('ba phuong an xep theo do phan giai tang dan', () => {
  const v = buildVariants(CATALOG, [CAM_5MP, CAM_3MP, CAM_5MP_BIG], REQ);

  assert.equal(v.length, 3);
  assert.deepEqual(v.map((x) => x.key), ['economy', 'balanced', 'headroom']);
  assert.equal(v[0].camera.model, 'A5031MG14', 'it pixel nhat dung dau');
  assert.equal(v[2].camera.model, 'a2A2590', 'nhieu pixel nhat dung cuoi');
  assert.ok(v[0].widthPx < v[2].widthPx);
});

test('cot giua la camera DAU TIEN co bien du thoai mai', () => {
  const v = buildVariants(CATALOG, [CAM_3MP, CAM_5MP, CAM_5MP_BIG], REQ);
  const balanced = v.find((x) => x.key === 'balanced');

  assert.equal(balanced?.camera.model, 'MV-CS050');
  assert.ok(
    (balanced?.marginPct ?? 0) >= COMFORTABLE_MARGIN_PCT,
    'cot giua phai that su thoai mai, khong chi la cai o giua danh sach'
  );
  // Camera tiet kiem duoi nguong thoai mai -> phai lo ra tren giao dien.
  assert.ok((v[0].marginPct ?? 0) < COMFORTABLE_MARGIN_PCT);
});

test('khong co camera nao thoai mai thi lay cai o giua, khong bo trong', () => {
  // Nhu cau sat sao: 2400 px ngang -> ca ba camera deu duoi 50%.
  const tight: VariantRequest = { ...REQ, need: { nx: 2400, ny: 1800 } };
  const v = buildVariants(CATALOG, [CAM_5MP, CAM_5MP_BIG], tight);
  const balanced = v.find((x) => x.key === 'balanced');

  assert.ok(balanced, 'van phai co cot de xuat');
  assert.ok(
    (balanced.marginPct ?? 99) < COMFORTABLE_MARGIN_PCT,
    'bien du hien thi phai tu noi ra rang no chua thoai mai'
  );
});

test('trung ma thi giu nhan DE XUAT, khong giu nhan tiet kiem', () => {
  /* Catalog hai camera: moc tiet kiem va moc de xuat roi vao cung mot ma. Neu
     bo trung theo thu tu tiet kiem-truoc thi nguoi dung con hai cot ma khong
     cot nao noi "chon cai nay". */
  const v = buildVariants(CATALOG, [CAM_5MP, CAM_5MP_BIG], REQ);
  assert.equal(v.length, 2);
  assert.ok(
    v.some((x) => x.key === 'balanced'),
    'phai con mot cot mang nhan de xuat'
  );
  assert.equal(v[0].camera.model, 'MV-CS050', 'cot it pixel hon dung truoc');
  assert.equal(v[0].key, 'balanced');

  // Mot camera duy nhat thi no CHINH LA de xuat, khong phai "tiet kiem".
  const one = buildVariants(CATALOG, [CAM_5MP], REQ);
  assert.equal(one[0].key, 'balanced');
});

test('catalog it camera thi tra ve IT COT, khong bia cho du ba', () => {
  const two = buildVariants(CATALOG, [CAM_3MP, CAM_5MP], REQ);
  assert.equal(two.length, 2, 'hai camera thi hai cot');
  assert.equal(new Set(two.map((x) => x.camera.code)).size, 2, 'khong duoc trung ma');

  const one = buildVariants(CATALOG, [CAM_5MP], REQ);
  assert.equal(one.length, 1, 'mot camera thi mot cot');

  assert.deepEqual(buildVariants(CATALOG, [], REQ), [], 'khong co camera thi khong co cot nao');
});

// --------------------------------------------------------- ONG KINH THEO CAM --

test('ong kinh tinh lai cho TUNG phuong an theo dung co cam bien', () => {
  // Can tieu cu = be rong cam bien x 300 / 100.
  //   1/1.8" = 7.18 mm -> 21.5 mm -> gan 25 nhat
  //   2/3"   = 8.8  mm -> 26.4 mm -> gan 25 nhat
  const v = buildVariants(CATALOG, [CAM_3MP, CAM_5MP, CAM_5MP_BIG], REQ);
  for (const variant of v) {
    assert.equal(variant.lens?.model, 'FF2520', `${variant.camera.model} phai ra 25 mm`);
  }

  // Doi khoang cach lam viec -> tieu cu can doi theo, ong kinh phai doi.
  const near = buildVariants(CATALOG, [CAM_5MP], { ...REQ, workingDistanceMm: 180 });
  assert.equal(near[0].lens?.model, 'FF1620', '8.8 x 180 / 100 = 15.8 mm -> 16 mm');
});

test('mm/px lay truc THO HON, vi truc do quyet dinh co thay duoc loi khong', () => {
  const v = buildVariants(CATALOG, [CAM_5MP], REQ);
  // 100/2448 = 0.04085 ; 75/2048 = 0.03662 -> phai lay 0.04085.
  assert.ok(Math.abs((v[0].mmPerPx ?? 0) - 100 / 2448) < 1e-6);
});

test('thieu so lieu thi tra null chu khong tra 0', () => {
  const v = buildVariants(CATALOG, [CAM_5MP], {
    need: null,
    fovWidthMm: null,
    fovHeightMm: null,
    workingDistanceMm: null,
    needTelecentric: false,
  });
  assert.equal(v[0].marginPct, null);
  assert.equal(v[0].mmPerPx, null);
});
