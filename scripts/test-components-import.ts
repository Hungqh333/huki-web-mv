/**
 * Test công cụ nhập catalog linh kiện từ Excel (V1c mục C1).
 *
 * Bốn thứ phải đúng:
 *  1. Dòng sai bị bắt TRƯỚC khi sinh SQL, và lỗi chỉ đúng sheet / dòng / cột.
 *  2. Các phép quy đổi (vòng ảnh mm → cỡ cảm biến, pixel → MP) thận trọng.
 *  3. Mọi khoá spec bộ nhập ghi ra đều có trong SPEC_FIELDS — nếu không, lần
 *     đầu admin bấm Lưu ở trang quản trị sẽ âm thầm xoá khoá đó.
 *  4. SQL chạy được thật trên Postgres, chạy lại không nhân bản.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import ExcelJS from 'exceljs';

import {
  EXAMPLE_MARK,
  SHEETS,
  closestSensorFormat,
  componentCode,
  imageCircleFormat,
  parseSheet,
  parseWorkbook,
  toSql,
  type SheetDef,
  type SheetRow,
} from './lib/components-io';
import { buildTemplate, readSheets } from './lib/components-workbook';
import { COMPONENT_KINDS, SPEC_FIELDS } from '../src/lib/components/specs';

const sheet = (kind: string): SheetDef => SHEETS.find((s) => s.kind === kind)!;

/** Dòng hợp lệ của từng sheet, dựng từ cột `example` rồi ghi đè. */
function rowOf(kind: string, overrides: Record<string, string> = {}, row = 4): SheetRow {
  const cells: Record<string, string> = {};
  for (const column of sheet(kind).columns) cells[column.target] = column.example === undefined ? '' : String(column.example);
  return { row, cells: { ...cells, ...overrides } };
}

test('dòng ví dụ hợp lệ ở cả bốn sheet — file mẫu không tự mâu thuẫn', () => {
  for (const def of SHEETS) {
    const { components, problems } = parseSheet(def, [rowOf(def.kind)]);
    assert.deepEqual(problems, [], `${def.name}: ${JSON.stringify(problems)}`);
    assert.equal(components.length, 1);
  }
});

test('dòng bắt đầu bằng dấu ví dụ và dòng trống bị bỏ qua', () => {
  const example = rowOf('camera', { brand: `${EXAMPLE_MARK} Basler` }, 3);
  const blank: SheetRow = { row: 5, cells: Object.fromEntries(sheet('camera').columns.map((c) => [c.target, ''])) };
  const { components, problems } = parseSheet(sheet('camera'), [example, blank]);
  assert.equal(components.length, 0);
  assert.deepEqual(problems, []);
});

test('mọi khoá spec bộ nhập ghi ra đều có trong SPEC_FIELDS của đúng loại', () => {
  const rows: Record<string, SheetRow> = {
    camera: rowOf('camera', { 'spec.pixel_format': 'Mono8', 'spec.ip_rating': 'ip67' }),
    lens: rowOf('lens', { 'spec.wd_max_mm': '500', 'spec.magnification': '0.5' }),
    light: rowOf('light', { 'spec.wavelength_nm': '625', 'spec.size_short_mm': '50', 'spec.wd_min_mm': '10', 'spec.wd_max_mm': '200', 'spec.ip_rating': 'IP65' }),
    controller: rowOf('controller', { 'spec.gpu': 'RTX 4000', 'spec.max_cameras': '4' }),
  };
  for (const def of SHEETS) {
    const [component] = parseSheet(def, [rows[def.kind]]).components;
    const allowed = new Set(SPEC_FIELDS[def.kind].map((f) => f.key));
    for (const key of Object.keys(component.spec)) {
      assert.ok(allowed.has(key), `${def.name}: khoa spec "${key}" khong co trong SPEC_FIELDS.${def.kind}`);
    }
  }
});

test('camera area scan: tính MP từ pixel, suy khoá resolution_w_px', () => {
  const [camera] = parseSheet(sheet('camera'), [rowOf('camera')]).components;
  assert.equal(camera.spec.camera_type, 'area');
  assert.equal(camera.spec.resolution_w_px, 2448);
  assert.equal(camera.spec.resolution_mp, 5);
  assert.equal(camera.spec.shutter, 'global');
  assert.equal(camera.spec.trigger_io, 'yes');
  assert.equal(camera.code, 'CAM-BASLER-A2A2440-20GMPRO');
});

