/**
 * Tài liệu tham khảo của các hãng cho trang Chọn đèn (chốt 2026-10-22 Q5). CHỈ đặt link — không
 * chép ảnh của hãng (bản quyền); hình trên trang do mình tự vẽ mô phỏng theo nội dung các tài liệu này.
 * Thêm / sửa link: sửa file này (dữ liệu công khai, không phải luật).
 *
 * 2026-10-22 (Hùng): gắn link tới trang có ẢNH THỰC TẾ so sánh cho từng kiểu đèn, trang CCS đặt
 * đầu tiên. `photos: true` = trang có ảnh chụp so sánh — nút "Xem ảnh thực tế của hãng" mở trang
 * `photos` đầu tiên của kiểu đèn đang vẽ.
 */
export type LightingReference = { publisher: string; title: string; url: string; photos?: boolean };

const CCS: LightingReference = {
  publisher: 'CCS',
  title: 'The Differences in Images by Lighting — cùng vật mẫu chụp dưới nhiều kiểu đèn',
  url: 'https://www.ccs-grp.com/guide/imaging/difference.html',
  photos: true,
};
const EDMUND_DARKFIELD: LightingReference = {
  publisher: 'Edmund Optics',
  title: 'Darkfield Illumination with Ring Lights — vòng thường so với vòng góc thấp',
  url: 'https://www.edmundoptics.com/knowledge-center/application-notes/illumination/darkfield-illumination-with-ring-lights-for-machine-vision/',
  photos: true,
};
const ADIMEC: LightingReference = {
  publisher: 'Adimec',
  title: 'Bright or Dark Field Lighting in applications',
  url: 'https://www.adimec.com/?p=16969',
  photos: true,
};
const SVL_BRIGHT: LightingReference = {
  publisher: 'Smart Vision Lights',
  title: 'Machine Vision Lighting Basics — Bright Field Lighting',
  url: 'https://smartvisionlights.com/resources/training/training-bright-field-lighting/',
  photos: true,
};
const KEYENCE_MULTI: LightingReference = {
  publisher: 'KEYENCE',
  title: 'CA-D — đèn đa góc (vòng, vòm, góc thấp trong một đèn)',
  url: 'https://www.keyence.com/ss/products/vision/peripheral/ca-d/ca_dr_m_ca_dq_m.jsp',
  photos: true,
};
const AUTOMATE: LightingReference = {
  publisher: 'A3 / Automate',
  title: 'Machine Vision Lighting Techniques — bảng so sánh',
  url: 'https://www.automate.org/glossary/lighting-techniques',
};

const OPTO_E: LightingReference = {
  publisher: 'Opto Engineering',
  title: 'Illumination geometries and techniques',
  url: 'https://www.opto-e.com/en/basics/illumination-geometries-and-techniques',
  photos: true,
};
const KEYENCE_BASICS: LightingReference = {
  publisher: 'KEYENCE',
  title: 'Basics of lighting selection',
  url: 'https://www.keyence.com/products/vision/resources/vision-resources/basics-of-lighting-selection.jsp',
};
const ADV_ILLUM: LightingReference = {
  publisher: 'Advanced Illumination',
  title: 'A Practical Guide to Machine Vision Lighting (PDF)',
  url: 'https://cdn.graftek.com/system/files/9967/original/Advanced_Illumination_Practical_Guide_to_Machine_Vision_Lighting.pdf',
};
const EDMUND: LightingReference = {
  publisher: 'Edmund Optics',
  title: 'Choose the correct illumination',
  url: 'https://www.edmundoptics.com/knowledge-center/application-notes/illumination/choose-the-correct-illumination',
};
const EDMUND_SILHOUETTE: LightingReference = {
  publisher: 'Edmund Optics',
  title: 'Silhouetting illumination (PDF)',
  url: 'https://www.edmundoptics.co.uk/ViewDocument/silhouetting-Illumination-18.pdf',
  photos: true,
};
const KEYENCE_LUMITRAX: LightingReference = {
  publisher: 'KEYENCE',
  title: 'LumiTrax — chụp nhiều hướng chiếu',
  url: 'https://www.keyence.com/landing/vision/lumitrax-lighting.jsp',
  photos: true,
};
const KEYENCE_SPECULAR: LightingReference = {
  publisher: 'KEYENCE',
  title: 'LumiTrax — chiếu sọc phản xạ gương (specular)',
  url: 'https://keyence.com/ss/products/vision/vj/lumitrax_r.jsp',
  photos: true,
};
const WENGLOR: LightingReference = {
  publisher: 'wenglor',
  title: 'Technology and principle of operation of illumination technology',
  url: 'https://wenglor.com/en/Technology-and-Principle-of-Operation-of-Illumination-Technology/s/Technologie-Beleuchtungstechnik',
};
const NI: LightingReference = {
  publisher: 'NI',
  title: 'A practical guide to machine vision lighting',
  url: 'https://www.ni.com/en/shop/choosing-the-right-hardware-for-your-vision-applications/a-practical-guide-to-machine-vision-lighting.html',
};

/** Theo kiểu đèn: trang có ảnh so sánh thực tế đứng trước — CCS đầu tiên khi CCS có kiểu đó. */
export const TYPE_REFERENCES: Record<string, LightingReference[]> = {
  ring: [CCS, SVL_BRIGHT, ADIMEC, OPTO_E, KEYENCE_BASICS],
  darkfield: [CCS, EDMUND_DARKFIELD, ADIMEC, OPTO_E, ADV_ILLUM],
  coaxial: [CCS, OPTO_E, KEYENCE_BASICS, ADV_ILLUM],
  dome: [CCS, OPTO_E, KEYENCE_BASICS, ADV_ILLUM],
  bar: [CCS, OPTO_E, ADV_ILLUM, KEYENCE_BASICS],
  multi_angle_ring: [CCS, KEYENCE_MULTI, OPTO_E],
  // CCS không có đèn nền / nhiều hướng / sọc / line trong trang so sánh — dùng trang của hãng khác.
  backlight: [EDMUND_SILHOUETTE, OPTO_E, ADV_ILLUM],
  photometric_stereo: [KEYENCE_LUMITRAX, OPTO_E],
  structured_stripe: [KEYENCE_SPECULAR, KEYENCE_LUMITRAX],
  line: [OPTO_E, ADV_ILLUM],
};

/** Trang ảnh thực tế đầu tiên của một kiểu đèn — nút "Xem ảnh thực tế của hãng". */
export const photoReferenceFor = (lightType: string): LightingReference | null => TYPE_REFERENCES[lightType]?.find((r) => r.photos) ?? null;

/** Màu đèn / bước sóng. */
export const COLOR_REFERENCES: LightingReference[] = [WENGLOR, ADV_ILLUM];

/** Chọn đèn nói chung. */
export const GENERAL_REFERENCES: LightingReference[] = [AUTOMATE, EDMUND, NI];
