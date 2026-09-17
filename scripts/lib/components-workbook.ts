/**
 * Đọc / ghi file Excel catalog linh kiện theo định nghĩa cột ở components-io.ts.
 *
 * Tách khỏi components-io.ts để phần kiểm dòng không phụ thuộc exceljs, còn
 * file này thì test được vòng tròn: sinh file mẫu → đọc lại → ra đúng cột.
 */
import ExcelJS from 'exceljs';
import { EXAMPLE_MARK, SHEETS, normalizeHeader, type SheetDef, type SheetRow } from './components-io';

/** Số dòng có sẵn ô chọn (data validation). Đủ cho catalog cả phòng. */
const VALIDATED_ROWS = 500;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Ô công thức: lấy kết quả. Rich text: nối các đoạn. Hyperlink: lấy chữ.
    if ('result' in value && value.result !== undefined) return String(value.result).trim();
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink.trim();
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    return '';
  }
  return String(value).trim();
}

/** Tên cột Excel (A, B, … AA) theo số thứ tự bắt đầu từ 1. */
const columnLetter = (index: number): string => {
  let name = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

export async function buildTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const guide = workbook.addWorksheet('HƯỚNG DẪN');
  guide.columns = [{ width: 28 }, { width: 34 }, { width: 12 }, { width: 90 }];

  const intro = [
    'FILE NHẬP THIẾT BỊ — MACHINE VISION HUB',
    '',
    'Mỗi sheet là một loại thiết bị. Mỗi dòng là một model.',
    'Dòng 1 là tên cột, dòng 2 ghi BẮT BUỘC / tùy chọn — đừng sửa hai dòng này.',
    `Dòng 3 là ví dụ (cột Hãng bắt đầu bằng "${EXAMPLE_MARK}") — máy bỏ qua, có thể giữ lại để nhìn theo.`,
    'Điền từ dòng 4. Cột có ô chọn thì bấm mũi tên để chọn, đừng gõ khác đi.',
    '',
    'Điền xong: lưu file (Ctrl + S) rồi nhắn để chạy lệnh nhập. Máy kiểm từng dòng và',
    'báo đúng sheet / dòng / cột nếu có lỗi, KHÔNG nhập gì khi còn lỗi.',
    '',
    'Ưu tiên: đúng hơn nhiều. 10 camera đối chiếu datasheet có giá trị hơn 50 camera điền theo trí nhớ.',
  ];
  intro.forEach((line, index) => {
    const cell = guide.getCell(index + 1, 1);
    cell.value = line;
    if (index === 0) cell.font = { bold: true, size: 14 };
  });

  let row = intro.length + 2;
  for (const sheet of SHEETS) {
    guide.getCell(row, 1).value = `Sheet ${sheet.name}`;
    guide.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    ['Cột', 'Cách điền', 'Mức', 'Giải thích'].forEach((label, index) => {
      const cell = guide.getCell(row, index + 1);
      cell.value = label;
      cell.font = { bold: true };
    });
    row += 1;
    for (const column of sheet.columns) {
      guide.getCell(row, 1).value = column.header.replace(/\n/g, ' ');
      guide.getCell(row, 2).value = column.choices
        ? `Chọn: ${Object.keys(column.choices).join(' / ')}`
        : column.type === 'text'
          ? 'Chữ'
          : column.type === 'integer'
            ? 'Số nguyên'
            : 'Số';
      guide.getCell(row, 3).value = column.required ? 'BẮT BUỘC' : 'tùy chọn';
      guide.getCell(row, 4).value = column.help;
      guide.getRow(row).alignment = { vertical: 'top', wrapText: true };
      row += 1;
    }
    row += 1;
  }

  for (const sheet of SHEETS) addDataSheet(workbook, sheet);
  return workbook;
}

function addDataSheet(workbook: ExcelJS.Workbook, sheet: SheetDef) {
  const ws = workbook.addWorksheet(sheet.name, { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });

  sheet.columns.forEach((column, index) => {
    const col = index + 1;
    ws.getColumn(col).width = Math.max(14, ...column.header.split('\n').map((part) => part.length + 4));

    const header = ws.getCell(1, col);
    header.value = column.header;
    header.font = { bold: true };
    header.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column.required ? 'FFFDE2E2' : 'FFE8EEF5' } };

    const need = ws.getCell(2, col);
    need.value = column.required ? 'BẮT BUỘC' : 'tùy chọn';
    need.font = { bold: column.required, color: { argb: column.required ? 'FFC0262D' : 'FF64748B' } };
    need.alignment = { horizontal: 'center' };
    header.note = column.help;

    const example = ws.getCell(3, col);
    if (column.example !== undefined) {
      example.value = column.target === 'brand' ? `${EXAMPLE_MARK} ${column.example}` : column.example;
    }
    example.font = { italic: true, color: { argb: 'FF94A3B8' } };

    if (column.choices && column.type === 'choice') {
      const letter = columnLetter(col);
      // Danh sách ghi thẳng trong công thức: tổng độ dài phải dưới 255 ký tự.
      const list = `"${Object.keys(column.choices).join(',')}"`;
      for (let r = 3; r <= VALIDATED_ROWS; r += 1) {
        ws.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [list],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: `Chọn một trong: ${Object.keys(column.choices).join(' / ')}`,
        };
      }
    }
  });
  ws.getRow(1).height = 36;
}

/**
 * Đọc các sheet thiết bị. Sheet không có trong file thì bỏ qua (cho phép gửi
 * file chỉ có sheet CAMERA). Thiếu cột BẮT BUỘC thì báo lỗi ngay, không đoán.
 */
export async function readWorkbook(filePath: string): Promise<{ sheet: SheetDef; rows: SheetRow[] }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return readSheets(workbook);
}

export function readSheets(workbook: ExcelJS.Workbook): { sheet: SheetDef; rows: SheetRow[] }[] {
  const result: { sheet: SheetDef; rows: SheetRow[] }[] = [];

  for (const sheet of SHEETS) {
    const ws = workbook.getWorksheet(sheet.name);
    if (!ws) continue;

    const headerIndex = new Map<string, number>();
    ws.getRow(1).eachCell((cell, index) => headerIndex.set(normalizeHeader(cellText(cell.value)), index));

    const missing = sheet.columns.filter((c) => c.required && !headerIndex.has(normalizeHeader(c.header)));
    if (missing.length > 0) {
      throw new Error(
        `Sheet ${sheet.name} thiếu cột: ${missing.map((c) => c.header.replace(/\n/g, ' ')).join(', ')}.\n` +
          'File này không theo mẫu mới? Chạy: npm run import:components:template'
      );
    }

    const rows: SheetRow[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const cells: Record<string, string> = {};
      for (const column of sheet.columns) {
        const index = headerIndex.get(normalizeHeader(column.header));
        cells[column.target] = index === undefined ? '' : cellText(row.getCell(index).value);
      }
      rows.push({ row: rowNumber, cells });
    });
    result.push({ sheet, rows });
  }

  return result;
}