test('cỡ cảm biến ghi lệch với pixel × pitch bị bắt — đúng lỗi của mockup (5472×3648 × 2,4 µm ghi 1.1")', () => {
  assert.equal(closestSensorFormat(5472, 3648, 2.4), '1');
  const { problems } = parseSheet(sheet('camera'), [
    rowOf('camera', { 'derive.width_px': '5472', 'spec.resolution_h_px': '3648', 'spec.pixel_size_um': '2.4', 'spec.sensor_format': '1.1' }),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /gần cỡ 1"/);
  assert.match(problems[0].column, /Cỡ cảm biến/);
});

test('camera line scan: pixel một hàng thành line_width_px, cột chỉ của area scan phải để trống', () => {
  const line = rowOf('camera', {
    'spec.camera_type': 'Line scan',
    'derive.width_px': '4096',
    'spec.resolution_h_px': '',
    'spec.sensor_format': '',
    'spec.max_fps': '',
    'spec.max_line_rate_khz': '45',
  });
  const ok = parseSheet(sheet('camera'), [line]);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.components[0].spec.line_width_px, 4096);
  assert.equal(ok.components[0].spec.resolution_w_px, undefined);

  const wrong = parseSheet(sheet('camera'), [{ ...line, cells: { ...line.cells, 'spec.sensor_format': '1' } }]);
  assert.match(wrong.problems[0].message, /Line scan không dùng/);
});

test('area scan thiếu pixel dọc hoặc cỡ cảm biến bị báo, không âm thầm bỏ qua', () => {
  const { problems } = parseSheet(sheet('camera'), [rowOf('camera', { 'spec.resolution_h_px': '', 'spec.sensor_format': '' })]);
  const columns = problems.map((p) => p.column);
  assert.ok(columns.some((c) => c.startsWith('Độ phân giải dọc')));
  assert.ok(columns.some((c) => c.startsWith('Cỡ cảm biến')));
});

test('vòng ảnh mm quy ra cỡ cảm biến bằng cách làm tròn XUỐNG', () => {
  assert.equal(imageCircleFormat(11), '2/3', '11 mm vừa phủ 2/3" (duong cheo 11,0)');
  assert.equal(imageCircleFormat(15.9), '2/3', '15,9 mm CHUA phu 1" (16,0)');
  assert.equal(imageCircleFormat(16), '1');
  assert.equal(imageCircleFormat(17.6), '1.1');
  assert.equal(imageCircleFormat(4), null);

  const tiny = parseSheet(sheet('lens'), [rowOf('lens', { 'spec.image_circle_mm': '4' })]);
  assert.match(tiny.problems[0].message, /nhỏ hơn cả cảm biến/);
});

test('ống kính: thiếu tiêu cự / độ phóng đại theo loại, F số và khoảng làm việc điền ngược đều bị bắt', () => {
  const noFocal = parseSheet(sheet('lens'), [rowOf('lens', { 'spec.focal_length_mm': '' })]);
  assert.match(noFocal.problems[0].message, /tiêu cự/);

  const tele = parseSheet(sheet('lens'), [rowOf('lens', { 'spec.lens_type': 'Telecentric', 'spec.focal_length_mm': '' })]);
  assert.match(tele.problems[0].message, /độ phóng đại/);

  const reversed = parseSheet(sheet('lens'), [rowOf('lens', { 'spec.f_number_min': '16', 'spec.f_number_max': '1.4', 'spec.wd_max_mm': '50' })]);
  assert.equal(reversed.problems.length, 2);
});

test('ô chọn nhận cả nhãn lẫn giá trị, không phân biệt hoa thường; giá trị lạ bị báo kèm danh sách', () => {
  const [light] = parseSheet(sheet('light'), [rowOf('light', { 'spec.light_type': 'backlight', 'spec.color': 'xanh DƯƠNG' })]).components;
  assert.equal(light.spec.light_type, 'backlight');
  assert.equal(light.spec.color, 'blue');

  const { problems } = parseSheet(sheet('camera'), [rowOf('camera', { 'spec.interface': 'CameraLink' })]);
  assert.match(problems[0].message, /CameraLink-Base/);
});

test('số kiểu Việt Nam: giá có dấu chấm ngăn nghìn, số lẻ dùng dấu phẩy; số âm và chữ bị báo', () => {
  const [camera] = parseSheet(sheet('camera'), [rowOf('camera', { price_vnd: '18.500.000', 'spec.pixel_size_um': '3,45' })]).components;
  assert.equal(camera.price_vnd, 18500000);
  assert.equal(camera.spec.pixel_size_um, 3.45);

  const bad = parseSheet(sheet('camera'), [rowOf('camera', { lead_time_days: '-3', 'spec.max_fps': 'nhanh' })]);
  assert.equal(bad.problems.length, 2);
});

test('máy tính: danh sách chuẩn giao tiếp tách dấu phẩy, tên lạ bị báo', () => {
  const [pc] = parseSheet(sheet('controller'), [rowOf('controller', { 'spec.interfaces': 'GigE, 5GigE' })]).components;
  assert.deepEqual(pc.spec.interfaces, ['GigE', '5GigE']);
  const bad = parseSheet(sheet('controller'), [rowOf('controller', { 'spec.interfaces': 'GigE, USB4' })]);
  assert.match(bad.problems[0].message, /USB4/);
});

test('mã: tự sinh bỏ dấu tiếng Việt; mã tự nhập được viết hoa; trùng mã giữa hai dòng bị báo', () => {
  assert.equal(componentCode('LIGHT', 'Đèn Việt', 'LDR2-100SW2'), 'LIGHT-DEN-VIET-LDR2-100SW2');
  const [own] = parseSheet(sheet('camera'), [rowOf('camera', { code: 'cam-basler-a2a2590-gm' })]).components;
  assert.equal(own.code, 'CAM-BASLER-A2A2590-GM');

  const { problems } = parseWorkbook([{ sheet: sheet('camera'), rows: [rowOf('camera', {}, 4), rowOf('camera', {}, 5)] }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /trùng với sheet CAMERA dòng 4/);
});

test('file mẫu sinh ra đọc lại được: đủ sheet, đủ cột, dòng ví dụ bị bỏ qua', async () => {
  const workbook = await buildTemplate();
  const buffer = await workbook.xlsx.writeBuffer();
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(buffer);

  const sheets = readSheets(reread);
  assert.deepEqual(sheets.map((s) => s.sheet.name), SHEETS.map((s) => s.name));
  const { components, problems } = parseWorkbook(sheets);
  assert.deepEqual(problems, []);
  assert.equal(components.length, 0, 'chi co dong vi du');

  // Điền một dòng thật vào dòng 4 rồi đọc lại.
  const ws = reread.getWorksheet('CAMERA')!;
  sheet('camera').columns.forEach((column, index) => {
    if (column.example !== undefined) ws.getCell(4, index + 1).value = column.example;
  });
  const filled = parseWorkbook(readSheets(reread));
  assert.deepEqual(filled.problems, []);
  assert.equal(filled.components.length, 1);
});

test('ô chọn trong file mẫu: danh sách không vượt giới hạn 255 ký tự của Excel', () => {
  for (const def of SHEETS) {
    for (const column of def.columns) {
      if (column.type !== 'choice') continue;
      const length = Object.keys(column.choices!).join(',').length + 2;
      assert.ok(length <= 255, `${def.name} / ${column.header}: ${length} ky tu`);
    }
  }
});

// ------------------------------------------------------------- Postgres --

const SUPABASE_DIR = join(process.cwd(), 'supabase');
const read = (...parts: string[]) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');
const strip = (sql: string) => sql.replace(/create extension if not exists pgcrypto;/g, '');

let db: PGlite;

before(async () => {
  db = await PGlite.create();
  await db.exec(read('tests', 'auth_stub.sql'));
  for (const file of readdirSync(join(SUPABASE_DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(strip(read('migrations', file)));
  }
  await db.exec(read('seed_components.sql'));
});

after(async () => {
  await db?.close();
});

test('SQL sinh ra chạy được trên Postgres, chạy lần hai cập nhật chứ không nhân bản, không bật lại thiết bị đã tắt', async () => {
  const quoted = rowOf('camera', { notes_vi: "Dùng ở dự án 'nắp nhựa'", supplier: "O'Neil" });
  const { components, problems } = parseWorkbook(
    SHEETS.map((def) => ({ sheet: def, rows: [def.kind === 'camera' ? quoted : rowOf(def.kind)] }))
  );
  assert.deepEqual(problems, []);

  const before = (await db.query<{ n: number }>('select count(*)::int as n from public.components')).rows[0].n;
  await db.exec(toSql(components));
  const afterFirst = (await db.query<{ n: number }>('select count(*)::int as n from public.components')).rows[0].n;
  assert.equal(afterFirst, before + 4);

  await db.exec(`update public.components set is_active = false where code = '${components[0].code}'`);
  const changed = components.map((c, i) => (i === 0 ? { ...c, price_vnd: 19000000 } : c));
  await db.exec(toSql(changed));

  const { rows } = await db.query<{ n: number; price_vnd: string; is_active: boolean; supplier: string; spec: Record<string, unknown> }>(
    `select (select count(*)::int from public.components) as n, price_vnd, is_active, supplier, spec
     from public.components where code = '${components[0].code}'`
  );
  assert.equal(rows[0].n, afterFirst, 'chay lai khong nhan ban');
  assert.equal(Number(rows[0].price_vnd), 19000000);
  assert.equal(rows[0].is_active, false, 'thiet bi admin da tat khong tu bat lai');
  assert.equal(rows[0].supplier, "O'Neil");
  assert.equal(rows[0].spec.shutter, 'global');
});

test('ràng buộc database chặn thời gian giao hàng / số dự án âm dù có ai bỏ qua bộ nhập', async () => {
  await assert.rejects(db.exec(`update public.components set lead_time_days = -1 where code = 'CAM-BASLER-A2A2590-GM'`));
  await assert.rejects(db.exec(`update public.components set used_in_projects = -1 where code = 'CAM-BASLER-A2A2590-GM'`));
});

test('trang quản trị có nhãn vi/en cho mọi loại linh kiện và mọi khoá spec', () => {
  for (const lang of ['vi', 'en']) {
    const messages = JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${lang}.json`), 'utf8'));
    const labels = messages.admin.components;
    for (const kind of COMPONENT_KINDS) assert.ok(labels.kinds[kind], `${lang}: thieu kinds.${kind}`);
    for (const field of Object.values(SPEC_FIELDS).flat()) {
      assert.ok(labels.spec[field.key], `${lang}: thieu spec.${field.key}`);
    }
    for (const key of ['fieldLeadTime', 'fieldSupplier', 'fieldUsedInProjects']) assert.ok(labels[key], `${lang}: thieu ${key}`);
  }
});
