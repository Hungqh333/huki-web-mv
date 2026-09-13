/**
 * Chạy chuỗi chọn thiết bị trên ĐÚNG dữ liệu seed thật.
 *
 * Các test ở test-components.ts dùng thiết bị giả để kiểm từng quy tắc. Test
 * này thì nạp catalog thật từ seed_components.sql rồi đi hết chuỗi: tính độ
 * phân giải cần thiết → chọn camera → tính tiêu cự theo cảm biến của chính
 * camera đó → chọn ống kính. Đây là thứ gần nhất với việc bấm tay trên giao
 * diện, và nó bắt được cả trường hợp seed lệch khỏi logic chọn.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

import { deriveMetrics } from '../src/lib/selector/derive';
import { pickCamera, pickController, pickLens } from '../src/lib/components/match';
import { specString, type Component } from '../src/lib/components/specs';

const SUPABASE_DIR = join(process.cwd(), 'supabase');
const read = (...parts: string[]) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');
const strip = (sql: string) => sql.replace(/create extension if not exists pgcrypto;/g, '');

// tsx biên dịch .ts sang CJS nên không dùng được top-level await.
let db: PGlite;
let components: Component[] = [];

before(async () => {
  db = await PGlite.create();
  await db.exec(read('tests', 'auth_stub.sql'));

  const migrations = readdirSync(join(SUPABASE_DIR, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrations) {
    await db.exec(strip(read('migrations', file)));
  }
  await db.exec(read('seed_components.sql'));

  const { rows } = await db.query<Component>(
    `select id, code, kind, brand, model, spec, price_vnd, datasheet_url, source,
            notes_vi, notes_en, is_active, sort_order
     from public.components order by kind, sort_order`
  );
  components = rows;
});

after(async () => {
  await db?.close();
});

test('seed nạp đủ cả năm loại linh kiện', () => {
  const kinds = new Set(components.map((c) => c.kind));
  assert.ok(kinds.has('camera'), 'phai co camera');
  assert.ok(kinds.has('lens'), 'phai co ong kinh');
  assert.ok(kinds.has('light'), 'phai co den');
  assert.ok(kinds.has('controller'), 'phai co may tinh');
  assert.ok(components.length >= 20, `mong doi >= 20 thiet bi, co ${components.length}`);
});

test('mọi dòng seed đều đang là "chưa kiểm chứng"', () => {
  // Neu ai do doi mot dong sang 'datasheet' thi phai la co chu dich, khong phai
  // vo tinh — test nay bat dau la loi nhac, khong phai chan.
  const verified = components.filter((c) => c.source !== 'unverified');
  assert.equal(
    verified.length,
    0,
    `co ${verified.length} dong da danh dau da kiem chung: ${verified.map((c) => c.code).join(', ')}`
  );
});

test('chuỗi thật: bài ngoại quan 100×80 mm, lỗi 0,2 mm, cách 300 mm', () => {
  const { context } = deriveMetrics({
    fov_width_mm: 100,
    fov_height_mm: 80,
    defect_min_size_mm: 0.2,
    working_distance_mm: 300,
    throughput_ppm: 60,
  });

  // 100 mm / (0,2 mm / 3 px) = 1500 px truc dai -> 15 px/mm -> 1500 x 1200 = 1,8 MP
  assert.equal(context.required_resolution_px, 1500);
  assert.equal(context.required_sensor_mp, 1.8);
  assert.equal(context.data_rate_mbytes_s, 1.8, '60 sp/phut = 1 fps, anh don sac');

  const camera = pickCamera(components, {
    requiredMp: context.required_sensor_mp as number,
    dataRateMbytesS: context.data_rate_mbytes_s as number,
    needsColor: false,
  });

  assert.ok(camera.chosen, 'phai chon duoc camera tu catalog that');
  const mp = camera.chosen!.spec.resolution_mp as number;
  assert.ok(mp >= 1.8, 'du do phan giai');
  assert.ok(mp <= 5, `khong duoc chon du: chon ${mp} MP cho bai can 1,8 MP`);

  // Tieu cu phu thuoc cam bien cua CHINH camera vua chon.
  const lens = pickLens(components, {
    camera: camera.chosen,
    fovWidthMm: 100,
    workingDistanceMm: 300,
    needTelecentric: false,
  });

  assert.ok(lens.fit.targetFocalMm !== null, 'phai tinh duoc tieu cu');
  assert.ok(lens.chosen, 'phai chon duoc ong kinh');

  const focal = lens.chosen!.spec.focal_length_mm as number;
  const target = lens.fit.targetFocalMm!;
  // Khong co ong kinh nao khop tuyet doi, nhung phai la cai gan nhat trong catalog.
  const closest = Math.min(
    ...components
      .filter((c) => c.kind === 'lens' && c.spec.lens_type === 'fixed')
      .map((c) => Math.abs((c.spec.focal_length_mm as number) - target))
  );
  assert.equal(Math.abs(focal - target), closest, 'phai la ong kinh gan nhat');
});

test('chuỗi thật: đổi sang camera lớn hơn thì tiêu cự cần thiết tăng theo', () => {
  const small = components.find((c) => c.code === 'CAM-IRAYPLE-A5031MG')!; // 1/1.8"
  const large = components.find((c) => c.code === 'CAM-HIK-MVCS200-GC')!; // 1"

  const withSmall = pickLens(components, {
    camera: small,
    fovWidthMm: 100,
    workingDistanceMm: 300,
    needTelecentric: false,
  });
  const withLarge = pickLens(components, {
    camera: large,
    fovWidthMm: 100,
    workingDistanceMm: 300,
    needTelecentric: false,
  });

  assert.ok(
    withLarge.fit.targetFocalMm! > withSmall.fit.targetFocalMm!,
    'cam bien to hon thi can tieu cu dai hon o cung FOV va khoang cach'
  );

  // Cam bien 1 inch: moi ong kinh vong anh 2/3 inch phai bi loai han.
  const options = [withLarge.chosen, ...withLarge.alternatives].filter(Boolean) as Component[];
  assert.ok(options.length > 0, 'van phai con ong kinh dung duoc');
  assert.ok(
    options.every((lens) => specString(lens.spec, 'image_circle') === '1' || specString(lens.spec, 'image_circle') === '4/3'),
    'khong duoc de lot ong kinh vong anh nho hon cam bien'
  );
});

test('chuỗi thật: bài cần deep learning thì chọn máy có GPU', () => {
  const camera = components.find((c) => c.code === 'CAM-HIK-MVCS050-GM')!;

  const withoutDl = pickController(components, {
    interfaceName: specString(camera.spec, 'interface'),
    dataRateMbytesS: 20,
    needsGpu: false,
  });
  const withDl = pickController(components, {
    interfaceName: specString(camera.spec, 'interface'),
    dataRateMbytesS: 20,
    needsGpu: true,
  });

  assert.ok(withoutDl.chosen, 'phai chon duoc may');
  assert.equal(withoutDl.chosen!.spec.gpu, undefined, 'khong can DL thi khong ban may co GPU');
  assert.ok(withDl.chosen?.spec.gpu, 'can DL thi phai co GPU');
});

test('chuỗi thật: sửa chiều cao FOV thì camera gợi ý cho bài căn chỉnh đổi theo', () => {
  /* Trước khi sửa, bài căn chỉnh không hỏi chiều cao nên FOV 100 × 50 mm bị
     tính như 100 × 100 mm. Hai lời gọi dưới đây là hành vi CŨ và MỚI trên cùng
     catalog thật: chọn theo 9 MP là chọn dư. */
  const base = { fov_width_mm: 100, tolerance_mm: 0.1, working_distance_mm: 300, throughput_ppm: 60 };
  const before = deriveMetrics({ ...base, fov_height_mm: 100 }, 3, 'alignment').context;
  const after = deriveMetrics({ ...base, fov_height_mm: 50 }, 3, 'alignment').context;

  assert.equal(before.required_sensor_mp, 9);
  assert.equal(after.required_sensor_mp, 4.5);

  const pick = (ctx: typeof after) =>
    pickCamera(components, {
      requiredMp: ctx.required_sensor_mp as number,
      dataRateMbytesS: ctx.data_rate_mbytes_s as number,
      needsColor: false,
    }).chosen;

  const oldCamera = pick(before);
  const newCamera = pick(after);
  assert.ok(oldCamera && newCamera, 'ca hai lan deu phai chon duoc camera');

  const oldMp = oldCamera.spec.resolution_mp as number;
  const newMp = newCamera.spec.resolution_mp as number;
  assert.ok(newMp >= 4.5, `du do phan giai: ${newCamera.code} ${newMp} MP`);
  assert.notEqual(newCamera.code, oldCamera.code, `camera phai doi: ${oldCamera.code} -> ${newCamera.code}`);
  assert.ok(newMp < oldMp, `phai nho hon: ${oldCamera.code} ${oldMp} MP -> ${newCamera.code} ${newMp} MP`);
  console.log(`  camera: ${oldCamera.code} (${oldMp} MP) -> ${newCamera.code} (${newMp} MP)`);
});
