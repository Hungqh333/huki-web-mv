/**
 * Kiểm tra việc xuất PDF có mã hoá đúng tiếng Việt không.
 *
 *   npm run test:pdf
 *
 * Vì sao cần: font mặc định của PDF (Helvetica) không có glyph tiếng Việt, và
 * khi thiếu glyph thì @react-pdf/renderer âm thầm thay bằng font khác chứ không
 * báo lỗi. Nhìn code không phát hiện được — phải dựng PDF thật rồi soi.
 *
 * Cách kiểm: giải nén các stream trong PDF, tìm bảng ToUnicode CMap (bảng ánh xạ
 * mã glyph sang mã Unicode). Chữ nào không nằm trong đó là chữ đó hỏng.
 */
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import React from 'react';
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

Font.register({
  family: 'BeVietnamPro',
  fonts: [
    { src: join(FONT_DIR, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
    { src: join(FONT_DIR, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { fontFamily: 'BeVietnamPro', fontSize: 11, padding: 40 },
  bold: { fontWeight: 700, fontSize: 16 },
});

// Gồm cả chữ Latin cơ bản lẫn ký tự riêng của tiếng Việt: lỗi trước đây là font
// subset chỉ có nhóm thứ hai, nên chữ thường lại rơi về Helvetica.
const SAMPLE_BOLD = 'Báo cáo gợi ý cấu hình thiết bị';
const SAMPLE_BODY =
  'Đo lường 2D — Ống kính telecentric, độ phân giải 15000 px. ' +
  'Kiểm tra dấu đầy đủ: ăâđêôơư ẠẢẤẦẨẫậ ỳỹỵ ĐđƯƯ Ộộ Ờờ. ' +
  'Basic latin abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.';

const doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(View, null, React.createElement(Text, { style: styles.bold }, SAMPLE_BOLD)),
    React.createElement(Text, null, SAMPLE_BODY)
  )
);

const buffer = await renderToBuffer(doc);
console.log(`Dựng được PDF, ${buffer.length} bytes.\n`);

const raw = buffer.toString('latin1');
let decoded = '';
const re = /stream\r?\n/g;
let m;
while ((m = re.exec(raw)) !== null) {
  const start = m.index + m[0].length;
  const end = raw.indexOf('endstream', start);
  if (end === -1) continue;
  try {
    decoded += inflateSync(Buffer.from(raw.slice(start, end), 'latin1')).toString('latin1');
  } catch {
    /* stream không nén bằng Flate */
  }
}

const CHECKS = [
  ['Đ', 0x0110],
  ['đ', 0x0111],
  ['ư', 0x01b0],
  ['ờ', 0x1edd],
  ['ộ', 0x1ed9],
  ['ả', 0x1ea3],
  ['ỵ', 0x1ef5],
  ['ă', 0x0103],
  ['ê', 0x00ea],
  ['a', 0x0061],
  ['Z', 0x005a],
  ['0', 0x0030],
];

let ok = true;
console.log('Mã Unicode trong bảng ToUnicode:');
for (const [char, code] of CHECKS) {
  const hex = code.toString(16).toUpperCase().padStart(4, '0');
  const present = new RegExp(`<${hex}>`, 'i').test(decoded);
  if (!present) ok = false;
  console.log(`  ${present ? 'ok   ' : 'THIẾU'} ${char.padEnd(2)} U+${hex}`);
}

// Helvetica xuất hiện nghĩa là có chữ rơi về font dự phòng — font đang dùng
// thiếu glyph cho phần chữ đó.
const usesFallback = raw.includes('Helvetica');
if (usesFallback) ok = false;
console.log(`\n  ${usesFallback ? 'THIẾU' : 'ok   '} không rơi về Helvetica`);

console.log(
  ok
    ? '\nPDF mã hoá đúng toàn bộ, kể cả chữ Latin lẫn dấu tiếng Việt.'
    : '\nCÓ LỖI FONT — chữ đánh dấu THIẾU sẽ hiển thị sai trong báo cáo.'
);
process.exitCode = ok ? 0 : 1;
