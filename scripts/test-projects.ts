/**
 * Dự án + revision (V1a hạng mục 7) — phần thuần: bản nháp ↔ revision, và đối
 * chiếu danh sách giá trị giữa TypeScript với migration.
 *
 * Phần phân quyền (RLS, khoá revision, hàm SQL) kiểm ở
 * supabase/tests/rls_smoke_test.sql qua `npm run test:db` và `test:db:mutate`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROJECT_NAME_MAX,
  PROJECT_STATUSES,
  buildRevisionPayload,
  draftAtRisk,
  draftFingerprint,
  normalizeProjectName,
  revisionToDraft,
  type RevisionRow,
} from '../src/lib/projects/model';
import { resolveAssumptions } from '../src/lib/requirement/assumptions';
import {
  DRAFT_VERSION,
  parseDraft,
  startDraftFromApp,
  startDraftFromText,
  type RequirementDraft,
} from '../src/lib/requirement/draft';
import { emptyRequirement, readField, withFieldUnknown, withFieldValue } from '../src/lib/requirement/fields';
import type { Requirement } from '../src/lib/requirement/types';
import { APPLICATION_TYPES } from '../src/lib/visionEntry';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const MIGRATION = read('supabase/migrations/20260914000001_projects.sql');

function checkList(constraint: string): string[] {
  const match = MIGRATION.match(new RegExp(`constraint ${constraint} check \\(\\w+ in \\(([^)]*)\\)\\)`));
  assert.ok(match, `khong tim thay ${constraint}`);
  return match[1].split(',').map((item) => item.trim().replace(/^'|'$/g, ''));
}

function filled(values: Record<string, unknown>): Requirement {
  return Object.entries(values).reduce(
    (req, [path, value]) => withFieldValue(req, path, value),
    emptyRequirement('AppearanceInspection')
  );
}

/** jsonb không giữ thứ tự khoá: đảo khoá ở mọi tầng để giả lập đọc lại từ database. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
  }
  return value;
}

function confidences(node: unknown, found: string[] = []): string[] {
  if (!node || typeof node !== 'object') return found;
  if ('value' in node && 'confidence' in node) found.push(String((node as { confidence: unknown }).confidence));
  for (const child of Object.values(node)) confidences(child, found);
  return found;
}

const PROJECT = { id: '11111111-2222-4333-8444-555555555555', name: 'Dây chuyền vỏ nhôm' };

function rowFrom(requirement: unknown, overrides: Partial<RevisionRow> = {}): RevisionRow {
  return {
    id: '99999999-2222-4333-8444-555555555555',
    rev_label: 'A',
    requirement,
    raw_text: 'kiểm tra vỏ nhôm',
    schema_version: DRAFT_VERSION,
    locked_at: null,
    ...overrides,
  };
}

test('database và TypeScript cùng một danh sách loại ứng dụng và trạng thái', () => {
  assert.deepEqual(checkList('projects_application_type_check'), [...APPLICATION_TYPES]);
  assert.deepEqual(checkList('projects_status_check'), [...PROJECT_STATUSES]);
  assert.deepEqual(PROJECT_STATUSES, ['draft', 'analysis', 'design', 'testing', 'validated', 'completed']);
  assert.ok(MIGRATION.includes(`between 1 and ${PROJECT_NAME_MAX}`), 'gioi han ten trung voi projects_name_check');
});

test('migration: hàm ghi chạy quyền người gọi, revision không có policy xoá, bundle có migration', () => {
  assert.ok(!/security\s+definer/i.test(MIGRATION), 'ham ghi khong duoc bo qua RLS');
  // Đếm dòng khai báo, không đếm chữ trong chú thích.
  assert.equal((MIGRATION.match(/^security invoker\r?$/gm) ?? []).length, 3, 'create_project, save_revision, start_next_revision');
  assert.ok(!/on public\.project_revisions for delete/.test(MIGRATION));
  // Supabase cấp quyền rộng mặc định — phải thu hồi tường minh, không chỉ thiếu policy.
  assert.ok(/revoke delete on public\.project_revisions from authenticated;/.test(MIGRATION));
  assert.ok(/enable row level security/.test(MIGRATION));

  const bundles = read('scripts/sql-bundles.mjs');
  assert.ok(bundles.includes('CHAY-BUOC-NAY-DUAN.sql'));
  assert.ok(bundles.includes('supabase/migrations/20260914000001_projects.sql'));
});

test('tên dự án: gọn khoảng trắng, không rỗng, tối đa 200 ký tự', () => {
  assert.equal(normalizeProjectName('  Dây   chuyền  A '), 'Dây chuyền A');
  assert.equal(normalizeProjectName('   '), null);
  assert.equal(normalizeProjectName(42), null);
  assert.equal(normalizeProjectName('x'.repeat(PROJECT_NAME_MAX)), 'x'.repeat(PROJECT_NAME_MAX));
  assert.equal(normalizeProjectName('x'.repeat(PROJECT_NAME_MAX + 1)), null);
});

test('nội dung revision: chỉ giá trị người dùng nhập + ảnh chụp giả định tính lại', () => {
  assert.equal(buildRevisionPayload(startDraftFromText('mô tả')), null, 'chua chon loai ung dung thi chua luu duoc');

  const requirement = withFieldUnknown(
    filled({ 'object.sizeX': 380, 'object.sizeY': 280, 'measurement.0.tolerance': 0.1, 'object.material': 'plastic' }),
    'system.workingDistance'
  );
  const draft = { ...startDraftFromText('kiểm tra vỏ'), requirement };
  const payload = buildRevisionPayload(draft)!;

  assert.equal(payload.applicationType, 'AppearanceInspection');
  assert.equal(payload.schemaVersion, DRAFT_VERSION);
  assert.equal(payload.rawText, 'kiểm tra vỏ');
  assert.deepEqual(payload.requirement, requirement);
  for (const c of confidences(payload.requirement)) {
    assert.ok(c === 'stated' || c === 'unknown', `requirement luu khong duoc co gia tri he thong dien: ${c}`);
  }
  assert.deepEqual(payload.assumptions, resolveAssumptions(requirement).assumptions);
  assert.ok(payload.assumptions.some((a) => a.source === 'derived' && a.value === 120), 'anh chup co alpha nhua');
});

test('revision → bản nháp: mở lại đúng nội dung (kể cả "Chưa rõ"), gắn liên kết dự án', () => {
  const requirement = withFieldUnknown(
    filled({ 'object.sizeX': 380, 'detection.0.minSize': 0.5, 'detection.0.contrast': 'unknown' }),
    'measurement.0.crossesCameraSeam'
  );
  const stored = JSON.parse(JSON.stringify(reverseKeys(requirement)));

  const draft = revisionToDraft(PROJECT, rowFrom(stored))!;
  assert.ok(draft);
  assert.deepEqual(draft.requirement, requirement);
  assert.equal(draft.rawText, 'kiểm tra vỏ nhôm');
  assert.equal(draft.startedFrom, `project:${PROJECT.id}:A`);
  assert.equal(readField(draft.requirement!, 'measurement.0.crossesCameraSeam')!.confidence, 'unknown');
  assert.equal(readField(draft.requirement!, 'system.workingDistance')!.confidence, undefined, 'chua hoi van la chua hoi');

  assert.deepEqual(
    { ...draft.project!, savedFingerprint: undefined },
    { id: PROJECT.id, name: PROJECT.name, revisionId: rowFrom(null).id, revLabel: 'A', locked: false, savedFingerprint: undefined }
  );
  assert.equal(draft.project!.savedFingerprint, draftFingerprint(draft), 'vua mo thi khong co thay doi chua luu');

  const locked = revisionToDraft(PROJECT, rowFrom(stored, { rev_label: 'B', locked_at: '2026-09-14T10:00:00Z' }))!;
  assert.equal(locked.project!.locked, true);
  assert.equal(locked.project!.revLabel, 'B');

  // Đi qua được parseDraft của trình duyệt — trang mở revision ghi đúng chuỗi này.
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
});

test('revision schema cũ được chuyển đổi; schema lạ hoặc hỏng thì không mở', () => {
  const v1 = JSON.parse(JSON.stringify(startDraftFromApp('Measurement').requirement));
  v1.system.workingDistance = { value: null, confidence: 'unknown', unit: 'mm' };
  const migrated = revisionToDraft(PROJECT, rowFrom(v1, { schema_version: 1 }))!;
  assert.ok(migrated);
  assert.equal(readField(migrated.requirement!, 'system.workingDistance')!.confidence, undefined);

  assert.equal(revisionToDraft(PROJECT, rowFrom(v1, { schema_version: 99 })), null);
  assert.equal(revisionToDraft(PROJECT, rowFrom(null)), null);
  assert.equal(revisionToDraft(PROJECT, rowFrom({ applicationType: 'Laser' })), null);
  assert.equal(revisionToDraft(PROJECT, rowFrom('khong phai object')), null);
});

test('dấu vân tay: không đổi theo thứ tự khoá hay liên kết dự án, đổi khi sửa nội dung', () => {
  const requirement = filled({ 'object.sizeX': 380 });
  const draft = { ...startDraftFromText('mô tả'), requirement };
  const base = draftFingerprint(draft);

  assert.equal(draftFingerprint({ ...draft, requirement: reverseKeys(requirement) as Requirement }), base);
  const linked: RequirementDraft = {
    ...draft,
    revision: 7,
    project: { id: 'p', name: 'n', revisionId: 'r', revLabel: 'A', locked: false, savedFingerprint: base },
  };
  assert.equal(draftFingerprint(linked), base);
  assert.notEqual(draftFingerprint({ ...draft, requirement: withFieldValue(requirement, 'object.sizeX', 381) }), base);
  assert.notEqual(draftFingerprint({ ...draft, rawText: 'mô tả khác' }), base);
});

test('mở bản nháp khác chỉ hỏi xác nhận khi bản đang mở có nội dung chưa lưu', () => {
  const next = 'app:Measurement';
  const empty = startDraftFromApp('AppearanceInspection');
  assert.equal(draftAtRisk(null, next), false);
  assert.equal(draftAtRisk(empty, next), false, 'ban nhap trong: khong co gi de mat');

  const typed: RequirementDraft = { ...empty, requirement: withFieldValue(empty.requirement!, 'object.sizeX', 380) };
  assert.equal(draftAtRisk(typed, next), true, 'co noi dung, chua luu');
  assert.equal(draftAtRisk(typed, typed.startedFrom), false, 'mo lai chinh ban nay');

  const unknownOnly: RequirementDraft = { ...empty, requirement: withFieldUnknown(empty.requirement!, 'system.workingDistance') };
  assert.equal(draftAtRisk(unknownOnly, next), true, 'tra loi "Chua ro" cung la noi dung');
  assert.equal(draftAtRisk(startDraftFromText('kiểm tra vỏ nhôm'), next), true, 'co mo ta go tay');

  const saved: RequirementDraft = {
    ...typed,
    project: { id: 'p', name: 'n', revisionId: 'r', revLabel: 'A', locked: false, savedFingerprint: draftFingerprint(typed) },
  };
  assert.equal(draftAtRisk(saved, next), false, 'da luu het');
  const edited: RequirementDraft = { ...saved, requirement: withFieldValue(saved.requirement!, 'object.sizeX', 400) };
  assert.equal(draftAtRisk(edited, next), true, 'sua sau lan luu gan nhat');
});

test('bản nháp giữ liên kết dự án hợp lệ; liên kết hỏng thì bỏ liên kết, giữ nội dung', () => {
  const requirement = filled({ 'object.sizeX': 380 });
  const link = { id: 'p', name: 'n', revisionId: 'r', revLabel: 'A', locked: false, savedFingerprint: 'x' };
  const good = { ...startDraftFromApp('AppearanceInspection'), requirement, project: link };
  assert.deepEqual(parseDraft(JSON.stringify(good))!.project, link);

  const broken = parseDraft(JSON.stringify({ ...good, project: { ...link, locked: 'khong' } }))!;
  assert.ok(broken, 'van doc duoc ban nhap');
  assert.ok(!('project' in broken));
  assert.equal(readField(broken.requirement!, 'object.sizeX')!.value, 380);
});

test('nhãn dự án đủ và cùng bộ khoá ở cả hai ngôn ngữ', () => {
  const keys = (node: unknown, prefix = ''): string[] =>
    node && typeof node === 'object'
      ? Object.entries(node).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
      : [prefix];

  const vi = JSON.parse(read('src/messages/vi.json'));
  const en = JSON.parse(read('src/messages/en.json'));
  assert.deepEqual(keys(vi.projects).sort(), keys(en.projects).sort());
  for (const locale of [vi, en]) {
    for (const status of PROJECT_STATUSES) assert.ok(locale.projects.status[status], status);
    assert.ok(locale.nav.projects);
    for (const key of ['title', 'hint', 'linked', 'unsaved', 'upToDate', 'lockedNote', 'nameLabel', 'create', 'save', 'saving', 'newRevision', 'confirmNewRevision', 'confirmHint', 'cancel', 'created', 'saved', 'revisionCreated', 'openProject', 'allProjects']) {
      assert.ok(locale.projects.save[key], `save.${key}`);
    }
    for (const key of ['notSignedIn', 'notAllowed', 'invalidDraft', 'pickApplication', 'nameRequired', 'notEditable', 'saveFailed']) {
      assert.ok(locale.projects.errors[key], `errors.${key}`);
    }
  }
});
