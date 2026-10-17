/**
 * Mở file .xlsx bằng exceljs nhưng chịu được cách lưu ghi chú ô của phần mềm khác.
 *
 * exceljs chỉ nhận ghi chú ô (comments) ở đúng `xl/commentsN.xml` và hình VML ở
 * `xl/drawings/vmlDrawingN.vml`, quan hệ ghi dạng TƯƠNG ĐỐI. Một số phần mềm (Excel
 * 365 bản mới, WPS, công cụ chuyển đổi) lưu `xl/comments/comment1.xml`,
 * `xl/drawings/commentsDrawing1.vml` và đường dẫn tuyệt đối `/xl/...` — exceljs vỡ ở
 * bước ghép ghi chú: "Cannot read properties of undefined (reading 'comments')".
 * Gặp lần đầu 2026-10-16 với file thiết bị Hưng điền — dữ liệu không sai, chỉ cách lưu khác.
 *
 * Cách làm (trên bản sao trong bộ nhớ, file gốc không bị sửa):
 * 1. đổi Target tuyệt đối (không phải link ngoài) thành tương đối;
 * 2. chuyển file ghi chú / VML của từng sheet về đúng tên exceljs nhận, sửa Target theo.
 */
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const COMMENTS_TYPE = /\/comments"$/;
const VML_TYPE = /\/vmlDrawing"$/;

/** `xl/worksheets/_rels/sheet2.xml.rels` → thư mục phần sở hữu: `xl/worksheets`; gói gốc → ''. */
function ownerDir(relsPath: string): string {
  const parent = posix.dirname(posix.dirname(relsPath));
  return parent === '.' ? '' : parent;
}

export async function normalizeXlsxRelationships(buffer: Buffer): Promise<{ buffer: Buffer; changed: number }> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = 0;
  let commentSeq = 0;
  let vmlSeq = 0;
  const renamed = new Map<string, string>(); // đường dẫn cũ → mới (không có '/' đầu)

  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.rels') || zip.files[name].dir) continue;
    const base = ownerDir(name);
    if (base === '') continue; // quan hệ gốc của gói: exceljs đọc được dạng tuyệt đối
    const xml = await zip.file(name)!.async('string');
    const fixed = xml.replace(/<Relationship\b[^>]*>/g, (tag) => {
      if (/TargetMode="External"/.test(tag)) return tag;
      const target = /Target="([^"]+)"/.exec(tag)?.[1];
      if (!target) return tag;
      const type = /Type="([^"]+)"/.exec(tag)?.[1] ?? '';
      // Đường dẫn đầy đủ trong gói của phần được trỏ tới.
      let full = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(base, target));
      if (COMMENTS_TYPE.test(`${type}"`) && !/^xl\/comments\d+\.xml$/.test(full)) {
        const next = renamed.get(full) ?? `xl/comments${++commentSeq + 1000}.xml`;
        renamed.set(full, next);
        full = next;
      } else if (VML_TYPE.test(`${type}"`) && !/^xl\/drawings\/vmlDrawing\d+\.vml$/.test(full)) {
        const next = renamed.get(full) ?? `xl/drawings/vmlDrawing${++vmlSeq + 1000}.vml`;
        renamed.set(full, next);
        full = next;
      }
      const relative = posix.relative(base, full);
      if (relative === target) return tag;
      changed++;
      return tag.replace(/Target="[^"]+"/, `Target="${relative}"`);
    });
    if (fixed !== xml) zip.file(name, fixed);
  }

  for (const [from, to] of renamed) {
    const file = zip.file(from);
    if (!file) continue;
    zip.file(to, await file.async('uint8array'));
    zip.remove(from);
  }
  if (renamed.size > 0) {
    const types = zip.file('[Content_Types].xml');
    if (types) {
      let xml = await types.async('string');
      for (const [from, to] of renamed) xml = xml.split(`PartName="/${from}"`).join(`PartName="/${to}"`);
      zip.file('[Content_Types].xml', xml);
    }
  }

  if (changed === 0 && renamed.size === 0) return { buffer, changed };
  return { buffer: await zip.generateAsync({ type: 'nodebuffer' }), changed: changed + renamed.size };
}

/** Thay cho `workbook.xlsx.readFile(path)`. */
export async function readWorkbookFile(filePath: string): Promise<ExcelJS.Workbook> {
  const { buffer } = await normalizeXlsxRelationships(readFileSync(filePath));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}
