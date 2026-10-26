/**
 * Nhập sF hàng loạt cho ống kính (chốt 2026-10-26 Q2): đọc CSV, ba cách cho sF.
 *
 *   npx tsx --test scripts/test-front-focal.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFrontFocalCsv } from '../src/lib/components/frontFocalCsv';
import { frontFocalFromDatasheet } from '../src/lib/vision/configurationRules';

test('CSV: sf_mm có sẵn, WD + β, WD + vùng nhìn + cảm biến; dòng thiếu / sai báo lỗi', () => {
  const { rows, errors } = parseFrontFocalCsv(
    ['ma,sf_mm,wd_mm,beta,fov_mm,sensor_mm', 'A,3.7,,,,', 'B,,500,0.048,,', 'C,,300,,100,8.4456', ',1,,,,', 'D,,,,,', 'E,abc,,,,'].join('\n')
  );
  assert.deepEqual(rows[0], { line: 2, key: 'A', source: { kind: 'sf', sF: 3.7 } });
  assert.deepEqual(rows[1], { line: 3, key: 'B', source: { kind: 'datasheet', wdMm: 500, beta: 0.048 } });
  assert.ok(rows[2].source.kind === 'datasheet' && Math.abs(rows[2].source.beta - 0.084456) < 1e-9);
  assert.deepEqual(
    errors.map((e) => [e.line, e.reason]),
    [
      [5, 'noKey'],
      [6, 'noValue'],
      [7, 'badNumber'],
    ]
  );
});

test('CSV chấm phẩy + dấu phẩy thập phân; cột tiếng Việt / tiếng Anh', () => {
  const { rows } = parseFrontFocalCsv('code;sf\nX;-14,1\n');
  assert.deepEqual(rows, [{ line: 2, key: 'X', source: { kind: 'sf', sF: -14.1 } }]);
});

test('sF từ datasheet: sF = WD − f ÷ β (Hik MF2518 ở WD 300: β 0,08437 → sF ≈ 3,7)', () => {
  const sF = frontFocalFromDatasheet(25, 300, 8.4456 / 100.1)!;
  assert.ok(Math.abs(sF - 3.69) < 0.01, String(sF));
  assert.equal(frontFocalFromDatasheet(25, 300, 0), null);
});
