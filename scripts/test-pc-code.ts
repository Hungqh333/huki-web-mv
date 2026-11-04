/**
 * Test mã PC Vision (chốt 2026-11-03).
 *
 * Mã thật do trigger CSDL ghép (pc_compose_code); pc/code.ts ghép lại y hệt để form hiện
 * ngay. Test này đọc chính seed_pc.sql — 13 cấu hình của gói bàn giao — ghép bằng TS rồi
 * so với bảng mã của gói. rls_smoke_test.sql kiểm phía CSDL trên cùng quy tắc.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PC_CODE_REGEX,
  compareConfigs,
  composePcCode,
  configCodeMiddle,
  estimatePeakLoadW,
  findFrame,
  frameCodeHead,
  gpuLabel,
  parseDataDrive,
  pcCodeErrors,
  sizeToken,
  type PcConfigParts,
  type PcFrameKey,
} from '../src/lib/pc/code';
import { readPcSeed } from '../src/lib/pc/devSeed';
import { pcPowerModel } from '../src/lib/pc/power';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';

const PN = 'RT-661R-Q670-A10-0001';

/** Mã của 13 cấu hình theo gói bàn giao mục 3 (khung + phần R-S-D). */
const EXPECTED: Record<string, string> = {
  A1: 'EBS-I10-I5-12400-G0-P250-R16?-S256?-D0-W11P',
  B1: `${PN}-I7-14700-G0-P650-R16I-S512I-D0-W11P`,
  B2: `${PN}-I7-14700-G0-P650-R32I-S512I-D1TC-W11P`,
  B3: `${PN}-I7-14700-G0-P650-R64I-S512I-D2TC-W11P`,
  Ct1: `${PN}-I7-14700-G5070V12-P1000-R32I-S1TI-D0-W11P`,
  Ct2: `${PN}-I7-14700-G5070V12-P1000-R32I-S512I-D2TC-W11P`,
  C1: `${PN}-I9-14900-G5070V12-P1000-R32I-S1TI-D0-W11P`,
  C2: `${PN}-I9-14900-G5070V12-P1000-R64I-S1TI-D0-W11P`,
  C3: `${PN}-I9-14900-G5070V12-P1000-R64I-S512I-D2TC-W11P`,
  D1: `${PN}-I9-14900-G5080V16-P1300-R64I-S1TI-D0-W11P`,
  D2: `${PN}-I9-14900-G5080V16-P1300-R64I-S512I-D4TC-W11P`,
  D3: `${PN}-I9-14900-G5080V16-P1300-R128I-S1TI-D2TC-W11P`,
  P1: 'LR-H610M-XA22-I5-12400-G0-P450-R16C-S256C-D0-W11P',
};

/** seed_pc.sql qua chính bộ đọc của trang xem trước: khung theo slug, cấu hình theo tên ngắn. */
function readSeed() {
  const seed = readPcSeed();
  const frames = new Map<string, PcFrameKey>(seed.frames.map((f) => [f.slug, f]));
  const slugOf = new Map(seed.frames.map((f) => [f.id, f.slug]));
  const configs = new Map<string, { slug: string; parts: PcConfigParts }>(
    seed.configs.map((c) => [c.shortName, { slug: slugOf.get(c.frameId)!, parts: c }])
  );
  return { frames, configs };
}

test('seed: 6 khung, 13 cấu hình, mã ghép khớp gói bàn giao', () => {
  const { frames, configs } = readSeed();
  assert.equal(frames.size, 6);
  assert.equal(configs.size, 13);
  for (const [name, { slug, parts }] of configs) {
    const frame = frames.get(slug);
    assert.ok(frame, `${name}: thiếu khung ${slug}`);
    assert.equal(composePcCode(frame, parts), EXPECTED[name], name);
  }
});

