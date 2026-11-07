/**
 * Test nút "Copy thông số" PC Vision (src/lib/pc/specSheet.ts) — một dòng list thiết bị theo
 * form PC gốc (4_Pc_goc.xlsx trong gói bàn giao), chốt 2026-11-07.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readPcSeed } from '../src/lib/pc/devSeed';
import { PC_SPEC_KEYS, cpuName, parsePcFrameSpec, pcSpecRow } from '../src/lib/pc/specSheet';

const seed = readPcSeed();
const row = (shortName: string) => {
  const config = seed.configs.find((c) => c.shortName === shortName)!;
  return pcSpecRow(seed.frames.find((f) => f.id === config.frameId)!, config);
};

test('B2-500: đúng 4 ô theo form PC gốc, số lấy từ mã', () => {
  assert.deepEqual(row('B2-500'), {
    name: 'PC',
    model: 'RT-661R-Q670-A10-0001-I7-14700-G0-P500-R32I-S512I-D1TC-W11P',
    maker: 'AAEON',
    spec: [
      '-Chassis: 4U 19" Rackmount chassis, L450 × W427 × H177 mm',
      '-Power Supply: ATX, 90–264 VAC, Full Range, 500 W',
      '-CPU: Intel Core i7-14700 & Cooler',
      '-Memory: DDR5 U-DIMM, 32GB Kingston Industrial (2*16GB)',
      '-Storage: 2.5" SSD, SATA, 512GB Kingston Industrial & SSD 1TB Western Digital',
      '-OS: Windows 11 Pro 64-bit',
      '-I/O Interface: 2 × DP, 2 × HDMI, 2 × GbE LAN ports, 1 × COM, 4 × USB 3.1 ports,',
      'PCIe [x16] × 1, PCIe [x1] × 1, PCIe [x4] × 1',
      'PCIe [x16] × 1 (4 Lanes), PCI Slot × 3',
    ].join('\n'),
  });
});

test('dòng GPU theo model card của khung; không GPU thì không có dòng GPU', () => {
  assert.match(row('C1').spec, /^-GPU: Graphic card, RTX 5070 Twin Edge -OC, .*ZOTAC ZT-B50700H-10P$/m);
  assert.match(row('D1').spec, /^-GPU: PRIME-RTX5080-O16G$/m);
  assert.doesNotMatch(row('B1').spec, /-GPU:/);
  // Khung chưa khai model card: lấy theo mã.
  const d = seed.frames.find((f) => f.slug === 'D')!;
  const d1 = seed.configs.find((c) => c.shortName === 'D1')!;
  assert.match(pcSpecRow({ ...d, spec: {} }, d1).spec, /^-GPU: NVIDIA GeForce RTX 5080 16GB$/m);
});

test('khung A (ASUS EBS-I10) và P (máy lắp ráp ASUS) theo dòng tương ứng trong form', () => {
  const a = row('A1');
  assert.equal(a.maker, 'ASUS');
  assert.match(a.spec, /^-Motherboard: H610I-EM-A$/m);
  assert.match(a.spec, /^-Power Supply: PSU FLEX, GOLD, 250 W$/m);
  const p = row('P1');
  assert.match(p.spec, /^-Chassis: Xigmatek XA-22$/m);
  assert.match(p.spec, /^-Memory: UDIMM 3200MHz, 16GB Merlin \(2\*8GB\)$/m);
});

test('mọi khung trong danh mục đã có maker và chassis; khoá spec trong seed đều hợp lệ', () => {
  for (const f of seed.frames) {
    assert.ok(f.spec.maker, `${f.slug}: thiếu maker`);
    assert.ok(f.spec.chassis, `${f.slug}: thiếu chassis`);
  }
  const sql = readFileSync('supabase/seed_pc_spec.sql', 'utf8');
  for (const m of sql.matchAll(/set spec = '((?:[^']|'')*)'::jsonb/g)) {
    for (const key of Object.keys(JSON.parse(m[1]))) assert.ok((PC_SPEC_KEYS as readonly string[]).includes(key), `khoá lạ: ${key}`);
  }
});

test('đọc cột spec: bỏ khoá lạ, giá trị rỗng, kiểu sai', () => {
  assert.deepEqual(parsePcFrameSpec({ maker: ' AAEON ', chassis: '', foo: 'x', gpu: 5 }), { maker: 'AAEON' });
  assert.deepEqual(parsePcFrameSpec(null), {});
  assert.deepEqual(parsePcFrameSpec(['x']), {});
  assert.equal(cpuName('I9-14900'), 'Intel Core i9-14900');
  assert.equal(cpuName('U7-265'), 'U7-265');
});
