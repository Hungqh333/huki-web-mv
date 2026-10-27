/**
 * Trình bày Sổ tay công thức (chốt 2026-10-27, mẫu CAM-001): tách dòng công thức, bảng
 * kết luận "Khi … / nhãn", gộp CẢNH BÁO + LƯU Ý thành "Lưu ý", mã luật gom về "Liên quan".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FORMULA_BOOK } from '../src/lib/formulaBook/book';
import { entryIdFor, formulaLines, relatedEntries, splitFormulaLine, verdictRows } from '../src/lib/formulaBook/present';

const ALL = FORMULA_BOOK.flatMap((s) => s.entries);
const entry = (id: string) => ALL.find((e) => e.id === id)!;
const CODE = /\b[A-Z]{2,4}-\d{3}\b/;

test('CAM-001: 5 dòng công thức, mã luật trong ngoặc đã bỏ, ghi chú tách riêng', () => {
  const lines = formulaLines(entry('CAM-001'));
  assert.equal(lines.length, 5);
  for (const l of lines) assert.doesNotMatch(`${l.main} ${l.note ?? ''}`, /\(\s*[A-Z]{2,4}-\d{3}\s*\)/);
  assert.equal(lines[3].note, 'chỉ khi vật chạy lúc chụp');
});

test('CAM-001: kết luận Loại ×4 + "Lưu ý · cần strobe"', () => {
  const rows = verdictRows(entry('CAM-001'));
  assert.deepEqual(
    rows.map((r) => r.kind),
    ['bad', 'bad', 'bad', 'warn', 'bad']
  );
  assert.equal(rows[3].label, 'Lưu ý · cần strobe');
});

test('CAM-001: dòng Liên quan đúng thứ tự xuất hiện', () => {
  assert.deepEqual(relatedEntries(entry('CAM-001')), ['RES-004', 'THR-002', 'THR-005', 'THR-006', 'THR-007', 'LGT-024']);
});

test('CẢNH BÁO và LƯU Ý cùng nhãn "Lưu ý"; kết luận không có "→" vẫn nhận ra', () => {
  const labels = ALL.flatMap(verdictRows)
    .filter((r) => r.kind !== 'neutral')
    .map((r) => r.label ?? '');
  assert.ok(!labels.some((l) => /CẢNH BÁO|LƯU Ý/.test(l.split(' · ')[0])));
  assert.deepEqual(
    verdictRows(entry('OPT-005'))
      .slice(0, 2)
      .map((r) => [r.when, r.label]),
    [
      ['tỉ lệ > dung sai, bài đo', 'Loại'],
      ['tỉ lệ > dung sai, bài phát hiện', 'Lưu ý'],
    ]
  );
  assert.deepEqual(verdictRows(entry('RES-006'))[0], { when: 'Mọi trường hợp', kind: 'warn', label: 'Lưu ý' });
  assert.ok(verdictRows(entry('LGT-009..016')).some((r) => r.when === 'camera màu + IR' && r.kind === 'bad'));
});

test('kết luận chưa phân loại (chỉ thông tin) ít — dưới 25 hàng toàn sổ', () => {
  const neutral = ALL.flatMap(verdictRows).filter((r) => r.kind === 'neutral');
  assert.ok(neutral.length < 25, `${neutral.length} hang chua phan loai`);
});

test('mọi mã ở dòng Liên quan trỏ tới mục có thật, không trỏ về chính mục', () => {
  const ids = new Set(ALL.map((e) => e.id));
  for (const e of ALL) {
    for (const id of relatedEntries(e)) {
      assert.ok(ids.has(id), `${e.id} → ${id}`);
      assert.notEqual(id, e.id);
    }
  }
});

test('mã con quy về mục chứa nó; mã giữa câu giữ nguyên', () => {
  assert.equal(entryIdFor('LGT-003'), 'LGT-001..004');
  assert.equal(entryIdFor('XYZ-999'), null);
  assert.equal(splitFormulaLine('fps thật theo CAM-002 (THR-003)').main, 'fps thật theo CAM-002');
  assert.match(splitFormulaLine('fps thật theo CAM-002').main, CODE);
});

test('không còn dòng công thức rỗng, không dấu phẩy treo', () => {
  for (const e of ALL) {
    for (const l of formulaLines(e)) {
      assert.ok(l.main.length > 0, e.id);
      assert.doesNotMatch(l.main, /\s,|\(\s*\)/, `${e.id}: ${l.main}`);
    }
  }
});
