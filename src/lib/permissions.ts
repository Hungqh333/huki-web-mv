/**
 * Bảng quyền theo vai trò — hiện ở Admin → Người dùng (chốt 2026-11-07, Q1–Q6).
 *
 * 8 nhóm sửa được (lock = null) đọc mức tối thiểu từ bảng role_permissions — Admin chỉnh ở
 * Admin → Người dùng (đợt 2); máy chủ kiểm bằng src/lib/featureAccess.ts, database bằng has_feature().
 * FEATURE_DEFAULTS = mức mặc định = quyền trước đây (khớp src/lib/roles.ts, test-permissions.ts).
 * Các dòng khoá giữ mức cố định ở đây (isAdmin / tier bài viết).
 *
 * Mức cao hơn luôn có quyền của mức thấp hơn (chốt Q1: "mức tối thiểu", không tick tự do).
 */

export type PermissionRole = 'guest' | 'registered' | 'member' | 'vip' | 'admin';

export const PERMISSION_ROLES: readonly PermissionRole[] = ['guest', 'registered', 'member', 'vip', 'admin'];

const RANK: Record<PermissionRole, number> = { guest: 0, registered: 1, member: 2, vip: 3, admin: 4 };

/** Vai trò `role` có đạt mức tối thiểu `min` không (guest < registered < member < vip < admin). */
export function roleAtLeast(role: PermissionRole, min: PermissionRole): boolean {
  return RANK[role] >= RANK[min];
}

/** 8 nhóm chức năng Admin chỉnh được mức (chốt Q4) — trùng ràng buộc role_permissions_feature_check. */
export const FEATURE_DEFAULTS = {
  visionEngineer: 'member',
  equipment: 'member',
  catalog: 'member',
  kpi: 'member',
  oldSelector: 'member',
  projects: 'member',
  pcVision: 'member',
  pdf: 'vip',
} as const satisfies Record<string, FeatureLevel>;

export type FeatureKey = keyof typeof FEATURE_DEFAULTS;
export const FEATURE_KEYS = Object.keys(FEATURE_DEFAULTS) as FeatureKey[];

/** Mức chọn được cho một nhóm — thấp nhất Đã đăng ký (chốt Q3: không mở cho khách). */
export type FeatureLevel = 'registered' | 'member' | 'vip' | 'admin';
export const FEATURE_LEVELS: readonly FeatureLevel[] = ['registered', 'member', 'vip', 'admin'];
export const isFeatureLevel = (v: unknown): v is FeatureLevel => (FEATURE_LEVELS as readonly unknown[]).includes(v);

/** Vì sao một dòng không sửa được trên bảng (chốt Q2). */
export type PermissionLock = 'perArticle' | 'account' | 'formulas' | 'editData' | 'admin';

export type PermissionRow = {
  /** Khoá dịch admin.permissions.rows.<key>. */
  key: string;
  /** Mức tối thiểu được dùng / xem đầy đủ. */
  min: PermissionRole;
  /** Dòng cẩm nang: mức thấp hơn vẫn thấy tiêu đề + đoạn mở đầu. */
  teaser?: boolean;
  /** null = nhóm sửa được (key là một FeatureKey); khác null = khoá kèm lý do. */
  lock: PermissionLock | null;
};

export type PermissionGroup = { key: 'handbook' | 'tools' | 'admin'; rows: PermissionRow[] };

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: 'handbook',
    rows: [
      { key: 'articlePublic', min: 'guest', lock: 'perArticle' },
      { key: 'articleRegistered', min: 'registered', teaser: true, lock: 'perArticle' },
      { key: 'articleMember', min: 'member', teaser: true, lock: 'perArticle' },
      { key: 'articleVip', min: 'vip', teaser: true, lock: 'perArticle' },
      { key: 'account', min: 'registered', lock: 'account' },
    ],
  },
  {
    key: 'tools',
    rows: [
      { key: 'visionEngineer', min: FEATURE_DEFAULTS.visionEngineer, lock: null },
      { key: 'equipment', min: FEATURE_DEFAULTS.equipment, lock: null },
      { key: 'catalog', min: FEATURE_DEFAULTS.catalog, lock: null },
      { key: 'kpi', min: FEATURE_DEFAULTS.kpi, lock: null },
      { key: 'oldSelector', min: FEATURE_DEFAULTS.oldSelector, lock: null },
      { key: 'projects', min: FEATURE_DEFAULTS.projects, lock: null },
      { key: 'pcVision', min: FEATURE_DEFAULTS.pcVision, lock: null },
      { key: 'pdf', min: FEATURE_DEFAULTS.pdf, lock: null },
    ],
  },
  {
    key: 'admin',
    rows: [
      { key: 'formulas', min: 'admin', lock: 'formulas' },
      { key: 'editData', min: 'admin', lock: 'editData' },
      { key: 'adminPages', min: 'admin', lock: 'admin' },
    ],
  },
];
