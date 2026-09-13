/**
 * Requirement (có cấu trúc, spec §3.2) → SelectorInput (phẳng, form bộ chọn cũ).
 *
 * Để bộ chọn thiết bị hiện có chạy được trên requirement mà không phải viết lại
 * engine. Chỉ đổ những khoá có trong catalog form (src/lib/selector/fields.ts);
 * thông số engine cũ chưa dùng (spanLength, crossesCameraSeam, material,
 * ambientTempRange, cameraCount, contrast...) thì bỏ qua — engine V1b sẽ dùng.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import { APPLICATION_TASK_SLUG } from '../application-type-map';
import type { InputValue, SelectorInput } from '../selector/types';
import type { EnvironmentCondition, Field, Motion, Requirement, Surface } from './types';

export type AdapterNote = { key: string; vi: string; en: string };

export type AdaptedSelectorInput = {
  taskSlug: string | null;
  input: SelectorInput;
  /** Giả định adapter phải dùng — luôn hiện cho người dùng. */
  assumptions: AdapterNote[];
  /** Thông tin bị rút gọn hoặc bỏ khi chuyển. */
  warnings: AdapterNote[];
};

/** Form bộ chọn không có 'black'; gần nhất về cách chiếu sáng là 'other'. */
const SURFACE_TO_FORM: Record<Surface, string> = {
  matte: 'matte',
  glossy: 'reflective',
  metallic: 'metal',
  transparent: 'transparent',
  mixed: 'multicolor',
  black: 'other',
};

/** Form bộ chọn không có 'clean' (không cần xử lý gì) và 'oil'. */
const CONDITION_TO_FORM: Partial<Record<EnvironmentCondition, string>> = {
  dust: 'dust',
  vibration: 'vibration',
  highTemp: 'high_temp',
  variableLight: 'ambient_light',
};

/** Kiểu chụp của bài ngoại quan. 'continuous' coi là area scan chụp động. */
const MOTION_TO_CAPTURE: Record<Motion, string> = {
  static: 'static',
  indexed: 'static',
  continuous: 'moving_area',
};

const valueOf = <T>(field: Field<T> | undefined): T | null => field?.value ?? null;

function strictest<T extends { id: string }>(items: T[], pick: (item: T) => number | null) {
  const withValue = items
    .map((item) => ({ item, value: pick(item) }))
    .filter((entry): entry is { item: T; value: number } => entry.value !== null);
  if (withValue.length === 0) return null;
  return withValue.reduce((best, entry) => (entry.value < best.value ? entry : best));
}

export function requirementToSelectorInput(requirement: Requirement): AdaptedSelectorInput {
  const type = requirement.applicationType;
  const input: SelectorInput = {};
  const assumptions: AdapterNote[] = [];
  const warnings: AdapterNote[] = [];
  const set = (key: string, value: InputValue) => {
    if (value !== null) input[key] = value;
  };

  // ─── Vật thể ───
  const sizeX = valueOf(requirement.object.sizeX);
  const sizeY = valueOf(requirement.object.sizeY);
  set('fov_width_mm', sizeX);
  set('fov_height_mm', sizeY);
  if (sizeX !== null || sizeY !== null) {
    // TODO(V1b): trường riêng cho sai lệch vị trí + lề an toàn;
    // FOV = kích thước vật + 2 × sai lệch vị trí + lề.
    assumptions.push({
      key: 'fovEqualsObject',
      vi: 'FOV = kích thước vật, chưa tính dung sai định vị và lề an toàn.',
      en: 'FOV = object size; positioning tolerance and safety margin not yet included.',
    });
  }

  const surface = valueOf(requirement.object.surface);
  set('surface', surface ? SURFACE_TO_FORM[surface] : null);
  set('color_critical', valueOf(requirement.object.colorInspection));
  if (type === 'AppearanceInspection') set('height_tolerance_mm', valueOf(requirement.object.heightVariation));

  // ─── Nhánh phát hiện lỗi: form cũ phẳng, lấy phần tử chặt nhất ───
  const detection = strictest(requirement.detection, (item) => valueOf(item.minSize));
  if (detection) {
    set('defect_min_size_mm', detection.value);
    set('defect_type', valueOf(detection.item.defectType));
    const variability = valueOf(detection.item.variability);
    set('defect_variability', variability === 'unknown' ? null : variability);
  }
  // TODO(V1b): engine đọc cả mảng detection[]; V1a giao diện chỉ có 1 phần tử.
  if (requirement.detection.filter((item) => valueOf(item.minSize) !== null).length > 1 && detection) {
    warnings.push({
      key: 'detectionReducedToMin',
      vi: `Có nhiều mục phát hiện lỗi — bộ chọn hiện tại chỉ dùng lỗi nhỏ nhất (${detection.value} mm).`,
      en: `Several detection items — the current selector only uses the smallest defect (${detection.value} mm).`,
    });
  }

  // ─── Nhánh đo lường ───
  const measurement = strictest(requirement.measurement, (item) => valueOf(item.tolerance));
  if (measurement) {
    // Đo 2D: `tolerance_mm` là dung sai gage. Ngoại quan: trường đo tuỳ chọn riêng.
    set(type === 'Measurement' ? 'tolerance_mm' : 'measurement_tolerance_mm', measurement.value);
    if (type === 'Measurement') {
      set('measure_type', valueOf(measurement.item.feature));
      set('perspective_free', valueOf(measurement.item.perspectiveFree));
    }
  }
  // TODO(V1b): engine đọc cả mảng measurement[]; V1a giao diện chỉ có 1 phần tử.
  if (requirement.measurement.filter((item) => valueOf(item.tolerance) !== null).length > 1 && measurement) {
    warnings.push({
      key: 'measurementReducedToMin',
      vi: `Có nhiều kích thước đo — bộ chọn hiện tại chỉ dùng dung sai chặt nhất (±${measurement.value} mm).`,
      en: `Several measured features — the current selector only uses the tightest tolerance (±${measurement.value} mm).`,
    });
  }

  // ─── Sản xuất / hệ thống / môi trường ───
  set('throughput_ppm', valueOf(requirement.production.partsPerMinute));
  set('line_speed_mms', valueOf(requirement.production.conveyorSpeed));
  const motion = valueOf(requirement.production.motion);
  if (type === 'AppearanceInspection') set('capture_mode', motion ? MOTION_TO_CAPTURE[motion] : null);

  set('working_distance_mm', valueOf(requirement.system.workingDistance));

  const conditions = valueOf(requirement.environment.conditions) ?? [];
  const mapped = conditions.map((c) => CONDITION_TO_FORM[c]).filter((c): c is string => Boolean(c));
  if (mapped.length > 0) set('environment', mapped);
  if (conditions.includes('oil')) {
    warnings.push({
      key: 'oilNotInSelector',
      vi: 'Bộ chọn hiện tại chưa có lựa chọn "dầu" — điều kiện này chưa được xét.',
      en: 'The current selector has no "oil" option — this condition is not considered yet.',
    });
  }
  set('ip_rating', valueOf(requirement.environment.ipRequirement));

  return { taskSlug: APPLICATION_TASK_SLUG[type], input, assumptions, warnings };
}
