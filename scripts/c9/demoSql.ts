/**
 * SQL "dữ liệu chạy thử" cho production — Hưng giao 2026-10-05: tự tạo dữ liệu để
 * phần mềm chạy trọn luồng trước, dữ liệu thật tính sau. Ba phần, chạy lại được:
 *
 * 1. Kho thiết bị: bổ sung thông số còn thiếu + giá / thời gian giao ƯỚC TÍNH cho
 *    thiết bị seed, thêm 3 ống kính mẫu. CHỈ đụng dòng chưa có nhà cung cấp thật
 *    (supplier trống hoặc là nhãn ước tính) và chỉ THÊM khoá thông số chưa có —
 *    kho thật nhập sau (import:components) không bị đè.
 * 2. Đăng 15 bài Ghi chú luật đang nháp, người duyệt ghi rõ "chưa duyệt từng bài".
 * 3. Dự án mẫu S-11 (Rev A, đã chọn phương án Đề xuất, có BOM) cho tài khoản admin.
 *
 * Hàm thuần — build-demo-sql.ts ghi file, test-demo-data.ts chạy thử trên PGlite.
 */
import type { Component } from '../../src/lib/components/specs';
import { buildRevisionPayload } from '../../src/lib/projects/model';
import { DRAFT_VERSION, type RequirementDraft } from '../../src/lib/requirement/draft';
import { emptyRequirement, withFieldValue } from '../../src/lib/requirement/fields';
import { RULESET_VERSION, buildBom } from '../../src/lib/vision/bom';
import { emptySelection } from '../../src/lib/vision/bomSelection';
import { filterEquipment } from '../../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../../src/lib/vision/requirementAnalysis';
import { buildSolutionLevels } from '../../src/lib/vision/solutionLevels';
import { GOLDEN_CASES } from '../golden/cases';
import { DEMO_LENSES, ESTIMATE_LEAD_DAYS, ESTIMATE_SUPPLIER, SPEC_PATCHES, demoLens, estimatePrice, withEstimates } from './estimates';
import { SAMPLE_DESCRIPTION, SAMPLE_PROJECT_NAME, sampleCatalog } from './sample';

/** Tài khoản admin của Hưng trên production (memory: quy-trinh-chay-chuoi-prompt). */
export const DEMO_OWNER_EMAIL = 'hungqqh@gmail.com';
export const DEMO_REVIEWER = 'Đăng tạm — chưa duyệt từng bài (Hưng cho phép 2026-10-05)';
export const DEMO_LEVEL = 'recommended' as const;

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const jsonb = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`;

/** Dự án mẫu: bản nháp S-11 + BOM dựng bằng đúng engine, trên kho ước tính. */
export function demoProject() {
  const s11 = GOLDEN_CASES.find((c) => c.id === 'S-11')!;
  const requirement = Object.entries(s11.input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(s11.applicationType));
  const draft: RequirementDraft = { version: DRAFT_VERSION, startedFrom: 'manual', rawText: SAMPLE_DESCRIPTION, requirement, revision: 1 };
  const payload = buildRevisionPayload(draft)!;
  const catalog = sampleCatalog();
  const analysis = analyseRequirement(requirement);
  const solutions = buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog);
  const bom = buildBom(analysis, solutions, catalog, emptySelection(DEMO_LEVEL));
  if (!bom) throw new Error(`S-11 không dựng được BOM mức ${DEMO_LEVEL} trên kho ước tính — kiểm lại estimates.ts`);
  return { payload, bom };
}

export function renderDemoSql(seedComponents: readonly Omit<Component, 'id'>[]): string {
  const estimateGuard = `(supplier is null or supplier = ${q(ESTIMATE_SUPPLIER)})`;

  const catalogUpdates = seedComponents.map((component) => {
    const patched = withEstimates(component);
    const patch = SPEC_PATCHES[component.code];
    return (
      `update public.components set ` +
      (patch ? `spec = ${jsonb(patch)} || spec, ` : '') +
      `price_vnd = ${estimatePrice({ kind: component.kind, spec: patched.spec })}, lead_time_days = ${ESTIMATE_LEAD_DAYS}, supplier = ${q(ESTIMATE_SUPPLIER)} ` +
      `where code = ${q(component.code)} and ${estimateGuard};`
    );
  });

  const lensInserts = DEMO_LENSES.map((entry) => {
    const lens = withEstimates(demoLens(entry));
    return (
      `insert into public.components (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order, price_vnd, lead_time_days, supplier, is_active)\n` +
      `values (${q(lens.code)}, ${q(lens.kind)}, ${q(lens.brand)}, ${q(lens.model)}, ${jsonb(lens.spec)}, ${q(lens.source)}, ` +
      `${q(lens.notes_vi!)}, ${q(lens.notes_en!)}, ${lens.sort_order}, ${lens.price_vnd}, ${lens.lead_time_days}, ${q(lens.supplier!)}, true)\n` +
      `on conflict (code) do nothing;`
    );
  });

  const { payload, bom } = demoProject();

  return `-- =============================================================================
