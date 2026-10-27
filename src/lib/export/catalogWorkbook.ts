import ExcelJS from 'exceljs';
import type { ComponentKind } from '@/lib/components/specs';
import { COMPONENT_KINDS } from '@/lib/components/specs';
import { specPairs, summaryPairs, type CatalogItem } from '@/lib/catalog/catalog';

/**
 * File Excel "Thiết bị đã chọn" của trang Danh mục (chốt 2026-10-27 Q5).
 * Sheet 1: danh sách gọn (loại / mã / hãng / model / thông số chính / giá / NCC / giao /
 * nguồn thông số / datasheet). Mỗi loại thêm một sheet đủ thông số, mỗi thông số một cột.
 * Thiếu giá để trống, không ghi 0.
 */

const MONEY = '#,##0';

export type CatalogLabels = {
  kind: (kind: ComponentKind) => string;
  spec: (key: string) => string;
  value: (key: string, value: string) => string;
  source: (source: string) => string;
  /** Tiêu đề cột / dòng đầu file: title, code, brand, model, summary, price, supplier, leadTime, source, datasheet, kind, days. */
  text: (key: string, values?: Record<string, string | number>) => string;
};

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0F2FE' } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: 'thin' } };
  });
}

const join = (labels: CatalogLabels, key: string, values: string[]) => values.map((v) => labels.value(key, v)).join(', ');

export async function buildCatalogWorkbook(items: CatalogItem[], labels: CatalogLabels, exportedAt: Date): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Machine Vision Hub';
  workbook.created = exportedAt;

  const ws = workbook.addWorksheet(labels.text('sheetList'), { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = [{ width: 16 }, { width: 26 }, { width: 14 }, { width: 28 }, { width: 48 }, { width: 15 }, { width: 22 }, { width: 10 }, { width: 16 }, { width: 40 }];
  ws.getCell('A1').value = labels.text('title', { count: items.length, date: exportedAt.toISOString().slice(0, 10) });
  ws.getCell('A1').font = { bold: true, size: 14 };

  const header = ws.getRow(3);
  header.values = ['kind', 'code', 'brand', 'model', 'summary', 'price', 'supplier', 'leadTime', 'source', 'datasheet'].map((k) => labels.text(k));
  styleHeader(header);

  items.forEach((item, index) => {
    const row = ws.getRow(4 + index);
    row.values = [
      labels.kind(item.kind),
      item.code,
      item.brand,
      item.model,
      summaryPairs(item)
        .map((p) => `${labels.spec(p.key)} ${join(labels, p.key, p.values)}`)
        .join(' · '),
      item.price_vnd ?? null,
      item.supplier ?? null,
      item.lead_time_days ?? null,
      labels.source(item.source),
      item.datasheet_url ?? null,
    ];
    row.getCell(6).numFmt = MONEY;
    row.getCell(5).alignment = { wrapText: true, vertical: 'top' };
    if (item.datasheet_url) row.getCell(10).value = { text: item.datasheet_url, hyperlink: item.datasheet_url };
  });

  // Một sheet đủ thông số cho mỗi loại có trong danh sách.
  for (const kind of COMPONENT_KINDS) {
    const group = items.filter((i) => i.kind === kind);
    if (!group.length) continue;
    const keys = [...new Set(group.flatMap((i) => specPairs(i).map((p) => p.field.key)))];
    const units = new Map(group.flatMap((i) => specPairs(i).map((p) => [p.field.key, p.field.unit] as const)));
    // Tên sheet Excel tối đa 31 ký tự, không có : \ / ? * [ ].
    const sheet = workbook.addWorksheet(labels.kind(kind).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31), { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
    sheet.columns = [{ width: 26 }, { width: 28 }, ...keys.map(() => ({ width: 16 }))];
    const head = sheet.getRow(1);
    head.values = [labels.text('code'), labels.text('model'), ...keys.map((k) => `${labels.spec(k)}${units.get(k) ? ` (${units.get(k)})` : ''}`)];
    styleHeader(head);
    head.alignment = { wrapText: true, vertical: 'top' };
    group.forEach((item, index) => {
      const values = keys.map((key) => {
        const v = item.spec[key];
        if (typeof v === 'number') return v;
        if (Array.isArray(v)) return join(labels, key, v.map(String));
        return v === undefined || v === null || v === '' ? null : labels.value(key, String(v));
      });
      sheet.getRow(2 + index).values = [item.code, `${item.brand} ${item.model}`, ...values];
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
