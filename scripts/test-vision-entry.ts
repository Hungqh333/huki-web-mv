import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APPLICATION_SHORTCUT_ORDER,
  APPLICATION_TYPES,
  applicationCardEntry,
  freeTextEntry,
} from '../src/lib/visionEntry';
import { APPLICATION_TASK_SLUG } from '../src/lib/application-type-map';
import { REQUIREMENT_ROUTE, isApplicationType, requirementHrefFor } from '../src/lib/requirement/draft';

const PAYLOAD_KEYS = ['applicationType', 'rawText', 'source'];

function loadMessages(locale: 'vi' | 'en') {
  return JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
}

test('ApplicationType có đúng 8 giá trị của spec', () => {
  assert.deepEqual(
    [...APPLICATION_TYPES],
    ['AppearanceInspection', 'Measurement', 'OCR', '3D', 'RobotGuidance', 'AIInspection', 'AssemblyInspection', 'Other']
  );
});

test('trang chủ có đủ 8 thẻ, mỗi loại một thẻ', () => {
  assert.equal(APPLICATION_SHORTCUT_ORDER.length, 8);
  assert.deepEqual([...APPLICATION_SHORTCUT_ORDER].sort(), [...APPLICATION_TYPES].sort());
});

test('CTA: payload freeText, trim văn bản, chưa đoán applicationType', () => {
  const payload = freeTextEntry('  kiểm tra ngoại quan 380 × 280 mm \n')!;
  assert.deepEqual(Object.keys(payload).sort(), PAYLOAD_KEYS);
  assert.deepEqual(payload, {
    source: 'freeText',
    rawText: 'kiểm tra ngoại quan 380 × 280 mm',
    applicationType: null,
  });

  assert.equal(freeTextEntry(''), null);
  assert.equal(freeTextEntry('   \n\t'), null);
});

test('thẻ ứng dụng: payload applicationCard, không có rawText', () => {
  for (const type of APPLICATION_TYPES) {
    const payload = applicationCardEntry(type);
    assert.deepEqual(Object.keys(payload).sort(), PAYLOAD_KEYS);
    assert.deepEqual(payload, { source: 'applicationCard', rawText: null, applicationType: type });
  }
});

test('vi và en có nhãn cho mọi thẻ; key home.* cũ vẫn còn cho /home-old', () => {
  for (const locale of ['vi', 'en'] as const) {
    const home = loadMessages(locale).home;
    for (const type of APPLICATION_TYPES) {
      assert.ok(home.entry.apps[type]?.title, `${locale}: thieu home.entry.apps.${type}.title`);
    }
    for (const tool of ['visionDesigner', 'engineeringTools', 'knowledgeBase']) {
      assert.ok(home.entry.tools[tool]?.title, `${locale}: thieu home.entry.tools.${tool}`);
    }
    for (const key of ['title', 'subtitle', 'cta', 'ctaSecondary', 'modulesHeading', 'modulesSub', 'open']) {
      assert.equal(typeof home[key], 'string', `${locale}: key cu home.${key} bi xoa`);
    }
    for (const mod of ['handbook', 'selector', 'kpi']) {
      assert.ok(home.modules[mod]?.title, `${locale}: key cu home.modules.${mod} bi xoa`);
    }
  }
});

// ----------------------------------------------- THẺ → BẢNG YÊU CẦU (spec §10.1) --

test('cả 8 thẻ vào cùng một luồng: bảng tóm tắt yêu cầu với loại điền sẵn', () => {
  for (const type of APPLICATION_SHORTCUT_ORDER) {
    const href = requirementHrefFor(type);
    const url = new URL(href, 'http://localhost');
    assert.equal(url.pathname, REQUIREMENT_ROUTE, type);
    const app = url.searchParams.get('app');
    assert.equal(app, type, `${type}: tham so app doc lai dung (ke ca '3D')`);
    assert.ok(isApplicationType(app), type);
  }
});

// ------------------------------------ APPLICATION TYPE → BÀI TOÁN BỘ CHỌN (adapter) --

test('mapping loại ứng dụng → task slug đúng bảng đã duyệt', () => {
  assert.deepEqual(APPLICATION_TASK_SLUG, {
    Measurement: '2d-measurement',
    AppearanceInspection: 'appearance-inspection',
    '3D': '3d-measurement',
    RobotGuidance: 'robot-guidance',
    OCR: 'ocr-ocv',
    AIInspection: null,
    AssemblyInspection: null,
    Other: null,
  });
  assert.deepEqual(Object.keys(APPLICATION_TASK_SLUG).sort(), [...APPLICATION_TYPES].sort(), 'du 8 loai');
});

test('mọi slug trong mapping đều có trong task_types của seed', () => {
  // Chặn gõ nhầm slug: link sai sẽ ra 404 mà không test nào khác bắt được.
  const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  const inserts = seed.split(/insert into public\.task_types/i).slice(1).map((part) => part.split(/on conflict/i)[0]);
  const slugs = new Set(inserts.flatMap((block) => [...block.matchAll(/^\s*\('([a-z0-9-]+)',/gm)].map((m) => m[1])));
  assert.ok(slugs.has('alignment') && slugs.has('barcode-reading'), 'doc duoc seed');
  for (const slug of Object.values(APPLICATION_TASK_SLUG)) {
    if (slug) assert.ok(slugs.has(slug), `slug ${slug} khong co trong task_types`);
  }
});

test('nhãn "Hỗ trợ một phần" và câu hỏi thay bản nháp có ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const entry = loadMessages(locale).home.entry;
    assert.ok(entry.partialSupport, `${locale}: thieu home.entry.partialSupport`);
    assert.ok(entry.replaceDraft, `${locale}: thieu home.entry.replaceDraft`);
    assert.equal(entry.comingSoon, undefined, `${locale}: nhan "Sap co" khong con dung`);
  }
});
