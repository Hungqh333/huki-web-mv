/**
 * Unit test cho phần xử lý nội dung bài viết.
 *
 * sanitizeHtml là lớp phòng thủ bổ sung, KHÔNG phải bộ lọc hoàn chỉnh: quyền
 * ghi articles đã bị RLS giới hạn cho admin. Bộ lọc bằng regex không thể bao
 * hết mọi biến thể né tránh — khi gắn Tiptap ở Prompt 4 cần siết danh sách thẻ
 * cho phép ngay lúc lưu. Test dưới đây chốt các vector phổ biến nhất.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeHtml, toTeaser } from '../src/lib/articles';

test('giữ nguyên thẻ định dạng thông thường', () => {
  const html = '<p>Đoạn <strong>đậm</strong> và <em>nghiêng</em>.</p>';
  assert.equal(sanitizeHtml(html), html);
});

test('bỏ thẻ script kèm nội dung bên trong', () => {
  const out = sanitizeHtml('<p>an toàn</p><script>alert(1)</script>');
  assert.equal(out.includes('alert'), false);
  assert.equal(out.includes('<script'), false);
  assert.ok(out.includes('an toàn'));
});

test('bỏ thẻ script không đóng và iframe', () => {
  assert.equal(sanitizeHtml('<script src="x.js">').includes('<script'), false);
  assert.equal(sanitizeHtml('<iframe src="evil"></iframe>').includes('<iframe'), false);
  assert.equal(sanitizeHtml('<style>body{display:none}</style>').includes('<style'), false);
});

test('bỏ thuộc tính sự kiện on* ở cả ba kiểu trích dẫn', () => {
  assert.equal(sanitizeHtml('<img src="a.png" onerror="alert(1)">').includes('onerror'), false);
  assert.equal(sanitizeHtml("<img src='a.png' onerror='alert(1)'>").includes('onerror'), false);
  assert.equal(sanitizeHtml('<img src=a.png onerror=alert(1)>').includes('onerror'), false);
  assert.equal(sanitizeHtml('<div onclick="x()">a</div>').includes('onclick'), false);
});

test('vô hiệu hoá URL javascript:', () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">bấm</a>');
  assert.equal(out.includes('javascript:'), false);
  assert.ok(out.includes('href="#"'));
});

test('giữ nguyên link http bình thường', () => {
  const html = '<a href="https://example.com">tài liệu</a>';
  assert.equal(sanitizeHtml(html), html);
});

test('teaser cắt ở ranh giới câu, tối đa 3 câu', () => {
  const text = 'Câu một. Câu hai. Câu ba. Câu bốn. Câu năm.';
  const teaser = toTeaser(text);
  assert.ok(teaser.startsWith('Câu một. Câu hai. Câu ba.'));
  assert.equal(teaser.includes('Câu bốn'), false);
  assert.ok(teaser.endsWith('…'), 'phải có dấu lược khi còn nội dung phía sau');
});

test('teaser ngắn hơn giới hạn thì không thêm dấu lược', () => {
  const teaser = toTeaser('Chỉ một câu.');
  assert.equal(teaser, 'Chỉ một câu.');
});

test('teaser không có dấu kết câu thì cắt ở khoảng trắng', () => {
  const text = 'từ '.repeat(120);
  const teaser = toTeaser(text);
  assert.ok(teaser.length <= 201, `dai qua: ${teaser.length}`);
  assert.ok(teaser.endsWith('…'));
  assert.equal(teaser.includes('  '), false, 'khong duoc de khoang trang doi');
});

test('teaser rỗng trả về chuỗi rỗng', () => {
  assert.equal(toTeaser(''), '');
  assert.equal(toTeaser('   '), '');
});
