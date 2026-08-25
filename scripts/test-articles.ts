/**
 * Unit test cho phần xử lý nội dung bài viết.
 *
 * Từ Prompt 4, việc làm sạch HTML dùng thư viện sanitize-html với danh sách thẻ
 * CHO PHÉP (allowlist) — an toàn hơn hẳn kiểu liệt kê thứ cần chặn, vì thứ chưa
 * nghĩ tới sẽ bị loại theo mặc định thay vì lọt qua.
 *
 * Bộ lọc chạy ở hai nơi: lúc LƯU qua admin UI (dữ liệu bẩn không vào được
 * database) và lúc hiển thị (phòng dữ liệu ghi vào trước khi có bước đó).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeHtml, toTeaser } from '../src/lib/articles';
import { htmlToPlainText } from '../src/lib/html';

test('giữ nguyên thẻ định dạng thông thường', () => {
  const html = '<p>Đoạn <strong>đậm</strong> và <em>nghiêng</em>.</p>';
  assert.equal(sanitizeHtml(html), html);
});

test('giữ các thẻ Tiptap sinh ra', () => {
  for (const html of [
    '<h2>Tiêu đề</h2>',
    '<h3>Tiêu đề nhỏ</h3>',
    '<ul><li>một</li></ul>',
    '<ol><li>một</li></ol>',
    '<blockquote><p>trích</p></blockquote>',
    '<pre><code>mã</code></pre>',
  ]) {
    assert.equal(sanitizeHtml(html), html, `mat noi dung: ${html}`);
  }
});

test('bỏ thẻ script kèm nội dung bên trong', () => {
  const out = sanitizeHtml('<p>an toàn</p><script>alert(1)</script>');
  assert.equal(out, '<p>an toàn</p>');
});

test('bỏ thẻ ngoài allowlist nhưng giữ lại chữ', () => {
  assert.equal(sanitizeHtml('<h1>cấm</h1><h2>cho phép</h2>'), 'cấm<h2>cho phép</h2>');
  assert.equal(sanitizeHtml('<iframe src="evil"></iframe>'), '');
  assert.equal(sanitizeHtml('<style>body{display:none}</style>'), '');
  assert.equal(sanitizeHtml('<img src="x.png">'), '', 'chua cho phep chen anh trong noi dung');
});

test('bỏ thuộc tính sự kiện on* ở cả ba kiểu trích dẫn', () => {
  for (const html of [
    '<p onclick="alert(1)">x</p>',
    "<p onclick='alert(1)'>x</p>",
    '<p onclick=alert(1)>x</p>',
  ]) {
    assert.equal(sanitizeHtml(html), '<p>x</p>', `con sot on*: ${html}`);
  }
});

test('gỡ bỏ href dùng giao thức nguy hiểm', () => {
  for (const scheme of ['javascript:alert(1)', 'data:text/html,evil', 'vbscript:msgbox']) {
    const out = sanitizeHtml(`<a href="${scheme}">bấm</a>`);
    assert.equal(out.includes('href'), false, `con sot href: ${scheme}`);
    assert.ok(out.includes('bấm'), 'van giu lai chu');
  }
});

test('giữ link http/https/mailto và gắn rel chống reverse tabnabbing', () => {
  const out = sanitizeHtml('<a href="https://example.com">tài liệu</a>');
  assert.ok(out.includes('href="https://example.com"'));
  assert.ok(out.includes('rel="noopener noreferrer nofollow"'));

  assert.ok(sanitizeHtml('<a href="mailto:a@b.com">mail</a>').includes('mailto:a@b.com'));
});

test('làm sạch hai lần cho kết quả như một lần', () => {
  const dirty = '<p>x</p><script>alert(1)</script><a href="javascript:1">y</a>';
  assert.equal(sanitizeHtml(sanitizeHtml(dirty)), sanitizeHtml(dirty));
});

test('htmlToPlainText bỏ hết thẻ và giải mã ký tự đặc biệt', () => {
  assert.equal(htmlToPlainText('<p>Xin <strong>chào</strong></p>'), 'Xin chào');
  assert.equal(htmlToPlainText('<p>a &amp; b</p>'), 'a & b');
  assert.equal(htmlToPlainText('<p>a</p>   <p>b</p>'), 'a b');
});

test('teaser cắt ở ranh giới câu, tối đa 3 câu', () => {
  const teaser = toTeaser('Câu một. Câu hai. Câu ba. Câu bốn. Câu năm.');
  assert.ok(teaser.startsWith('Câu một. Câu hai. Câu ba.'));
  assert.equal(teaser.includes('Câu bốn'), false);
  assert.ok(teaser.endsWith('…'), 'phải có dấu lược khi còn nội dung phía sau');
});

test('teaser ngắn hơn giới hạn thì không thêm dấu lược', () => {
  assert.equal(toTeaser('Chỉ một câu.'), 'Chỉ một câu.');
});

test('teaser không có dấu kết câu thì cắt ở khoảng trắng', () => {
  const teaser = toTeaser('từ '.repeat(120));
  assert.ok(teaser.length <= 201, `dai qua: ${teaser.length}`);
  assert.ok(teaser.endsWith('…'));
  assert.equal(teaser.includes('  '), false, 'khong duoc de khoang trang doi');
});

test('teaser rỗng trả về chuỗi rỗng', () => {
  assert.equal(toTeaser(''), '');
  assert.equal(toTeaser('   '), '');
});
