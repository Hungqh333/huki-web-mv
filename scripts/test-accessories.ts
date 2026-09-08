/**
 * Test cho phụ kiện máy tự thêm theo luật.
 *
 * Trọng tâm là những chỗ thiếu mà không ai nhận ra cho tới khi ra hiện trường:
 * mua kính phân cực mà quên tấm phân cực cho đèn, quét dòng mà quên encoder,
 * và lọc dải hẹp gắn sai bước sóng so với màu đèn.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accessoryQty,
  pickRuleAccessories,
  type AccessoryRequest,
} from '../src/lib/components/accessories';
import { listAccessories } from '../src/lib/components/match';
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

const acc = (model: string, spec: Record<string, unknown>) =>
  part('accessory', model, { pick_mode: 'rule', ...spec });

const POL_LENS = acc('POL-LENS', {
  accessory_type: 'polarizer_lens',
  accessory_for: 'lens',
  qty_basis: 'per_camera',
});
const POL_LIGHT = acc('POL-LIGHT', {
  accessory_type: 'polarizer_light',
  accessory_for: 'light',
  qty_basis: 'per_light',
});
const BP_630 = acc('BP-630', {
  accessory_type: 'bandpass_filter',
  accessory_for: 'lens',
  qty_basis: 'per_camera',
  wavelength_nm: 630,
});
const BP_850 = acc('BP-850', {
  accessory_type: 'bandpass_filter',
  accessory_for: 'lens',
  qty_basis: 'per_camera',
  wavelength_nm: 850,
});
const HOUSING = acc('HOUSING', {
  accessory_type: 'ip_housing',
  accessory_for: 'camera',
  qty_basis: 'per_camera',
});
const ENCODER = acc('ENCODER', {
  accessory_type: 'encoder',
  accessory_for: 'system',
  qty_basis: 'per_system',
});
const ENCODER_CABLE = acc('ENCODER-CABLE', {
  accessory_type: 'encoder_cable',
  accessory_for: 'system',
  qty_basis: 'per_system',
});
const TRIGGER = acc('TRIGGER', {
  accessory_type: 'trigger_sensor',
  accessory_for: 'system',
  qty_basis: 'per_system',
});
const LOCK_RING = acc('LOCK-RING', {
  accessory_type: 'lock_ring',
  accessory_for: 'lens',
  qty_basis: 'per_camera',
});
const MOUNT_ADAPTER = acc('MOUNT-C-F', {
  accessory_type: 'mount_adapter',
  accessory_for: 'camera',
  qty_basis: 'per_camera',
});
const BRACKET = part('accessory', 'BRACKET', {
  pick_mode: 'manual',
  accessory_type: 'bracket',
  accessory_for: 'camera',
});

const CATALOG = [
  POL_LENS,
  POL_LIGHT,
  BP_630,
  BP_850,
  HOUSING,
  ENCODER,
  ENCODER_CABLE,
  TRIGGER,
  LOCK_RING,
  MOUNT_ADAPTER,
  BRACKET,
];

const BASE: AccessoryRequest = {
  surface: 'matte',
  environment: [],
  ipRating: 'none',
  captureMode: 'static',
  cameraMount: 'C',
  lensMount: 'C',
  lightColor: 'white',
};

const typesOf = (req: Partial<AccessoryRequest>) =>
  pickRuleAccessories(CATALOG, { ...BASE, ...req }).map(
    (item) => item.component.spec.accessory_type
  );

test('bai binh thuong thi khong tu them phu kien nao', () => {
  assert.deepEqual(typesOf({}), [], 'khong co dieu kien nao bat thi danh sach rong');
});

test('be mat phan chieu keo theo CA CAP phan cuc, khong phai mot nua', () => {
  const metal = typesOf({ surface: 'metal' });
  assert.ok(metal.includes('polarizer_lens'), 'thieu kinh tren ong kinh');
  assert.ok(
    metal.includes('polarizer_light'),
    'mua moi kinh lens thi khong cat duoc loa — anh sang toi van chua phan cuc'
  );

  // Be mat mo thi khong can — dung ban phu kien khong dung toi.
  assert.ok(!typesOf({ surface: 'matte' }).includes('polarizer_lens'));
  assert.ok(typesOf({ surface: 'reflective' }).includes('polarizer_lens'));
});

test('loc dai hep phai khop buoc song voi mau den', () => {
  const red = pickRuleAccessories(CATALOG, {
    ...BASE,
    environment: ['ambient_light'],
    lightColor: 'red',
  });
  assert.equal(
    red.find((item) => item.component.spec.accessory_type === 'bandpass_filter')?.component.model,
    'BP-630',
    'den do -> kinh 630nm'
  );

  const ir = pickRuleAccessories(CATALOG, {
    ...BASE,
    environment: ['ambient_light'],
    lightColor: 'ir',
  });
  assert.equal(
    ir.find((item) => item.component.spec.accessory_type === 'bandpass_filter')?.component.model,
    'BP-850'
  );

  // Den trang khong loc dai hep duoc: loc mau nao cung cat mat phan lon anh sang.
  assert.ok(
    !typesOf({ environment: ['ambient_light'], lightColor: 'white' }).includes('bandpass_filter'),
    'den trang thi khong duoc gan bua mot kinh loc'
  );
});

test('yeu cau IP keo theo vo bao ve, "none" thi khong', () => {
  assert.ok(typesOf({ ipRating: 'ip65' }).includes('ip_housing'));
  assert.ok(!typesOf({ ipRating: 'none' }).includes('ip_housing'));
  assert.ok(!typesOf({ ipRating: null }).includes('ip_housing'));
});

test('quet dong keo theo encoder, cap encoder va cam bien trigger', () => {
  const line = typesOf({ captureMode: 'line_scan' });
  assert.ok(line.includes('encoder'), 'form da hoi do phan giai encoder ma khong ban encoder');
  assert.ok(line.includes('encoder_cable'));
  assert.ok(line.includes('trigger_sensor'));

  // Chup tinh thi khong can gi trong so do.
  const still = typesOf({ captureMode: 'static' });
  assert.ok(!still.includes('encoder'));
  assert.ok(!still.includes('trigger_sensor'));

  // Dong area scan van can trigger nhung khong can encoder.
  const moving = typesOf({ captureMode: 'moving_area' });
  assert.ok(moving.includes('trigger_sensor'));
  assert.ok(!moving.includes('encoder'), 'area scan khong dung encoder de dinh dong');
});

test('rung keo theo vong khoa, ngam lech keo theo adapter', () => {
  assert.ok(typesOf({ environment: ['vibration'] }).includes('lock_ring'));
  assert.ok(!typesOf({ environment: ['dust'] }).includes('lock_ring'));

  assert.ok(typesOf({ cameraMount: 'F', lensMount: 'C' }).includes('mount_adapter'));
  assert.ok(!typesOf({ cameraMount: 'C', lensMount: 'C' }).includes('mount_adapter'));
  assert.ok(
    !typesOf({ cameraMount: null, lensMount: 'C' }).includes('mount_adapter'),
    'chua chon camera thi chua ket luan duoc lech ngam'
  );
});

test('so luong nhan theo dung co so: camera, den, hay ca he', () => {
  const items = pickRuleAccessories(CATALOG, {
    ...BASE,
    surface: 'metal',
    captureMode: 'line_scan',
  });
  const counts = { cameras: 2, lights: 6 };
  const qtyOf = (type: string) => {
    const item = items.find((entry) => entry.component.spec.accessory_type === type);
    return item ? accessoryQty(item, counts) : null;
  };

  assert.equal(qtyOf('polarizer_lens'), 2, 'kinh tren ong kinh di theo tung camera');
  assert.equal(qtyOf('polarizer_light'), 6, 'tam phan cuc di theo tung DEN, khong theo camera');
  assert.equal(qtyOf('encoder'), 1, 'ca he mot encoder');
});

test('phu kien co luat khong lot vao danh sach tich tay — neu khong se dat hai lan', () => {
  const manual = listAccessories(CATALOG).map((item) => item.model);
  assert.deepEqual(manual, ['BRACKET'], 'chi con phu kien pick_mode = manual');
  assert.ok(!manual.includes('POL-LENS'));
});

test('mon khong co trong catalog thi bo qua, khong dung dong trong', () => {
  const thin = [POL_LENS]; // thieu han tam phan cuc cho den
  const picked = pickRuleAccessories(thin, { ...BASE, surface: 'metal' });
  assert.equal(picked.length, 1, 'chi them duoc mon co that trong catalog');
  assert.equal(picked[0].component.model, 'POL-LENS');
});
