/**
 * Khớp ảnh mẫu chiếu sáng với bài toán (chốt 2026-10-23 Q2) và đọc file nhãn CSV (Q4).
 *
 *   npx tsx --test scripts/test-sample-match.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchSample, rankSamples, type SampleLabels, type SampleQuery } from '../src/lib/vision/sampleMatch';
import { parseSampleCsv } from '../src/lib/vision/sampleCsv';

const Q: SampleQuery = { task: 'inspect', feature: 'solder', material: 'pcb', finish: 'semi_gloss', shape: 'stepped', lightTypes: ['dome', 'multi_angle_ring'] };
const s = (over: Partial<SampleLabels> & { id: string }) =>
  ({ task: 'inspect', feature: 'solder', material: 'pcb', finish: 'semi_gloss', shape: 'stepped', lightType: 'dome', ...over }) as SampleLabels & { id: string };

test('khớp: trùng "cần thấy gì" đếm nhãn trùng; không trùng mà cùng vật liệu + bề mặt → tham khảo chung', () => {
  assert.deepEqual(matchSample(s({ id: 'a' }), Q), { kind: 'exact', score: 5, total: 5 });
  assert.deepEqual(matchSample(s({ id: 'b', lightType: 'ring', shape: 'flat' }), Q), { kind: 'exact', score: 3, total: 5 });
  assert.equal(matchSample(s({ id: 'c', task: 'presence' }), Q)?.kind, 'general', 'khac bai toan → khong tinh la trung, chi la tham khao chung');
  assert.deepEqual(matchSample(s({ id: 'd', feature: null }), Q), { kind: 'general', score: 4, total: 4 });
  assert.equal(matchSample(s({ id: 'e', feature: null, material: 'glass' }), Q), null);
});

test('xếp: chỉ nhóm trùng khi có; tỉ lệ khớp cao trước; đèn gợi ý trước đèn thay thế', () => {
  const list = [
    s({ id: 'general', feature: null }),
    s({ id: 'alt', lightType: 'multi_angle_ring' }),
    s({ id: 'weak', lightType: 'ring', shape: 'flat' }),
    s({ id: 'best' }),
  ];
  assert.deepEqual(rankSamples(list, Q).map((x) => x.id), ['best', 'alt', 'weak']);
  // Không có ảnh trùng "cần thấy gì" → mọi ảnh cùng vật liệu + bề mặt thành ảnh tham khảo chung.
  const general = rankSamples(list, { ...Q, feature: 'scratch' });
  assert.deepEqual(general.map((x) => x.id), ['general', 'best', 'alt', 'weak']);
  assert.ok(general.every((x) => x.match.kind === 'general'));
});

test('CSV nhãn: đọc đúng cột, kiểm khoá theo trang Chọn đèn, báo dòng lỗi', () => {
  const csv = [
    '﻿file,nguon,task,feature,material,finish,shape,feature_color,background_color,light_type,light_color,light_model,goc_chieu,khoang_cach_mm,phoi_sang_us,camera,ong_kinh,ghi_chu',
    'ccs/a.jpg,https://x,inspect,solder,pcb,semi_gloss,stepped,gray,green,dome,white,HPD2,vòm,80,2000,mono 5MP,f25,"Bản mạch, mối hàn"',
    'b.jpg,tự chụp,,,metal_cast,matte,,,gray,ring,,,,,,,,',
    'c.jpg,,inspect,hole,pcb,matte,,,,ring,,,,,,,,',
    'd.jpg,,,,,,,,,laser,,,,,,,,',
  ].join('\r\n');
  const { rows, errors } = parseSampleCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    file: 'a.jpg',
    task: 'inspect',
    feature: 'solder',
    material: 'pcb',
    finish: 'semi_gloss',
    shape: 'stepped',
    featureColor: 'gray',
    backgroundColor: 'green',
    lightType: 'dome',
    lightColor: 'white',
    lightModel: 'HPD2',
    angleNote: 'vòm',
    distanceMm: 80,
    exposureUs: 2000,
    camera: 'mono 5MP',
    lens: 'f25',
    source: 'https://x',
    caption: 'Bản mạch, mối hàn',
  });
  assert.equal(rows[1].feature, null);
  assert.deepEqual(errors.map((e) => `${e.line}:${e.field}`), ['4:feature', '5:light_type']);
});
