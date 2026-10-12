/**
 * Báo cáo PDF của bộ chọn thiết bị cũ (MVP) — trước đây không có test nào dựng nó.
 * .mts vì @react-pdf chỉ chạy ESM (xem test-export-pdf.mts). Chạy trong npm run test:pdf.
 *
 * 2026-10-12: kiểm lại nghi vấn "số trang không vẽ" (ghi chú từ C6) — trên chính báo cáo
 * này, Text `render` CÓ vẽ "Trang n/N". Test giữ cho điều đó đúng mãi, cùng phông tiếng
 * Việt, chữ ghép fi tắt, và công thức đã dịch thẻ không lọt vào PDF.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';

import { SelectorReport, type ReportData, type ReportLabels } from '../src/lib/pdf/selector/SelectorReport';

const dir = join(process.cwd(), 'assets', 'fonts');
Font.register({
  family: 'BeVietnamPro',
  fonts: [
    { src: join(dir, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
    { src: join(dir, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const labels: ReportLabels = {
  title: 'Báo cáo gợi ý thiết bị', task: 'Bài toán', generatedAt: 'Tạo lúc', generatedFor: 'Cho', inputs: 'Thông số nhập',
  result: 'Kết quả', camera: 'Camera', lighting: 'Chiếu sáng', lens: 'Ống kính', processing: 'Xử lý', accessories: 'Phụ kiện',
  approach: 'Hướng xử lý', approachReason: 'Lý do', calculations: 'Các phép tính', notes: 'Ghi chú', notSpecified: '—',
  disclaimer: 'Kết quả mang tính tham khảo.', page: 'Trang',
};

const data = (metrics: number): ReportData => ({
  taskName: 'Kiểm tra ngoại quan',
  userEmail: 'ky.su@example.test',
  createdAt: '12/10/2026',
  inputs: [{ label: 'Vùng nhìn', value: '100 × 75 mm' }],
  result: {
    camera: 'Area scan đơn sắc, ≥ 5 MP', lighting: 'Dark field', lens: 'Fixed focal', processing: 'GigE', accessories: null,
    approach: 'rule_based', approachReason: null, notes: [], matchedRuleCodes: ['APPEAR-BASE'], noRuleMatched: false,
    // Route /api/bao-cao dịch thẻ trước khi dựng PDF — ở đây đưa chữ đã dịch.
    derived: Array.from({ length: metrics }, (_, i) => ({ key: `m${i}`, value: i, formula: `60 sp/phút ÷ 60 = 1 ảnh/s · field ${i}` })),
  },
  approachLabel: 'Xử lý truyền thống',
  metricLabels: {},
  locale: 'vi',
});

async function textLayer(report: ReportData) {
  const raw = (await renderToBuffer(React.createElement(SelectorReport, { data: report, labels }) as never)).toString('latin1');
  let decoded = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      decoded += inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      /* stream không nén */
    }
  }
  return { raw, decoded, pages: (raw.match(/\/Type \/Page\b/g) ?? []).length };
}

test('báo cáo cũ: có số trang "Trang n/N" trên mọi trang, phông tiếng Việt, không chữ ghép fi', async () => {
  for (const metrics of [2, 80]) {
    const { raw, decoded, pages } = await textLayer(data(metrics));
    assert.ok(raw.startsWith('%PDF'));
    // Mã glyph của chữ "T" và dấu "/" có trong bảng ToUnicode ⇒ chuỗi "Trang n/N" đã được vẽ.
    assert.ok(/<0054>/.test(decoded) && /<002f>/i.test(decoded), `${pages} trang: khong thay so trang`);
    assert.ok(!raw.includes('Helvetica'), 'roi ve Helvetica');
    assert.ok(/<1EA3>|<1ea3>/.test(decoded) || /<1EA1>|<1ea1>/i.test(decoded), 'thieu glyph tieng Viet');
    assert.ok(!/<0066 ?006[9c]>/i.test(decoded), 'con chu ghep fi trong lop chu PDF');
    if (metrics === 80) assert.ok(pages >= 2, `80 phep tinh phai tran sang trang 2, chi co ${pages}`);
  }
});
