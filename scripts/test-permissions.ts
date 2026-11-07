/**
 * Bảng quyền ở Admin → Người dùng (src/lib/permissions.ts) phải khớp với kiểm tra thật:
 * hàm trong src/lib/roles.ts (máy chủ dùng) và hàm vai trò của RLS trong database.
 * Đổi quyền ở một chỗ mà quên chỗ kia → test đỏ.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { FEATURE_DEFAULTS, FEATURE_KEYS, PERMISSION_GROUPS, PERMISSION_ROLES, roleAtLeast, type PermissionRole } from '../src/lib/permissions';
import { canUseSelector, canViewTier, hasAdvancedFeatures, isAdmin, type AccessTier, type UserRole } from '../src/lib/roles';

const asUser = (role: PermissionRole): UserRole | null => (role === 'guest' ? null : role);
const rows = PERMISSION_GROUPS.flatMap((g) => g.rows);
const row = (key: string) => rows.find((r) => r.key === key)!;

/** Kiểm tra thật tương ứng từng dòng. */
const ACTUAL: Record<string, (role: UserRole | null) => boolean> = {
  articlePublic: (r) => canViewTier(r, 'public'),
  articleRegistered: (r) => canViewTier(r, 'registered' satisfies AccessTier),
  articleMember: (r) => canViewTier(r, 'member'),
  articleVip: (r) => canViewTier(r, 'vip'),
  account: (r) => r !== null,
  visionEngineer: canUseSelector,
  equipment: canUseSelector,
  catalog: canUseSelector,
  kpi: canUseSelector,
  oldSelector: canUseSelector,
  projects: canUseSelector,
  pcVision: canUseSelector,
  pdf: hasAdvancedFeatures,
  formulas: isAdmin,
  editData: isAdmin,
  adminPages: isAdmin,
};

test('mọi dòng của bảng quyền khớp hàm kiểm tra thật, với cả 5 mức', () => {
  assert.deepEqual(rows.map((r) => r.key).sort(), Object.keys(ACTUAL).sort());
  for (const r of rows) {
    for (const role of PERMISSION_ROLES) {
      assert.equal(roleAtLeast(role, r.min), ACTUAL[r.key](asUser(role)), `${r.key} · ${role}`);
    }
  }
});

test('chốt Q2/Q4: đúng 8 nhóm sửa được; công thức, sửa dữ liệu, Quản trị luôn khoá ở Admin', () => {
  assert.deepEqual(
    rows.filter((r) => r.lock === null).map((r) => r.key),
    ['visionEngineer', 'equipment', 'catalog', 'kpi', 'oldSelector', 'projects', 'pcVision', 'pdf']
  );
  for (const key of ['formulas', 'editData', 'adminPages']) {
    assert.equal(row(key).min, 'admin');
    assert.notEqual(row(key).lock, null);
  }
});

test('RLS: hàm vai trò trong database khớp mức Member trở lên của các công cụ', () => {
  const sql = readFileSync('supabase/migrations/20260823000001_init_schema.sql', 'utf8');
  assert.match(sql, /function public\.is_member_plus\(\)[\s\S]*?p\.role in \('member', 'vip', 'admin'\)/);
  assert.equal(row('pcVision').min, 'member');
});

test('chữ tiếng Việt và tiếng Anh có đủ cho mọi dòng, nhóm, lý do khoá', () => {
  for (const lang of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(`src/messages/${lang}.json`, 'utf8')).admin.permissions;
    for (const r of rows) {
      assert.ok(m.rows[r.key], `${lang}: thiếu rows.${r.key}`);
      if (r.lock) assert.ok(m.locks[r.lock], `${lang}: thiếu locks.${r.lock}`);
    }
    for (const g of PERMISSION_GROUPS) assert.ok(m.groups[g.key], `${lang}: thiếu groups.${g.key}`);
  }
});

test('đợt 2: 8 nhóm và mức mặc định trong code khớp migration bảng quyền', () => {
  const sql = readFileSync('supabase/migrations/20261107000002_role_permissions.sql', 'utf8');
  const check = /role_permissions_feature_check check \(feature in \(([^)]*)\)/.exec(sql)![1];
  assert.deepEqual([...check.matchAll(/'(\w+)'/g)].map((m) => m[1]), [...FEATURE_KEYS]);
  const seeded = Object.fromEntries([...sql.matchAll(/\('(\w+)', '(registered|member|vip|admin)'\)/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(seeded, { ...FEATURE_DEFAULTS });
  // Mặc định = quyền trước đây: dán SQL xong không ai bị đổi quyền.
  for (const key of FEATURE_KEYS) assert.equal(row(key).min, FEATURE_DEFAULTS[key]);
});

test('đợt 2: máy chủ không còn kiểm tra công cụ bằng hàm cố định (phải đi qua bảng quyền)', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && existsSync(f));
  const others = execSync('git ls-files --others --exclude-standard src', { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  for (const file of [...files, ...others]) {
    if (file === 'src/lib/roles.ts' || file === 'src/lib/auth.ts') continue;
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\b(canUseSelector|hasAdvancedFeatures)\(/, `${file} còn gọi hàm quyền cố định`);
  }
});

test('đợt 2: chính sách dữ liệu công cụ dùng has_feature, không còn is_member_plus', () => {
  const sql = readFileSync('supabase/migrations/20261107000002_role_permissions.sql', 'utf8');
  const policies = [...sql.matchAll(/create policy "(\w+)"[\s\S]*?;/g)].filter((m) => !m[1].startsWith('role_permission'));
  assert.equal(policies.length, 23, 'đủ 21 chính sách bảng + 2 thư mục ảnh');
  for (const m of policies) {
    assert.doesNotMatch(m[0], /is_member_plus/, `${m[1]} còn is_member_plus`);
    assert.match(m[0], /has_feature\('\w+'\)/, `${m[1]} chưa dùng has_feature`);
  }
});

test('đợt 2: mọi chính sách cũ dùng is_member_plus đều được thay trong migration bảng quyền', () => {
  const dir = 'supabase/migrations';
  const latest = readFileSync(`${dir}/20261107000002_role_permissions.sql`, 'utf8');
  const old = execSync(`git ls-files ${dir}`, { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.sql') && f < `${dir}/20261107000002`);
  const names = new Set<string>();
  for (const file of old) {
    for (const m of readFileSync(file, 'utf8').matchAll(/create policy "(\w+)"([\s\S]*?);/g)) {
      if (/is_member_plus\(\)/.test(m[2])) names.add(m[1]);
    }
  }
  assert.equal(names.size, 23);
  for (const name of names) assert.match(latest, new RegExp(`create policy "${name}"`), `chưa thay chính sách ${name}`);
});