-- DỮ LIỆU CHẠY THỬ — để phần mềm chạy trọn luồng trước khi có dữ liệu thật.
-- Hưng giao 2026-10-05. FILE SINH TỰ ĐỘNG: npm run build:demo-sql (scripts/c9/).
--
-- Chạy lại được nhiều lần, không nhân bản. Không đụng dữ liệu thật:
--   - kho: chỉ dòng chưa có nhà cung cấp thật; thông số chỉ THÊM khoá còn thiếu;
--   - bài viết: chỉ bài Ghi chú luật còn nháp;
--   - dự án: chỉ tạo nếu tài khoản ${DEMO_OWNER_EMAIL} (không có thì admin cũ nhất)
--     chưa có dự án cùng tên.
-- Mọi giá ghi nhà cung cấp "${ESTIMATE_SUPPLIER}" — KHÔNG dùng báo giá.
-- =============================================================================

-- ===== PHẦN 1/3: KHO THIẾT BỊ — thông số bổ sung + giá ước tính =====
${catalogUpdates.join('\n')}

-- Ống kính mẫu lấp chỗ kho còn hở (tiêu cự 20 mm, vòng ảnh 1" và 1.1").
${lensInserts.join('\n')}

-- ===== PHẦN 2/3: ĐĂNG 15 BÀI GHI CHÚ LUẬT =====
-- Người duyệt ghi đúng sự thật: chưa ai duyệt từng bài. Duyệt thật thì mở bài trong
-- /admin/bai-viet, bỏ tick rồi tick lại "Đã duyệt" để ghi tên + ngày của người duyệt.
update public.articles
set published_at = now(), reviewed_by = ${q(DEMO_REVIEWER)}, reviewed_at = current_date
where media_type = 'ruleNote' and published_at is null;

-- ===== PHẦN 3/3: DỰ ÁN MẪU S-11 (Rev A, đã chọn phương án Đề xuất, có BOM) =====
do $$
declare
  v_user uuid;
  v_project uuid;
begin
  select id into v_user from public.profiles where email = ${q(DEMO_OWNER_EMAIL)};
  -- Không có email đó thì gán cho admin tạo sớm nhất.
  if v_user is null then
    select id into v_user from public.profiles where role = 'admin' order by created_at limit 1;
  end if;
  if v_user is null then
    raise notice 'Bo qua du an mau: khong co tai khoan admin nao';
    return;
  end if;
  if exists (select 1 from public.projects where user_id = v_user and name = ${q(SAMPLE_PROJECT_NAME)}) then
    raise notice 'Du an mau da co — giu nguyen';
    return;
  end if;

  insert into public.projects (user_id, name, application_type, status)
  values (v_user, ${q(SAMPLE_PROJECT_NAME)}, ${q(payload.applicationType)}, 'draft')
  returning id into v_project;

  insert into public.project_revisions (project_id, rev_label, requirement, assumptions, raw_text, schema_version, rule_version, bom)
  values (
    v_project, 'A',
    ${jsonb(payload.requirement)},
    ${jsonb(payload.assumptions)},
    ${q(payload.rawText ?? '')},
    ${payload.schemaVersion},
    ${q(RULESET_VERSION)},
    ${jsonb(bom)}
  );
end $$;
`;
}
