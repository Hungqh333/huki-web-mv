/**
 * Ngưỡng engine sửa qua admin — CLAUDE.md §9, chốt 2026-10-12 (Q1).
 *
 * Mặc định phải TRÙNG các hằng số engine dùng trước đây (golden test chạy với mặc
 * định); sửa một ngưỡng phải đổi đúng kết luận của luật tương ứng; bộ giá trị hỏng
 * thì engine chạy bằng mặc định; phiên bản bộ luật đổi theo tham số.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GOLDEN_CASES } from './golden/cases';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { RULESET_VERSION } from '../src/lib/vision/bom';
import { CYCLE_DEFAULTS, CYCLE_MIN_MARGIN, DOF_DIFFRACTION_TOLERANCE } from '../src/lib/vision/configurationRules';
import {
  DEFAULT_ENGINE_PARAMS,
  ENGINE_PARAMS,
  parseEngineParamsForm,
  resolveEngineParams,
  rulesetVersionFor,
  validateEngineParams,
  type EngineParams,
} from '../src/lib/vision/engineParams';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { TELECENTRIC_FEASIBLE_MAX_MM, TELECENTRIC_PRACTICAL_MAX_MM } from '../src/lib/vision/optics';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { ERROR_WARN_SHARE } from '../src/lib/vision/resolution';
import { RANKING_WEIGHTS, SOLUTION_LEVELS, buildSolutionLevels } from '../src/lib/vision/solutionLevels';
import { sampleCatalog } from './c9/sample';
import { INTERFACE_BANDWIDTH } from '../src/lib/components/specs';
import { MATERIAL_ALPHA, N_DET_BY_CONTRAST } from '../src/lib/requirement/defaults';
import { resolveAssumptions } from '../src/lib/requirement/assumptions';
import { TELECENTRIC_FRONT_DIAMETER_FACTOR } from '../src/lib/vision/optics';
import { TILE_OVERLAP_MIN_PX, TILE_OVERLAP_RATIO } from '../src/lib/vision/tiling';
import { interfaceBandwidthFor, materialAlphaFor, pxPerDefectFor } from '../src/lib/vision/engineParams';

const caseOf = (id: string) => {
  const gt = GOLDEN_CASES.find((c) => c.id === id)!;
  return Object.entries(gt.input).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(gt.applicationType));
};
const withParams = (patch: Partial<EngineParams>): EngineParams => ({ ...DEFAULT_ENGINE_PARAMS, ...patch });

test('mặc định trùng đúng các hằng số engine dùng trước đây', () => {
  assert.deepEqual(SOLUTION_LEVELS.map((l) => [l.min, l.max]), [[1.1, 1.3], [1.3, 1.8], [1.8, Infinity]]);
  assert.deepEqual(RANKING_WEIGHTS, { resolutionMargin: 0.25, availability: 0.2, price: 0.2, priorProjectUse: 0.15, localSupport: 0.1, roadmap: 0.1 });
  assert.deepEqual([TELECENTRIC_PRACTICAL_MAX_MM, TELECENTRIC_FEASIBLE_MAX_MM], [100, 200]);
  assert.deepEqual([CYCLE_MIN_MARGIN, CYCLE_DEFAULTS.processMs, CYCLE_DEFAULTS.processDeepLearningMs, DOF_DIFFRACTION_TOLERANCE], [0.3, 300, 800, 1.5]);
  assert.equal(DEFAULT_ENGINE_PARAMS.errorWarnShare, ERROR_WARN_SHARE);
  assert.deepEqual(validateEngineParams(DEFAULT_ENGINE_PARAMS), []);
  assert.equal(rulesetVersionFor(RULESET_VERSION, DEFAULT_ENGINE_PARAMS), RULESET_VERSION, 'mac dinh giu nguyen phien ban — revision cu khong bao doi bo luat');
});

test('kiểm giới hạn + ràng buộc chéo', () => {
  const codes = (patch: Partial<EngineParams>) => validateEngineParams(withParams(patch)).map((e) => `${e.key}:${e.code}`);
  assert.deepEqual(codes({ processMs: 5 }), ['processMs:outOfRange']);
  assert.deepEqual(codes({ levelRecommendedMin: 1.05 }), ['levelRecommendedMin:levelOrder']);
  assert.deepEqual(codes({ levelHighMin: 1.3 }), ['levelHighMin:levelOrder']);
  assert.deepEqual(codes({ telecentricFeasibleMaxMm: 90 }), ['telecentricFeasibleMaxMm:telecentricOrder']);
  assert.deepEqual(codes({ weightPrice: 0.3 }), ['weightResolutionMargin:weightsSum']);
  assert.deepEqual(codes({ weightPrice: 0.3, weightRoadmap: 0 }), [], 'van cong lai bang 1');
});

test('bảng database: khoá lạ bỏ qua; bộ hỏng → chạy mặc định (rejected); bộ hợp lệ → áp dụng', () => {
  const ok = resolveEngineParams([{ key: 'processMs', value: '450' }, { key: 'khoaLa', value: 7 }]);
  assert.deepEqual([ok.params.processMs, ok.overridden, ok.rejected], [450, ['processMs'], false]);
  const broken = resolveEngineParams([{ key: 'weightPrice', value: 0.9 }]);
  assert.deepEqual([broken.params, broken.rejected], [DEFAULT_ENGINE_PARAMS, true]);
  assert.equal(resolveEngineParams([]).params, DEFAULT_ENGINE_PARAMS);
});

test('phiên bản bộ luật: đổi theo tham số, ổn định, khác nhau với giá trị khác nhau', () => {
  const a = rulesetVersionFor(RULESET_VERSION, withParams({ processMs: 450 }));
  assert.match(a, new RegExp(`^${RULESET_VERSION.replace(/\./g, '\\.')}\\+p[0-9a-z]+$`));
  assert.equal(a, rulesetVersionFor(RULESET_VERSION, withParams({ processMs: 450 })));
  assert.notEqual(a, rulesetVersionFor(RULESET_VERSION, withParams({ processMs: 460 })));
});

test('form admin: ô trống = mặc định, dấu phẩy thập phân, chỉ ghi giá trị khác mặc định', () => {
  const form: Record<string, string> = { processMs: '450', cycleMinMargin: '0,25', levelEconomyMin: '' };
  const parsed = parseEngineParamsForm((key) => form[key] ?? null);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.upserts, [{ key: 'cycleMinMargin', value: 0.25 }, { key: 'processMs', value: 450 }]);
  assert.ok(parsed.deletes.includes('levelEconomyMin') && !parsed.deletes.includes('processMs'));
  assert.deepEqual(parseEngineParamsForm((key) => (key === 'processMs' ? 'abc' : null)).invalidNumber, ['processMs']);
});

test('sửa ngưỡng đổi đúng kết luận: telecentric, cảnh báo ngân sách đo', () => {
  // GT-001: ô 209 mm > 200 → OPT-007 FAIL; nâng trần khả thi lên 250 → chỉ còn "rất đắt".
  const gt1 = caseOf('GT-001');
  const status = (params: EngineParams) => analyseRequirement(gt1, params).results.find((r) => r.ruleId === 'OPT-007')?.status;
  assert.equal(status(DEFAULT_ENGINE_PARAMS), 'fail');
  assert.equal(status(withParams({ telecentricFeasibleMaxMm: 250 })), 'warn');
  // S-11: phối cảnh 45 % U → đạt; hạ ngưỡng cảnh báo xuống 40 % → cảnh báo.
  const s11 = caseOf('S-11');
  const perspective = (params: EngineParams) => analyseRequirement(s11, params).results.find((r) => r.ruleId === 'OPT-008')?.status;
  assert.equal(perspective(DEFAULT_ENGINE_PARAMS), 'pass');
  assert.equal(perspective(withParams({ errorWarnShare: 0.4 })), 'warn');
});

test('sửa ngưỡng đổi đúng phương án: mức Tiết kiệm, thời gian xử lý THR-003', () => {
  const s11 = caseOf('S-11');
  const catalog = sampleCatalog();
  const levels = (params: EngineParams) => {
    const analysis = analyseRequirement(s11, params);
    return buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog).levels;
  };
  // S-11 với kho mẫu: Đề xuất dư 1,64 (β = f ÷ WD, chốt 2026-10-26 — Tiết kiệm nay rỗng: cặp gần nhất chỉ dư 1,09).
  const recommended = levels(DEFAULT_ENGINE_PARAMS).find((l) => l.key === 'recommended')!;
  assert.equal(recommended.status, 'ok', 'S-11 co phuong an De xuat du 1,64');
  // Nâng cận dưới Đề xuất lên 1,7 → cặp dư 1,64 rơi khỏi mức.
  assert.notEqual(levels(withParams({ levelRecommendedMin: 1.7 })).find((l) => l.key === 'recommended')!.margin, recommended.margin);
  // Thời gian xử lý giả định đi thẳng vào công thức THR-003 của phương án.
  const thr = (params: EngineParams) => levels(params).find((l) => l.status === 'ok')!.lens!.results.find((r) => r.ruleId === 'THR-003')!.formula;
  assert.match(thr(DEFAULT_ENGINE_PARAMS), /\+ 300\* \+/);
  assert.match(thr(withParams({ processMs: 450 })), /\+ 450\* \+/);
});

test('mỗi ngưỡng có nhãn vi/en trong trang admin', () => {
  for (const locale of ['vi', 'en']) {
    const engine = JSON.parse(readFileSync(`src/messages/${locale}.json`, 'utf8')).admin.engine;
    for (const def of ENGINE_PARAMS) assert.ok(engine.params[def.key], `${locale}: ${def.key}`);
    for (const group of new Set(ENGINE_PARAMS.map((d) => d.group))) assert.ok(engine.groups[group]?.title && engine.groups[group]?.hint, `${locale}: ${group}`);
    for (const code of ['fix', 'notNumber', 'outOfRange', 'levelOrder', 'telecentricOrder', 'weightsSum', 'saved']) assert.ok(engine.errors[code], `${locale}: ${code}`);
  }
});

// ─────────────── Mở rộng 2026-10-16: ngưỡng thiết bị, px/lỗi, α vật liệu, băng thông ───────────────

test('ngưỡng mở thêm 2026-10-16: mặc định trùng đúng bảng / hằng số cũ trong code', () => {
  assert.deepEqual({ ...pxPerDefectFor(DEFAULT_ENGINE_PARAMS) }, { ...N_DET_BY_CONTRAST });
  for (const [material, entry] of Object.entries(MATERIAL_ALPHA)) {
    assert.equal(materialAlphaFor(DEFAULT_ENGINE_PARAMS)[material as keyof typeof MATERIAL_ALPHA], entry.alpha, material);
  }
  assert.deepEqual({ ...interfaceBandwidthFor(DEFAULT_ENGINE_PARAMS) }, { ...INTERFACE_BANDWIDTH }, 'du moi chuan, dung so');
  const p = DEFAULT_ENGINE_PARAMS;
  assert.deepEqual(
    [p.ipcRamMinGb, p.ipcBufferDepth, p.highTempCameraMinC, p.interfaceMaxShare, p.imageCircleTolerance],
    [16, 10, 50, 0.7, 0.02]
  );
  assert.deepEqual([p.tileOverlapRatio, p.tileOverlapMinPx, p.telecentricFrontDiameterFactor], [TILE_OVERLAP_RATIO, TILE_OVERLAP_MIN_PX, TELECENTRIC_FRONT_DIAMETER_FACTOR]);
});

test('px/lỗi phải tăng dần từ tương phản cao → thấp', () => {
  const codes = (patch: Partial<EngineParams>) => validateEngineParams(withParams(patch)).map((e) => `${e.key}:${e.code}`);
  assert.deepEqual(codes({ pxPerDefectHigh: 4.5 }), ['pxPerDefectMedium:pxOrder']);
  assert.deepEqual(codes({ pxPerDefectLow: 3.5 }), ['pxPerDefectLow:pxOrder']);
  assert.deepEqual(codes({ pxPerDefectHigh: 4, pxPerDefectMedium: 4, pxPerDefectLow: 4 }), [], 'bang nhau duoc');
});

test('sửa ngưỡng mới đổi đúng kết quả: px/lỗi, α vật liệu, băng thông, RAM, đường kính telecentric', () => {
  const s11 = caseOf('S-11');
  // px/lỗi: S-11 nêu độ tương phản trung bình → đổi 4 → 4.5 thì RES-001 và panel giả định đổi theo.
  const res001 = (params: EngineParams) => analyseRequirement(s11, params).results.find((r) => r.ruleId === 'RES-001')!.formula;
  assert.notEqual(res001(withParams({ pxPerDefectMedium: 4.5 })), res001(DEFAULT_ENGINE_PARAMS));
  const pxAssumption = resolveAssumptions(s11, withParams({ pxPerDefectMedium: 4.5 })).assumptions.find((a) => a.key === 'parameter:pxPerDefect')!;
  assert.equal(pxAssumption.value, 4.5);
  assert.match(pxAssumption.vi!, /trung bình 4.5/);

  // α vật liệu: S-11 là nhôm → α suy từ vật liệu theo ngưỡng admin.
  const alpha = (params: EngineParams) => resolveAssumptions(s11, params).assumptions.find((a) => a.path === 'object.thermalExpansionCoeff')?.value;
  assert.equal(alpha(DEFAULT_ENGINE_PARAMS), 23);
  assert.equal(alpha(withParams({ alphaAluminium: 24 })), 24);

  // Băng thông: GigE còn 1 MB/s thì gợi ý giao tiếp không còn là GigE.
  const iface = (params: EngineParams) => analyseRequirement(s11, params).interfaceName;
  assert.equal(iface(DEFAULT_ENGINE_PARAMS), 'GigE');
  assert.notEqual(iface(withParams({ bwGigE: 1 })), 'GigE');

  // RAM tối thiểu: nâng lên 64 GB thì THR-004 RAM của máy 16 GB trong phương án thành FAIL.
  const catalog = sampleCatalog();
  const ram = (params: EngineParams) => {
    const analysis = analyseRequirement(s11, params);
    const level = buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog).levels.find((l) => l.status === 'ok');
    return level?.pc?.results.find((r) => r.key === 'ipcRam')?.status ?? null;
  };
  assert.equal(ram(DEFAULT_ENGINE_PARAMS), 'pass');
  assert.notEqual(ram(withParams({ ipcRamMinGb: 64 })), 'pass');

  // Đường kính đầu telecentric: GT-001 hiện hệ số trong công thức OPT-007.
  const opt007 = (params: EngineParams) => analyseRequirement(caseOf('GT-001'), params).results.find((r) => r.ruleId === 'OPT-007')!.formula;
  assert.match(opt007(DEFAULT_ENGINE_PARAMS), /× 1\.3 =/);
  assert.match(opt007(withParams({ telecentricFrontDiameterFactor: 2 })), /× 2 =/);
});
