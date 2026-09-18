import ExcelJS from 'exceljs';
import type { ConceptDocument, Translate } from './conceptDocument';

/**
 * File Excel BOM gửi mua hàng — V1c mục C6 (spec V1.1 §11.2).
 *
 * Sheet 1: danh mục có giá (Nhóm / Mã hàng / Mô tả / SL / Đơn giá / Thành tiền /
 * Giao hàng / Nhà cung cấp / Luật biện luận). Sheet 2: Giả định & Loại trừ.
 * Thành tiền và tổng là CÔNG THỨC Excel, để mua hàng sửa số lượng / đơn giá
 * ngay trong file mà tổng vẫn đúng. Dòng thiếu giá để trống, không ghi 0.
 */

const MONEY = '#,##0';

export async function buildBomWorkbook(doc: ConceptDocument, t: Translate): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Machine Vision Hub';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(t('export.excel.sheetBom'), { views: [{ state: 'frozen', ySplit: 6 }] });
  ws.columns = [
    { width: 20 },
    { width: 26 },
    { width: 46 },
    { width: 7 },
    { width: 15 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 18 },
  ];

  ws.getCell('A1').value = t('export.excel.title', { project: doc.projectName, rev: doc.revLabel });
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = t('export.meta', { saved: doc.savedAt, ruleset: doc.rulesetSaved ?? doc.rulesetNow, author: doc.author });
  ws.getCell('A3').value = doc.bom
    ? t('export.excel.level', { level: doc.bom.level, margin: doc.bom.margin != null ? doc.bom.margin.toFixed(2) : '—' })
    : t('export.noBom');
  if (doc.hasUnverified) {
    ws.getCell('A4').value = t('export.unverifiedNote');
    ws.getCell('A4').font = { italic: true, color: { argb: 'FFB45309' } };
  }

  const header = ws.getRow(6);
  header.values = ['category', 'code', 'description', 'qty', 'unitPrice', 'amount', 'leadTime', 'supplier', 'rules'].map((key) =>
    t(`export.excel.columns.${key}`)
  );
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  const first = 7;
  (doc.bom?.lines ?? []).forEach((line, index) => {
    const r = first + index;
    const row = ws.getRow(r);
    row.values = [
      line.category,
      line.code,
      `${line.name}${line.unverified ? ' *' : ''}${line.summary ? ` — ${line.summary}` : ''}`,
      line.qty,
      line.unitPrice ?? null,
      null,
      line.leadTime,
      line.supplier,
      line.rules,
    ];
    // Thành tiền là công thức; thiếu đơn giá thì để trống, không ra 0 giả.
    if (line.unitPrice != null) row.getCell(6).value = { formula: `D${r}*E${r}`, result: line.amount ?? undefined };
    row.getCell(5).numFmt = MONEY;
    row.getCell(6).numFmt = MONEY;
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    if (line.placeholder) row.getCell(3).font = { italic: true, color: { argb: 'FFB45309' } };
  });

  const last = first + (doc.bom?.lines.length ?? 0) - 1;
  const totalRow = ws.getRow(last + 2);
  totalRow.getCell(5).value = t('export.excel.total');
  totalRow.getCell(5).font = { bold: true };
  if (doc.bom && doc.bom.lines.length > 0) {
    totalRow.getCell(6).value = { formula: `SUM(F${first}:F${last})`, result: doc.bom.total ?? undefined };
    totalRow.getCell(6).numFmt = MONEY;
    totalRow.getCell(6).font = { bold: true };
  }
  if (doc.bom && doc.bom.missingPrices > 0) {
    totalRow.getCell(7).value = t('export.excel.missingPrices', { count: doc.bom.missingPrices });
    totalRow.getCell(7).font = { italic: true, color: { argb: 'FFB45309' } };
  }

  // ─── Sheet 2: Giả định & Loại trừ ───
  const notes = workbook.addWorksheet(t('export.excel.sheetAssumptions'));
  notes.columns = [{ width: 40 }, { width: 50 }];
  let r = 1;
  const heading = (text: string) => {
    notes.getCell(r, 1).value = text;
    notes.getCell(r, 1).font = { bold: true, size: 12 };
    r += 1;
  };
  heading(t('designer.requirement.bom.assumptionsTitle'));
  notes.getCell(r, 1).value = t('designer.requirement.bom.assumptionsIntro');
  r += 1;
  if (doc.assumptions.length === 0) {
    notes.getCell(r, 1).value = t('designer.requirement.bom.noAssumptions');
    r += 1;
  }
  for (const item of doc.assumptions) {
    notes.getRow(r).values = [item.label, item.value];
    r += 1;
  }
  r += 1;
  heading(t('designer.requirement.bom.exclusionsTitle'));
  for (const item of doc.exclusions) {
    notes.getCell(r, 1).value = `• ${item}`;
    r += 1;
  }
  r += 1;
  notes.getCell(r, 1).value = t('designer.requirement.bom.feasibilityAt');
  notes.getCell(r, 2).value = doc.feasibility.status;
  notes.getCell(r, 2).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
