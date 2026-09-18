/**
 * Concept Report PDF — V1c mục C6. Tách khỏi test-export.ts vì @react-pdf chỉ
 * chạy ở ESM (tsx dịch .ts sang CJS). Chạy trong npm run test:pdf.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { createTranslator } from 'next-intl';

import type { Component, ComponentKind } from '../src/lib/components/specs';
import { buildConceptDocument, type Translate } from '../src/lib/export/conceptDocument';
import { ConceptReport, pdfSafeText } from '../src/lib/pdf/concept/ConceptReport';
import { createRequire } from 'node:module';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { RULESET_VERSION, bomForRequirement } from '../src/lib/vision/bom';
import { emptySelection } from '../src/lib/vision/bomSelection';

const messages = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${locale}.json`), 'utf8'));
const missing: string[] = [];
const translator = (locale: 'vi' | 'en'): Translate => {
  const t = createTranslator({
    locale,
    messages: messages(locale),
    onError: (error) => missing.push(`${locale}: ${error.message}`),
    getMessageFallback: ({ key }) => `!!${key}`,
  });
  return (key, values) => t(key as never, values as never);
};

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, extra: Partial<Component> = {}): Component => ({
  id: `c${++id}`, code: model.toUpperCase(), kind, brand: 'Hãng', model, spec, price_vnd: 1_000_000, datasheet_url: null,
  source: 'datasheet', notes_vi: null, notes_en: null, is_active: true, sort_order: id, lead_time_days: 7, supplier: 'Nhà phân phối Việt', ...extra,
});
const CATALOG: Component[] = [
  make('camera', 'cam', {
    camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
    mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
  }, { price_vnd: 10_000_000, source: 'unverified' }),
  make('lens', 'f20', { lens_type: 'fixed', focal_length_mm: 20, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160 }),
  make('light', 'dome', { light_type: 'dome', color: 'white', size_mm: 100 }),
  make('controller', 'pc', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }, { price_vnd: 20_000_000 }),
  make('cable', 'gige', { cable_for: 'camera_data', connector: 'RJ45', length_m: 5 }),
];
const requirement = Object.entries({
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'measurement.0.tolerance': 0.5, 'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
}).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'));
const bom = bomForRequirement(requirement, CATALOG, emptySelection('recommended'));

const docOf = (locale: 'vi' | 'en', overrides: { bom?: typeof bom; rule_version?: string | null } = {}) =>
  buildConceptDocument({
    projectName: 'Kiểm tra nắp nhựa',
    revision: {
      rev_label: 'B',
      requirement,
      bom: 'bom' in overrides ? overrides.bom! : bom,
      rule_version: 'rule_version' in overrides ? overrides.rule_version! : RULESET_VERSION,
      locked_at: '2026-09-18T03:00:00Z',
      updated_at: '2026-09-18T02:00:00Z',
    },
    author: 'ky.su@example.test',
    now: new Date('2026-09-18T04:00:00Z'),
    formatDate: (date) => date.toISOString().slice(0, 16),
    t: translator(locale),
  });

test('PDF: dựng được cả vi/en, 2 trang trở lên, không kèm giá, chữ tiếng Việt có trong bảng glyph', async () => {
  const dir = join(process.cwd(), 'assets', 'fonts');
  Font.register({
    family: 'BeVietnamPro',
    fonts: [
      { src: join(dir, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
      { src: join(dir, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);

  for (const locale of ['vi', 'en'] as const) {
    const doc = docOf(locale);
    const buffer = await renderToBuffer(React.createElement(ConceptReport, { doc, t: translator(locale) }) as never);
    const raw = buffer.toString('latin1');
    assert.ok(raw.startsWith('%PDF'), locale);
    const pages = (raw.match(/\/Type \/Page\b/g) ?? []).length;
    assert.ok(pages >= 2, `${locale}: ${pages} trang — phai co trang rieng Gia dinh & Loai tru`);

    // Giải nén stream, gom bảng ToUnicode: chữ nào không có ở đây là rơi font.
    let decoded = '';
    for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      try {
        decoded += inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      } catch {
        /* stream không nén */
      }
    }
    // Cùng cách soi với test-pdf.mjs: mã Unicode phải có trong bảng ToUnicode, và không rơi về Helvetica.
    if (locale === 'vi') {
      for (const ch of 'ệạảđươĐ') {
        const hex = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
        assert.ok(new RegExp(`<${hex}>`, 'i').test(decoded), `thieu glyph ${ch} U+${hex}`);
      }
    }
    // Có Helvetica → liệt kê luôn ký tự font không có, để biết phải thêm gì vào PDF_REPLACEMENTS.
    const font = createRequire(import.meta.url)('fontkit').openSync(join(dir, 'BeVietnamPro-Regular.ttf'));
    const text = pdfSafeText(JSON.stringify(doc));
    const missingGlyphs = [...new Set([...text].filter((ch) => ch.codePointAt(0)! > 127 && !font.hasGlyphForCodePoint(ch.codePointAt(0)!)))];
    assert.ok(!raw.includes('Helvetica'), `${locale}: co chu roi ve Helvetica — ky tu font khong co: ${missingGlyphs.join(' ')}`);
  }
  assert.deepEqual(missing, []);
});

test('PDF không in đơn giá (chốt Q4) — mô hình dùng cho PDF không có cột giá', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'lib', 'pdf', 'concept', 'ConceptReport.tsx'), 'utf8');
  assert.ok(!/unitPrice|amount|\.total\b/.test(source), 'ConceptReport khong duoc doc gia');
});