test('mã đúng regex, trừ mã có ? của khung chưa rõ dòng RAM/SSD', () => {
  for (const [name, code] of Object.entries(EXPECTED)) {
    assert.equal(PC_CODE_REGEX.test(code), name !== 'A1', name);
  }
  // Ví dụ trong quy tắc gửi hãng.
  assert.ok(PC_CODE_REGEX.test('RT-661R-Q670-A10-0001-I9-14900-G5070V12-P1000-R64I-S2TI-D0-W11P'));
  assert.ok(PC_CODE_REGEX.test('EBS-I10-U7-265-G5060TIV16-P650-R32I-S512I-H4TC-W11L'));
  assert.ok(PC_CODE_REGEX.test('LR-H610M-XA22-RZ7-7700X-G4070SV12-P850-R32C-S1TC-D0-NOS'));
  assert.ok(!PC_CODE_REGEX.test('EBS-I10-I9_14900-G0-P650-R32I-S512I-D0-W11P'));
});

test('ghép từng phần: kích thước, GPU, phần đầu / giữa', () => {
  assert.equal(sizeToken(512), '512');
  assert.equal(sizeToken(1024), '1T');
  assert.equal(sizeToken(4096), '4T');
  assert.equal(gpuLabel('5060TI'), 'RTX 5060 Ti');
  assert.equal(gpuLabel('4070S'), 'RTX 4070 Super');
  const { frames, configs } = readSeed();
  const d = frames.get('D')!;
  assert.equal(frameCodeHead(d), `${PN}-I9-14900-G5080V16-P1300`);
  assert.equal(configCodeMiddle(d, configs.get('D2')!.parts), 'R64I-S512I-D4TC');
  assert.deepEqual(parseDataDrive('H2048'), { kind: 'H', gb: 2048 });
  assert.equal(parseDataDrive(null), null);
});

test('lỗi hiện trên form: CPU sai, GPU/VRAM lệch, trùng mã', () => {
  const { frames, configs } = readSeed();
  const b = frames.get('B')!;
  const b2 = configs.get('B2')!.parts;
  assert.deepEqual(pcCodeErrors(b, b2), []);
  assert.deepEqual(pcCodeErrors({ ...b, cpu: 'I7 14700' }, b2), ['cpu', 'regex']);
  assert.deepEqual(pcCodeErrors({ ...b, gpu: '5070' }, b2), ['gpuNoVram']);
  assert.deepEqual(pcCodeErrors({ ...b, vramGb: 12 }, b2), ['vramNoGpu']);
  assert.deepEqual(pcCodeErrors(b, b2, [EXPECTED.B1, EXPECTED.B2]), ['duplicate']);
  // Khi sửa, danh sách mã đã bỏ chính dòng đang sửa → không báo trùng.
  assert.deepEqual(pcCodeErrors(b, b2, [EXPECTED.B1, EXPECTED.B3]), []);
});

test('nhận khung theo khoá; khác một trường là khung mới', () => {
  const { frames } = readSeed();
  const list = [...frames.values()];
  assert.equal(findFrame(list, frames.get('Ct')!), frames.get('Ct'));
  assert.equal(findFrame(list, { ...frames.get('C')!, psuW: 1300 }), undefined);
  assert.equal(findFrame(list, { ...frames.get('B')!, ramLine: 'C' }), undefined);
});

test('xếp cấu hình trong khung từ nhỏ đến lớn khớp thứ tự của gói', () => {
  const { configs } = readSeed();
  for (const order of [['B1', 'B2', 'B3'], ['Ct1', 'Ct2'], ['C1', 'C2', 'C3'], ['D1', 'D2', 'D3']]) {
    const sorted = [...order].reverse().sort((a, b) => compareConfigs(configs.get(a)!.parts, configs.get(b)!.parts));
    assert.deepEqual(sorted, order);
  }
});

test('PC-PSU: tải đỉnh ước tính theo mẫu đã duyệt', () => {
  const model = pcPowerModel(DEFAULT_ENGINE_PARAMS);
  assert.equal(estimatePeakLoadW(model, '0'), 319);
  assert.equal(estimatePeakLoadW(model, '5070'), 569); // khung C ~570W → 1000W (57 %)
  assert.equal(estimatePeakLoadW(model, '5080'), 679); // khung D ~680W → 1300W (52 %)
  assert.equal(estimatePeakLoadW(model, '9999'), 619); // chip lạ → 300W
  assert.equal(model.maxShare, 0.7);
});
