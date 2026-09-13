import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APPLICATION_SHORTCUT_ORDER,
  APPLICATION_TYPES,
  applicationCardEntry,
  freeTextEntry,
} from '../src/lib/visionEntry';

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
