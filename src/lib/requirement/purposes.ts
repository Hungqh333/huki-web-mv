/**
 * Mã luật → MỤC ĐÍCH hiển thị (V1a hạng mục 5).
 *
 * V1a chưa có luật nào chạy (rule engine là V1b), nên giao diện không hiện mã
 * luật: người dùng thấy "để kiểm giãn nở nhiệt", không thấy "mở khoá MEC-001".
 * Mã luật vẫn giữ trong cấu hình (defaults.ts, questions.ts, assumptions.ts) để
 * V1b đối chiếu.
 *
 * Nhãn: designer.requirement.purposes.<purpose>
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */

export const PURPOSES = [
  'detectionResolution',
  'measurementResolution',
  'pixelCount',
  'multiCamera',
  'lighting',
  'lens',
  'depthOfField',
  'perspective',
  'thermal',
  'stitching',
  'algorithm',
  'motionBlur',
] as const;

export type Purpose = (typeof PURPOSES)[number];

/** Mọi mã luật dùng trong cấu hình V1a phải có ở đây — test kiểm. */
export const RULE_PURPOSE: Readonly<Record<string, Purpose>> = {
  'RES-001': 'detectionResolution',
  'RES-002': 'measurementResolution',
  'RES-004': 'pixelCount',
  'RES-005': 'multiCamera',
  'RES-006': 'detectionResolution',
  'OPT-001': 'lens',
  'OPT-005': 'depthOfField',
  'OPT-006': 'perspective',
  'OPT-008': 'perspective',
  'LGT-001': 'lighting',
  'LGT-002': 'lighting',
  'LGT-003': 'lighting',
  'LGT-004': 'lighting',
  'LGT-005': 'lighting',
  'MEC-001': 'thermal',
  'MEC-003': 'stitching',
  'AI-001': 'algorithm',
  'AI-002': 'algorithm',
  'THR-005': 'motionBlur',
};

/** Mục đích của một nhóm luật, bỏ trùng, giữ thứ tự. Mã chưa khai thì bỏ qua. */
export function purposesOf(ruleIds: readonly string[]): Purpose[] {
  const result: Purpose[] = [];
  for (const id of ruleIds) {
    const purpose = RULE_PURPOSE[id];
    if (purpose && !result.includes(purpose)) result.push(purpose);
  }
  return result;
}
