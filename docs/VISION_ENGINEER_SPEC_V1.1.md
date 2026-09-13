# VISION ENGINEER — SPEC v1.1

**Trạng thái:** Thay thế hoàn toàn SPEC v1.0. Agent chỉ cần đọc file này.
**Mục đích:** Refactor Huki Vision Platform thành "Your Virtual Vision Engineer" — một hệ thống tính toán kỹ thuật Machine Vision deterministic, có thể kiểm tra được, với AI chỉ làm lớp giao tiếp.

---

## 0. ĐỌC TRƯỚC KHI CODE

Ba nguyên tắc bất biến. Nếu một quyết định implement vi phạm bất kỳ điều nào, dừng lại và hỏi.

1. **Mọi con số kỹ thuật phải truy vết được về một công thức hoặc một rule có ID trong tài liệu này.** Không có số nào được sinh ra bởi LLM.
2. **Feasibility là `min()`, không phải `mean()`.** Hệ thống Vision hỏng ở điểm yếu nhất.
3. **Không hiển thị con số mà không hiển thị được assumption đã dùng để tính ra nó.**

### 0.1 Thay đổi so với v1.0

| Mục v1.0 | Thay đổi trong v1.1 | Lý do |
|---|---|---|
| §8 Engineering Analysis | Tách 2 nhánh resolution budget độc lập | Detection và measurement có tiêu chí khác nhau, lệch tới 5× |
| §8 | Bổ sung toàn bộ optics constraint layer | mm/pixel một mình không quyết định được lens |
| §11 | Bổ sung Throughput Engine (bandwidth + cycle time) | Frame grabber / IPC / interface không có phép tính nào dẫn tới |
| §13 Feasibility | `mean` → `min` + limiting factor + PASS/MARGINAL/FAIL | Trung bình che mất điểm chết |
| §9 `confidence: 0.82` | Xóa. Thay bằng `evidence` + `inputsAssumed` | Số ảo, mâu thuẫn với yêu cầu "deterministic and inspectable" |
| §11 `Fit: 92%` | Tách hard filter (loại) và soft score (xếp hạng) | Không được cho điểm thiết bị vi phạm ràng buộc vật lý |
| §10 Multi-camera | Bổ sung stitching error + thermal expansion rules | Đây mới là yếu tố giới hạn thật khi đo span lớn |
| §17 Data Model | Bổ sung 7 entity | Thiếu chỗ lưu assumption, revision, BOM, rule version |
| §15 Knowledge | Cụ thể hóa thành §12: media type, schema, 3 đường vào | v1.0 chỉ nêu "should become a knowledge graph" mà không định nghĩa |
| §24 V1 Scope | Chia V1a / V1b / V1c | 15 hạng mục trong một lần là quá lớn |

### 0.2 Giữ nguyên từ v1.0 (không thảo luận lại)

- Không rebuild từ đầu. Giữ framework, DB, auth, calculator, equipment data, UI components.
- Positioning: **Machine Vision Hub — Your Virtual Vision Engineer**. Tagline: *Design better vision systems, step by step.*
- Tiếng Việt chính, thuật ngữ English ở dòng nhỏ bên dưới.
- Design language hiện tại: sáng, xanh, tiết chế, engineering-oriented. **Không** làm dark AI futuristic.
- Desktop-first (1920/1440/1280 + tablet).
- Progressive disclosure. Không bắt nhập hết thông số ngay từ đầu.
- Existing calculators → **Engineering Tools**; equipment selector → **Vision Designer**; cẩm nang → **Knowledge Base**. Tất cả là secondary so với Vision Engineer.
- Navigation: `Vision Engineer | Knowledge | Tools | Equipment | Projects`.
- Không xóa chức năng đang có. Làm tăng dần, sau mỗi stage phải chạy được.

---

## 1. RANH GIỚI AI (BẮT BUỘC — ĐỌC KỸ)

LLM chỉ được xuất hiện ở **đúng 2 điểm** trong toàn hệ thống:

### Điểm 1 — Parser: Natural language → Requirement JSON

```
INPUT:  text tự do của người dùng
OUTPUT: Requirement JSON đúng schema §3
```

Giới hạn cứng:
- **Không** tính toán. Không suy ra thông số. Không chọn thiết bị.
- Field không xác định được → `null`. **Tuyệt đối không bịa giá trị.**
- Mỗi field extract được phải kèm `sourceSpan` (đoạn text gốc) để người dùng verify.
- Output phải qua schema validation (zod/pydantic). Fail validation → hỏi lại người dùng, không tự sửa.

### Điểm 2 — Explainer: Kết quả đã tính → văn bản giải thích

```
INPUT:  RuleResult / CalculationResult ĐÃ hoàn tất (read-only)
OUTPUT: đoạn giải thích tiếng Việt cho nút "Why this?"
```

Giới hạn cứng:
- Chỉ được diễn giải số đã có trong input. **Không được tạo số mới.**
- Nếu prompt cần một con số không có trong input → đó là bug của engine, không phải việc của LLM.

### Mọi thứ ở giữa là code deterministic

`AnalysisEngine`, `CalculationEngine`, `RuleEngine`, `EquipmentFilter`, `RecommendationEngine`, `FeasibilityEngine` — **thuần code, không gọi LLM, unit-testable, cùng input luôn cho cùng output.**

> Lỗi thường gặp cần tránh: khi engine thiếu một rule, agent code sẽ "tiện tay" gọi LLM để lấp. Nghiêm cấm. Thiếu rule thì trả `UNKNOWN` + warning, không gọi LLM.

---

## 2. KIẾN TRÚC

```
UI (React pages/components)
        │  chỉ render, không chứa engineering logic
        ▼
┌─────────────────────────────────────────────────────┐
│ /lib/vision-engine/            (PURE, NO LLM)       │
│                                                     │
│  requirement/    normalize + validate + defaults    │
│  calculation/    optics, resolution, throughput      │
│  rules/          rule catalog §6 (mỗi rule 1 file)   │
│  equipment/      hard filter → soft rank             │
│  feasibility/    min() + limiting factor             │
│  architecture/   sinh graph kiến trúc hệ thống       │
└─────────────────────────────────────────────────────┘
        ▲                              ▲
        │                              │
  /lib/ai/parser.ts            /lib/ai/explainer.ts
  (LLM — điểm 1)                (LLM — điểm 2)
```

Quy tắc thư mục:
- Không `import` gì từ `/lib/ai/*` vào `/lib/vision-engine/*`. Thêm ESLint rule chặn.
- Không `import` React vào `/lib/vision-engine/*`.
- Mỗi rule = 1 file, export object `Rule`, tự đăng ký vào registry.

---

## 3. DATA MODEL

### 3.1 Entity list

Bắt buộc tồn tại độc lập, không hardcode application-specific logic vào page:

```
USER
PROJECT
PROJECT_REVISION        ← MỚI
REQUIREMENT
ASSUMPTION              ← MỚI
APPLICATION_TYPE
CALCULATION
ENGINEERING_RULE
RULE_VERSION            ← MỚI
RULE_RESULT
EQUIPMENT
EQUIPMENT_SPECIFICATION
COMPATIBILITY
RECOMMENDATION
SOLUTION_LEVEL
BOM                     ← MỚI
BOM_ITEM                ← MỚI
FEASIBILITY
KNOWLEDGE
TERM                    ← MỚI (glossary VN/EN)
SAMPLE                  ← MỚI (ảnh mẫu khách gửi)
VALIDATION_TEST
```

Lý do 7 entity mới:

| Entity | Lý do |
|---|---|
| `ASSUMPTION` | §23 yêu cầu "show assumptions" nhưng v1.0 không có chỗ lưu |
| `PROJECT_REVISION` | Khách đổi yêu cầu → cần Rev A/B/C để so sánh |
| `RULE_VERSION` | Rule sẽ sửa liên tục; báo giá cũ phải reproduce được |
| `BOM` / `BOM_ITEM` | Đầu ra thực tế của phòng là BOM + báo giá, v1.0 thiếu hẳn |
| `TERM` | Song ngữ VN/EN cần từ điển tập trung, không gõ rải rác |
| `SAMPLE` | AI feasibility phụ thuộc mẫu; cần lưu ảnh + ngày + người test |

### 3.2 Requirement schema (contract quan trọng nhất)

```ts
type Confidence = 'stated' | 'inferred' | 'assumed' | 'unknown';

interface Field<T> {
  value: T | null;
  confidence: Confidence;
  sourceSpan?: string;     // đoạn text gốc (khi confidence='stated')
  assumptionId?: string;   // trỏ tới ASSUMPTION (khi 'assumed')
  unit?: string;
}

interface Requirement {
  id: string;
  applicationType:
    | 'AppearanceInspection' | 'Measurement' | 'OCR'
    | '3D' | 'RobotGuidance' | 'AIInspection'
    | 'AssemblyInspection' | 'Other';

  object: {
    sizeX: Field<number>;          // mm
    sizeY: Field<number>;          // mm
    heightVariation: Field<number>;// mm — biến động chiều cao / độ nghiêng
    surface: Field<'matte'|'glossy'|'metallic'|'black'|'transparent'|'mixed'>;
    colorInspection: Field<boolean>;
    material: Field<string>;
    thermalExpansionCoeff: Field<number>; // µm/(m·K)
  };

  // ─── NHÁNH 1: PHÁT HIỆN LỖI ───
  detection: Array<{
    id: string;
    defectType: Field<string>;          // scratch / dent / contamination / crack...
    minSize: Field<number>;             // mm
    contrast: Field<'high'|'medium'|'low'|'unknown'>;
    region: Field<'full'|'partial'>;
  }>;

  // ─── NHÁNH 2: ĐO LƯỜNG ───
  measurement: Array<{
    id: string;
    feature: Field<string>;
    nominal: Field<number>;             // mm
    tolerance: Field<number>;           // mm, DẠNG ± (T_total = 2 × giá trị này)
    spanLength: Field<number>;          // mm — chiều dài kích thước cần đo
    crossesCameraSeam: Field<boolean>;  // quan trọng, xem MEC-003
  }>;

  production: {
    taktTime: Field<number>;            // s/sản phẩm
    partsPerMinute: Field<number>;
    motion: Field<'static'|'indexed'|'continuous'>;
    conveyorSpeed: Field<number>;       // mm/s
  };

  system: {
    cameraCount: Field<number>;
    workingDistance: Field<number>;     // mm
    workingDistanceMax: Field<number>;  // mm — giới hạn không gian máy
    mountingRigidity: Field<'rigid'|'standard'|'unknown'>;
  };

  environment: {
    conditions: Field<Array<'clean'|'dust'|'oil'|'vibration'|'variableLight'|'highTemp'>>;
    ambientTempRange: Field<number>;    // ΔT, K
    ipRequirement: Field<string>;
  };

  integration: {
    plc: Field<string>;
    robot: Field<string>;
    resultInterface: Field<Array<'digitalIO'|'ethernetIP'|'profinet'|'modbus'|'tcp'>>;
  };
}
```

**Quy tắc `Field<T>`:** mọi thông số kỹ thuật đều bọc trong `Field<T>`. Không có giá trị "trần". Đây là cơ chế duy nhất để §23.5 ("show assumptions") và §23.6 ("show uncertainty") hoạt động thật.

### 3.3 Default assumptions

Khi field = `null`, engine áp default và tạo record `ASSUMPTION`. Bảng này phải để trong file config, người dùng sửa được trong UI.

| Field | Default | Nguồn |
|---|---|---|
| `detection.contrast` | `low` (bảo toàn) | Thiếu thông tin → giả định xấu nhất |
| `object.heightVariation` | `2 mm` | Kinh nghiệm, cần confirm |
| `system.workingDistance` | `300 mm` | Khoảng thông dụng, phải cảnh báo |
| `environment.ambientTempRange` | `10 K` | Nhà máy không điều hòa |
| `object.thermalExpansionCoeff` | `23` (nhôm) | Vật liệu phổ biến nhất |
| `system.mountingRigidity` | `standard` | — |
| `production.motion` | `indexed` | — |
| `N_det` (px/defect) | `4` | Rule-of-thumb, xem RES-001 |
| `GRR_divisor` | `10` | Gage R&R, xem RES-002 |
| `k_subpixel` | `3` (repeatability = 1/3 px) | Bảo toàn, xem RES-002 |
| Overlap multi-camera | `10%` hoặc `≥ 20 px` | — |

---

## 4. CALCULATION ENGINE

Mọi công thức dưới đây phải nằm trong `/lib/vision-engine/calculation/`, có unit test, và mỗi hàm trả về `CalculationResult` (§5.1).

### 4.1 FIX #1 — Hai nhánh resolution budget độc lập

> **Đây là sửa lỗi quan trọng nhất so với v1.0.** v1.0 gộp "phát hiện lỗi" và "đo kích thước" vào một biến `mm/pixel`. Sai nguyên tắc.

**RES-001 — Detection budget**

```
mm_per_px_detection = defect_minSize / N_det

N_det: contrast high   → 3
       contrast medium → 4
       contrast low / unknown → 5
```
`evidence: 'rule-of-thumb'`. Assumption: lỗi dạng blob, không phải đường mảnh. Với vết xước mảnh (linear defect), yêu cầu px theo chiều rộng vết thường cao hơn → cảnh báo LGT-002.

**RES-002 — Measurement budget**

Không dùng px/mm. Dùng tiêu chí gage:

```
T_total = 2 × tolerance            // ±0.1 mm → T_total = 0.2 mm
U_budget = T_total / GRR_divisor   // GRR_divisor = 10 (tốt) | 4 (chấp nhận tối thiểu)
mm_per_px_measurement = U_budget × k_subpixel   // k_subpixel = 3
```

`evidence: 'calculated'` + assumption về `k_subpixel`.

**RES-003 — Governing resolution**

```
mm_per_px_required = min(tất cả detection budgets, tất cả measurement budgets)
```
Trả kèm `governingRequirement` = requirement nào đang quyết định. **Không được lấy trung bình.**

**RES-004 — Pixel count & MP**

```
px_h = ceil(FOV_h / mm_per_px) × (1 + overlap)
px_v = ceil(FOV_v / mm_per_px) × (1 + overlap)
MP   = px_h × px_v / 1e6
```

**RES-005 — Multi-camera tiling**

```
FOV_per_camera = FOV_total / grid   (vd 4 cam → grid 2×2)
overlap = max(10% × FOV_per_camera, 20 × mm_per_px)
```
Nếu có `measurement` nào `crossesCameraSeam = true` → kích hoạt MEC-003.

#### Ví dụ đã kiểm chứng — phải dùng làm golden test GT-001

Input: FOV 380×280 mm, 4 camera (grid 2×2 → ~200×150 mm/cam), defect 0.5 mm contrast unknown, measurement ±0.1 mm span 380 mm.

| Nhánh | Tính | mm/px | px/cam | MP/cam |
|---|---|---|---|---|
| Detection | 0.5 / 5 | 0.100 | 2000×1500 | **3.0 MP** |
| Measurement | (0.2/10)×3 | 0.060 | 3333×2500 | **8.3 MP** |
| **Governing** | min | **0.060** | 3333×2500 | **8.3 MP** |

Kết luận engine phải đưa ra: chênh **~2.8×** giữa hai nhánh, và nhánh measurement quyết định. Nếu engine chỉ có một biến `mm/pixel` thì hoặc over-spec (mất thầu) hoặc under-spec (chết ở FAT).

Đồng thời phải bật cảnh báo MEC-001 và MEC-003 — xem §6.

### 4.2 FIX #2 — Optics constraint layer

v1.0 dừng ở mm/pixel. Thiếu các ràng buộc sau thì vẫn chỉ là calculator đổi vỏ.

**OPT-001 — Focal length**

```
f ≈ sensor_width × WD / FOV_width          (xấp xỉ mỏng, hợp lệ khi WD >> f)
β = sensor_width / FOV_width               (magnification)
```
Chọn `f` chuẩn gần nhất từ danh sách khả dụng (8/12/16/25/35/50/75/100 mm...), rồi **tính lại FOV thực** với `f` đã chọn và báo lại cho người dùng. Không giả định `f` tùy ý tồn tại.

**OPT-002 — Image circle & mount (HARD CONSTRAINT)**

```
PASS nếu: lens.imageCircle >= sensor.diagonal
          AND lens.mount tương thích sensor.mount (C / CS / F / M42 / M58 / TFL)
```
Đây là lỗi phổ biến nhất khi chọn camera độ phân giải cao: lens 1.1" không phủ được sensor lớn hơn. **Vi phạm → loại thiết bị, không cho điểm.**

**OPT-003 — Lens resolving power**

```
required_lp_per_mm = 1000 / (2 × pixel_pitch_µm)
```
Pitch 2.2 µm → cần ~227 lp/mm. Warn nếu lens không có datasheet MTF đạt ngưỡng này. Camera 20 MP + lens phổ thông = mất độ phân giải thật, tiền camera vô nghĩa.

**OPT-004 — Diffraction limit**

```
d_airy = 2.44 × λ × F#        (λ = 0.55 µm)
WARN nếu d_airy > 2 × pixel_pitch
F#_max ≈ (2 × pixel_pitch_µm) / (2.44 × 0.55)
```
Pitch 2.2 µm → `F#_max ≈ 3.3`. Nghĩa là khép khẩu quá F/4 là bắt đầu mất độ phân giải do nhiễu xạ.

**OPT-005 — Depth of field + phát hiện xung đột**

```
DOF ≈ 2 × F# × c / β²         (c = blur circle cho phép = 2 × pixel_pitch; xấp xỉ, β nhỏ)
```
Xấp xỉ — datasheet lens / telecentric là nguồn chính thức.

**Conflict detection (giá trị cao):** nếu `DOF_required > DOF_available` → cần khép khẩu → tăng `F#` → có thể vượt `F#_max` của OPT-004. Khi đó engine phải báo **xung đột không giải được bằng lens**, và đề xuất: giảm `heightVariation` bằng cơ khí, hoặc tăng WD + tiêu cự dài hơn, hoặc telecentric, hoặc multi-focus.

**OPT-008 — Sai số phối cảnh của lens entocentric (quan trọng với measurement)**

```
perspective_error ≈ (heightVariation / WD) × r_offaxis
r_offaxis = nửa đường chéo FOV của camera đó
```

Ví dụ với GT-001: `Δh = 2 mm`, `WD = 300 mm`, `r = 125 mm` → sai số **≈ 0.83 mm**. Trong khi tolerance là ±0.1 mm. Sai số phối cảnh lớn gấp 8 lần toàn bộ dải tolerance.

Đây là loại kết luận mà "virtual vision engineer" phải tự bật ra. Nếu `perspective_error > U_budget` → bắt buộc OPT-006/007.

### 4.3 FIX #3 — Throughput Engine

v1.0 có "Frame Grabber", "Interface", "IPC" trong danh mục thiết bị nhưng **không có phép tính nào dẫn tới chúng**. Đây lại là phần deterministic dễ làm nhất và giá trị cao nhất.

**THR-001 — Bandwidth**

```
bytes_per_px:  mono8 = 1 | mono12packed = 1.5 | mono16 = 2 | bayer8 = 1 | rgb8 = 3
BW_camera = MP × bytes_per_px × fps          [MB/s]
BW_total  = Σ BW_camera
```

**THR-002 — Interface selection**

Bandwidth khả dụng thực tế (không phải lý thuyết):

| Interface | ~MB/s | Cable max |
|---|---|---|
| USB3 Vision | 350 | 3–5 m (dài hơn: fiber) |
| GigE Vision | 115 | 100 m |
| 5GigE | 570 | 100 m |
| 10GigE | 1150 | 30–100 m (Cat6A/fiber) |
| CoaXPress 6 (per lane) | 600 | 40 m+ |
| CoaXPress 12 (per lane) | 1200 | 40 m+ |
| Camera Link Base | 255 | 10 m |
| Camera Link Medium | 510 | 10 m |
| Camera Link Full | 680 | 10 m |
| Camera Link Deca (80-bit) | 850 | 10 m |

> Camera Link tách theo cấu hình vì băng thông khác nhau tới 3 lần: Base 2,04 Gbit/s ≈ 255 MB/s,
> Medium gấp đôi, Full 680, Deca 850 (nguồn: Gidel, Agmanic). Bản trước ghi `Camera Link Full | 800`,
> không khớp cấu hình nào. Camera phải khai đúng cấu hình nó chạy (`CameraLink-Base` … `CameraLink-Deca`).

Engine phải trả: interface, **số port NIC / số lane grabber**, và cảnh báo nếu `BW_total` > 70% băng thông chọn.

Kiểm chứng với GT-001: 4 cam × 8.3 MP × mono8 × 10 fps ≈ **332 MB/s**. Một NIC GigE (115 MB/s) không đủ → cần 4 port GigE riêng (nếu chia đều 83 MB/s/cam thì vừa, margin mỏng), hoặc 10GigE với switch, hoặc 5GigE. Engine phải nói rõ điều này, không để người dùng tự đoán.

**THR-003 — Cycle time budget**

```
t_cycle = t_trigger + t_exposure + t_readout + t_transfer + t_process + t_io
margin  = (takt - t_cycle) / takt
WARN nếu margin < 30%
FAIL nếu margin < 0
```

**THR-004 — IPC sizing**

```
PCIe slots   ≥ số frame grabber (+1 cho GPU nếu có DL)
CPU cores    ≈ 1 core/camera stream + cores cho xử lý (+2 cho OS)
RAM          ≥ 4 × frame_size × n_camera × buffer_depth, tối thiểu 16 GB
GPU          chỉ khi có DL — chọn theo inference time trong THR-003
Storage      = NG_per_day × frame_size × retention_days
```

**THR-005 — Motion blur → exposure → lighting**

```
blur_object = conveyor_speed × t_exposure
YÊU CẦU: blur_object ≤ k_blur × mm_per_px    (k_blur = 0.3 … 1.0, default 0.5)
→ t_exposure_max = k_blur × mm_per_px / conveyor_speed
```
Từ `t_exposure_max` suy ra nhu cầu cường độ sáng → strobe / overdrive. Đây là chuỗi nhân quả v1.0 thiếu: *tốc độ → exposure → ánh sáng → chi phí lighting*.

Nếu `t_exposure_max < 50 µs` → cảnh báo cần strobe controller + global shutter (LGT-008).

---

## 5. RULE ENGINE

### 5.1 FIX #5 — Bỏ `confidence` số ảo

v1.0 trả `confidence: 0.82`. Con số này không có nguồn gốc, và mâu thuẫn trực tiếp với §18 ("deterministic and inspectable"). Kỹ sư sẽ mất niềm tin vào toàn hệ thống ngay khi phát hiện nó do người viết rule gõ tay.

Thay bằng:

```ts
interface RuleResult {
  ruleId: string;              // 'OPT-006'
  ruleVersion: string;         // '1.0.0' — cho reproducibility
  status: 'PASS' | 'MARGINAL' | 'FAIL' | 'UNKNOWN';

  result: string;              // 'Telecentric lens required'
  reason: string;              // diễn giải kỹ thuật, có số
  formula?: string;            // công thức đã dùng, hiện được trên UI

  evidence: 'calculated'          // suy ra từ công thức vật lý
          | 'rule-of-thumb'       // kinh nghiệm ngành, có nguồn
          | 'requires-sample-test'// không thể kết luận không có mẫu
          | 'unknown';

  inputsUsed:    Array<{ path: string; value: unknown }>;
  inputsAssumed: Array<{ path: string; value: unknown; assumptionId: string }>;

  marginRatio?: number;        // available / required. >1 là tốt
  warnings: string[];
  knowledgeRefs: string[];     // slug bài Knowledge Base
  alternatives?: string[];
}
```

**Nguyên tắc:** `inputsAssumed` càng dài → độ tin cậy càng thấp. UI hiển thị trực tiếp danh sách này, không quy về một con số. Nếu vẫn muốn một chỉ số tổng hợp, nó phải là **hàm của độ đầy đủ input** (`|inputsUsed| / (|inputsUsed| + |inputsAssumed|)`), tính bằng code, không gõ tay.

### 5.2 Giao diện rule

```ts
interface Rule {
  id: string;
  version: string;
  category: 'RES' | 'OPT' | 'LGT' | 'THR' | 'MEC' | 'ENV' | 'AI' | 'INT';
  title: { vi: string; en: string };
  appliesTo: (r: Requirement, c: CalcContext) => boolean;
  evaluate:  (r: Requirement, c: CalcContext) => RuleResult;
  feasibilityDimension: FeasibilityDimension;
}
```

Mỗi rule 1 file, tự đăng ký vào registry, có unit test riêng.

---

## 6. RULE CATALOG

Danh mục tối thiểu cho V1. ID là hợp đồng — không đổi ID sau khi release.

### RES — Resolution

| ID | Điều kiện | Kết luận | Evidence |
|---|---|---|---|
| RES-001 | có `detection[]` | detection budget (§4.1) | rule-of-thumb |
| RES-002 | có `measurement[]` | measurement budget theo gage (§4.1) | calculated |
| RES-003 | luôn | governing = `min()`, báo requirement quyết định | calculated |
| RES-004 | luôn | px count → MP yêu cầu | calculated |
| RES-005 | `cameraCount > 1` | tiling + overlap | calculated |
| RES-006 | `contrast = unknown` | WARN: "Độ tương phản lỗi chưa xác định — đã giả định thấp (5 px/defect). Cần ảnh mẫu để xác nhận." | requires-sample-test |

### OPT — Optics

| ID | Điều kiện | Kết luận |
|---|---|---|
| OPT-001 | luôn | tính `f`, chọn `f` chuẩn, tính lại FOV thực |
| OPT-002 | luôn | **HARD:** image circle ≥ sensor diagonal, mount tương thích |
| OPT-003 | `pitch < 3 µm` | WARN cần lens high-resolution ≥ `1000/(2·pitch)` lp/mm |
| OPT-004 | luôn | diffraction limit → `F#_max` |
| OPT-005 | luôn | DOF; phát hiện xung đột DOF ↔ `F#_max` |
| OPT-006 | có `measurement` AND (`heightVariation > 0` OR cần không phối cảnh) | đề xuất telecentric |
| OPT-007 | OPT-006 active AND `FOV_max_dim > 200 mm` | **telecentric không khả thi** — xem dưới |
| OPT-008 | có `measurement` AND lens entocentric | tính `perspective_error`; FAIL nếu > `U_budget` |

**OPT-007 chi tiết (rule có giá trị nhất trong nhóm này).** Telecentric cần đường kính đầu ống ≈ 1.15–1.3 × kích thước FOV. FOV 380 mm → cần ống ~450 mm đường kính: thực tế không tồn tại hoặc giá không chấp nhận được. Ngay cả 200 mm/camera vẫn cần ống ~240 mm — cực đắt.

Engine phải đưa ra **các phương án thay thế**, không chỉ nói "không khả thi":
1. Chia nhỏ FOV/camera xuống ≤ 100 mm → telecentric khả thi về giá, nhưng tăng số camera.
2. Entocentric + WD cố định + calibration mặt phẳng (distortion + homography) + **giữ chiều cao sản phẩm ổn định bằng cơ khí** (kẹp/chân không). Giảm `heightVariation` là cách rẻ nhất để giảm `perspective_error`.
3. Chấp nhận ±0.1 mm **chỉ cho kích thước nằm trong một camera**, không vắt qua ranh giới.

### LGT — Lighting

| ID | Điều kiện | Kết luận |
|---|---|---|
| LGT-001 | `surface ∈ {glossy, metallic}` | dome / diffuse coaxial; WARN cần thử mẫu |
| LGT-002 | `defectType ∈ {scratch, dent}` trên bề mặt phẳng | dark field / low-angle |
| LGT-003 | measurement dạng biên/silhouette | backlight (telecentric backlight cho biên tốt nhất) |
| LGT-004 | `surface = transparent` | backlight + polarizer, hoặc dark field |
| LGT-005 | `surface = black` matte | diffuse cường độ cao; WARN xung đột với THR-005 |
| LGT-006 | `colorInspection = true` | LED trắng CRI cao + camera màu + color target; WARN metamerism |
| LGT-007 | `environment ∋ variableLight` | strobe + bandpass filter + che chắn |
| LGT-008 | `t_exposure_max < 50 µs` (từ THR-005) | strobe controller + global shutter bắt buộc |
| LGT-009 | luôn | **Lighting là yếu tố giới hạn thường gặp nhất.** Nếu resolution PASS nhưng lighting chưa validate → limiting factor = Lighting |

### THR — Throughput

| ID | Điều kiện | Kết luận |
|---|---|---|
| THR-001..005 | §4.3 | bandwidth, interface, cycle time, IPC, motion blur |
| THR-006 | `BW_total > 70%` băng thông interface | WARN margin mỏng |
| THR-007 | cable > giới hạn interface | đổi interface hoặc fiber/repeater |

### MEC — Mechanical & Calibration

> **FIX #7.** v1.0 bỏ qua nguồn sai số lớn nhất của hệ multi-camera đo span lớn.

**MEC-001 — Giãn nở nhiệt**

```
thermal_error = α × L × ΔT          [µm, với L ở m]
```
Kiểm chứng GT-001: nhôm `α = 23 µm/(m·K)`, `L = 0.38 m`, `ΔT = 10 K` → **≈ 87 µm = ±0.087 mm**.

Tolerance là ±0.1 mm. **Riêng giãn nở nhiệt đã chiếm gần toàn bộ dải tolerance.** Kết luận engine phải phát ra:

> "Yêu cầu ±0.1 mm trên span 380 mm là bài toán cơ khí/nhiệt trước khi là bài toán camera. Cần một trong: kiểm soát nhiệt độ (±2 K), hoặc bù nhiệt bằng vật chuẩn (reference artifact) trong ảnh, hoặc xác nhận lại vật liệu và điều kiện đo với khách hàng."

`FAIL` nếu `thermal_error > U_budget`. Đây là rule tạo ra cảm giác "kỹ sư có kinh nghiệm" rõ nhất — không calculator nào nói điều này.

**MEC-002 — Rung động**: `environment ∋ vibration` → giảm exposure, gá cứng, tách rung; WARN xung đột với LGT-005.

**MEC-003 — Stitching / calibration error giữa camera (HARD)**

```
stitch_error_per_seam ≈ k_stitch × mm_per_px     (k_stitch = 1/3 … 1, default 1/2)
+ độ ổn định gá theo thời gian & nhiệt
```
Nếu `measurement.crossesCameraSeam = true`:
- `FAIL` nếu `stitch_error + thermal_error > U_budget`.
- Bắt buộc: global calibration với vật chuẩn phủ toàn FOV, gá cứng, tái calibration định kỳ.
- Khuyến nghị mặc định: **không cho kích thước tolerance chặt vắt qua ranh giới camera.** Bố trí lại camera thay vì tăng độ phân giải.

Với hệ 4 camera đo ±0.1 mm trên 380 mm: **sai số calibration/stitching và giãn nở nhiệt là yếu tố giới hạn, không phải pixel size.** Tăng MP camera không giải quyết được.

### ENV — Environment

| ID | Điều kiện | Kết luận |
|---|---|---|
| ENV-001 | `dust` / `oil` | IP rating, air purge, cửa sổ bảo vệ (WARN: thêm phản xạ), lối vệ sinh |
| ENV-002 | `highTemp` | kiểm tra dải nhiệt camera, tản nhiệt, WARN nhiễu ảnh tăng theo nhiệt |

### AI — Deep Learning

Tuân thủ nguyên tắc: **không đề xuất AI nếu Vision truyền thống đã đáp ứng.**

| ID | Điều kiện | Kết luận |
|---|---|---|
| AI-001 | lỗi có hình học xác định + ánh sáng ổn định + tiêu chí rõ | **Dùng Vision truyền thống.** Nêu rõ lý do không dùng DL |
| AI-002 | lỗi biến động ngoại hình cao / nền texture tự nhiên / phân loại lỗi ngoại quan | DL là ứng viên. Yêu cầu mẫu: anomaly detection ≥ 100–300 ảnh OK; supervised segmentation ≥ 50–200 ảnh/loại lỗi, **NG phải là mẫu thật** |
| AI-003 | AI-002 active AND chưa có `SAMPLE` | `evidence: 'requires-sample-test'`. **Feasibility subscore của dimension `Algorithm` bị chặn trần ở 60** cho tới khi có mẫu validate |
| AI-004 | có DL | inference time phải vào `t_process` của THR-003; GPU vào THR-004 |

### INT — Integration

| ID | Điều kiện | Kết luận |
|---|---|---|
| INT-001 | luôn | interface kết quả (digital IO / EtherNet-IP / PROFINET / Modbus / TCP) + độ trễ |
| INT-002 | `applicationType = RobotGuidance` | cần hand-eye calibration; WARN độ chính xác hệ = vision ⊕ robot repeatability |
| INT-003 | luôn | nguồn trigger (encoder / sensor / PLC), độ ổn định jitter |

---

## 7. FIX #4 — FEASIBILITY ENGINE

### 7.1 Vấn đề của v1.0

v1.0: Resolution 95, Optics 85, Lighting 80, Camera 92, Processing 90, AI 75 → 88/100 "TECHNICALLY FEASIBLE".

Nếu Lighting = 30, trung bình vẫn ~78 → vẫn hiện "Good", trong khi hệ thống **không khả thi**. Trong kỹ thuật, feasibility là `min`, không phải `mean`.

### 7.2 Thiết kế mới

7 dimension:

```
Resolution | Optics | Lighting | Throughput | Mechanical | Algorithm | Integration
```

Mỗi dimension:

```ts
interface DimensionScore {
  dimension: FeasibilityDimension;
  status: 'PASS' | 'MARGINAL' | 'FAIL' | 'UNKNOWN';
  marginRatio: number | null;     // available / required
  score: number;                  // 0-100, map từ marginRatio
  drivingRules: string[];         // rule ID nào quyết định
  blockers: string[];
}
```

Mapping `marginRatio → score` (**là mapping hiển thị, không phải chân lý toán học** — ghi rõ câu này trên UI):

| marginRatio | status | score |
|---|---|---|
| ≥ 1.5 | PASS | 95 |
| 1.2 – 1.5 | PASS | 85 |
| 1.0 – 1.2 | MARGINAL | 70 |
| 0.8 – 1.0 | FAIL | 45 |
| < 0.8 | FAIL | 20 |
| không tính được | UNKNOWN | ≤ 60 (chặn trần) |

### 7.3 Tổng hợp

```ts
overall = Math.min(...dimensions.map(d => d.score));

limitingFactor = dimension có score thấp nhất;   // HIỂN THỊ NỔI BẬT

if (dimensions.some(d => d.status === 'FAIL'))
  status = 'NOT FEASIBLE AS SPECIFIED';
else if (dimensions.some(d => d.status === 'MARGINAL' || d.status === 'UNKNOWN'))
  status = 'FEASIBLE WITH VALIDATION';
else
  status = 'TECHNICALLY FEASIBLE';
```

Khi `NOT FEASIBLE AS SPECIFIED`, **bắt buộc** kèm danh sách điều kiện để chuyển thành khả thi, lấy từ `RuleResult.alternatives`. Ví dụ:

> Không khả thi với yêu cầu hiện tại. Yếu tố giới hạn: **Mechanical** (MEC-001, MEC-003).
> Để đạt khả thi, cần một trong:
> • Giới hạn kích thước tolerance ±0.1 mm trong phạm vi một camera (≤ 200 mm)
> • Kiểm soát nhiệt độ vùng đo ±2 K
> • Nới tolerance lên ±0.2 mm
> • Bù nhiệt bằng vật chuẩn trong ảnh

UI luôn hiển thị: *"Engineering estimation — sample testing recommended."*

---

## 8. FIX #6 — EQUIPMENT: HARD FILTER + SOFT RANK

v1.0 hiện "Fit: 92%" mà không định nghĩa. Không được cho điểm thiết bị vi phạm ràng buộc vật lý — 92% gợi ý "gần đạt", trong khi lens sai mount là **không dùng được**.

### 8.1 Tầng 1 — Hard constraints (FILTER, không cho điểm)

Không đạt → **loại khỏi danh sách**, hiển thị ở mục riêng "Đã loại — lý do".

Camera:
- `MP ≥ MP_required` (RES-004)
- `pixel_pitch` phù hợp `F#_max` (OPT-004)
- shutter (global nếu THR-005 yêu cầu)
- interface đủ bandwidth (THR-002)
- có trigger IO
- dải nhiệt, IP (ENV)

Lens:
- `imageCircle ≥ sensor.diagonal` (OPT-002)
- mount tương thích (OPT-002)
- `f` khả dụng cho `WD` và FOV (OPT-001)
- telecentric nếu OPT-006 yêu cầu VÀ OPT-007 cho phép
- MTF đạt `required_lp_per_mm` (OPT-003)

Lighting: loại hình theo LGT; đủ cường độ cho `t_exposure_max`; strobe-capable nếu LGT-008.

IPC / Grabber: đủ PCIe slot, lane, core, RAM (THR-004).

### 8.2 Tầng 2 — Soft score (XẾP HẠNG trong số đã qua filter)

```ts
interface RankingWeights {   // cấu hình được trong UI, hiển thị cho người dùng
  resolutionMargin: number;  // default 0.25
  availability:     number;  // 0.20  — có sẵn ở VN / lead time
  price:            number;  // 0.20
  priorProjectUse:  number;  // 0.15  — đã dùng trong dự án trước của phòng
  localSupport:     number;  // 0.10
  roadmap:          number;  // 0.10  — dư địa nâng cấp
}
```

UI hiển thị `Rank score` kèm **breakdown từng thành phần**, không hiện một số 92% trần trụi. Nút "Why this?" mở `RuleResult` gốc + trọng số đã dùng.

### 8.3 Ba mức giải pháp

Sinh bằng cách **thay đổi margin target**, không phải bằng cách chọn hàng rẻ nhất:

| Mức | Margin target | Ràng buộc |
|---|---|---|
| Economy | 1.1 | **Bị chặn nếu tạo ra bất kỳ `FAIL` hoặc `MARGINAL` nào.** Khi bị chặn, hiển thị lý do thay vì hiển thị phương án rủi ro |
| Recommended | 1.3 | Mặc định |
| High Performance | 1.8 | Dư địa nâng cấp, tốc độ cao hơn |

Mỗi mức hiện: Camera / Lens / Lighting / IPC / Software / chi phí ước tính / ưu điểm / **rủi ro kỹ thuật**.

---

## 9. VISION ARCHITECTURE

Sinh graph từ kết quả engine, không vẽ cứng.

```
PRODUCT → LIGHTING → LENS → CAMERA → INTERFACE → GRABBER/NIC → IPC → VISION SW → PLC/ROBOT
```

Multi-camera:

```
[CAM 1] [CAM 2] [CAM 3] [CAM 4]
        ↓ Trigger / Network (có nhãn interface + MB/s từ THR-001)
      [ IPC ]  (có nhãn cores / RAM / PCIe từ THR-004)
        ↓
   [ Vision Software ]
        ↓ (có nhãn protocol từ INT-001)
      [ PLC ]
```

Mỗi node click được → hiện `RuleResult` đã quyết định node đó. Node có warning → badge cảnh báo. Diagram đơn giản dạng card, không animation phức tạp.

---

## 10. UI / UX

Giữ toàn bộ design language hiện tại. Chỉ thay đổi hierarchy và bổ sung flow.

### 10.1 Home

```
MACHINE VISION ENGINEERING                    ← eyebrow
Your Virtual Vision Engineer                  ← H1
Design better vision systems, step by step.   ← subtitle

┌──────────────────────────────────────────────────────┐
│ Describe your vision problem...                      │
│ (placeholder: "Tôi cần kiểm tra ngoại quan sản phẩm  │
│  380 × 280 mm, phát hiện lỗi nhỏ nhất 0.5 mm,        │
│  độ chính xác ±0.1 mm, 4 camera.")                   │
└──────────────────────────────────────────────────────┘
              [ Phân tích bài toán ]

Hoặc chọn một ứng dụng
[Đo lường] [Kiểm tra ngoại quan] [AI Vision] [3D Vision]
[Robot Guidance] [OCR / Code] [Assembly Inspection] [Khác]

── Công cụ hỗ trợ ─────────────────────────────
Vision Designer · Engineering Tools · Knowledge Base
```

Click application card → vào cùng workflow với `applicationType` pre-filled. **Không** tạo kiến trúc riêng cho từng application.

### 10.2 Step 1 — Tôi hiểu bài toán của bạn

Bảng requirement **edit được**, mỗi dòng có badge `confidence`:

```
Application     Appearance Inspection + Measurement   [đã nêu]
Object          380 × 280 mm                          [đã nêu]
Smallest defect 0.5 mm                                [đã nêu]
Accuracy        ±0.1 mm                               [đã nêu]
Camera          4                                     [đã nêu]
Working dist.   300 mm                                [GIẢ ĐỊNH] ⚠
Height var.     2 mm                                  [GIẢ ĐỊNH] ⚠
ΔT môi trường   10 K                                  [GIẢ ĐỊNH] ⚠
```

**Thông tin còn thiếu** — chỉ hỏi những gì rule đang cần, không hỏi cho đủ bộ. Mỗi câu hỏi ghi rõ nó mở khóa rule nào:

```
Bề mặt sản phẩm?  → quyết định phương án chiếu sáng (LGT-001..005)
[Matte] [Glossy] [Metallic] [Black] [Transparent] [Mixed]

Kích thước ±0.1 mm có vắt qua ranh giới giữa các camera?  → MEC-003
[Có] [Không] [Chưa rõ]

Biến động chiều cao sản phẩm?  → sai số phối cảnh (OPT-008)
[< 0.5 mm] [0.5–2 mm] [> 2 mm] [Chưa rõ]
```

### 10.3 Engineering Analysis

Trình bày **song song hai nhánh** — đây là điểm khác biệt rõ nhất so với v1.0:

```
┌─ Detection budget ────────┐  ┌─ Measurement budget ──────┐
│ Lỗi nhỏ nhất   0.5 mm     │  │ Tolerance      ±0.1 mm    │
│ px/defect      5 (giả định)│  │ U budget = T/10  0.02 mm  │
│ → 0.100 mm/px             │  │ k subpixel     3          │
│ → 3.0 MP/camera           │  │ → 0.060 mm/px             │
│                    RES-001│  │ → 8.3 MP/camera    RES-002│
└───────────────────────────┘  └───────────────────────────┘

⚡ Yếu tố quyết định: Measurement (0.060 mm/px) — chặt hơn 1.7×
   Nếu nới tolerance lên ±0.15 mm → chỉ cần 3.7 MP/camera

Ghi chú kỹ thuật: số pixel thực tế cần cho mỗi lỗi phụ thuộc độ tương
phản, chiếu sáng, chất lượng ảnh, thuật toán và tiêu chí nghiệm thu.
```

Luôn có panel **Assumptions** (list `inputsAssumed`) và panel **Warnings**.

### 10.4 Warnings — không che giấu bất định

```
⛔ MEC-001  Giãn nở nhiệt 87 µm trên span 380 mm ≈ toàn bộ dải tolerance ±0.1 mm
⛔ OPT-008  Sai số phối cảnh 0.83 mm >> U budget 0.02 mm — bắt buộc telecentric hoặc calibration
⚠ OPT-007  Telecentric cho FOV 200 mm: đường kính ~240 mm, chi phí rất cao
⚠ LGT-001  Bề mặt bóng — phương án chiếu sáng cần thử mẫu
⚠ RES-006  Độ tương phản lỗi chưa xác định — đã giả định thấp
❓ AI-003   Không thể kết luận khả thi AI khi chưa có mẫu đại diện
```

Một trợ lý kỹ thuật tốt phải nói được: **"Tôi chưa biết."**

---

## 11. ĐẦU RA (v1.0 thiếu — giá trị dùng được ngay)

### 11.1 Concept Report (PDF)

Gửi khách hàng được ngay. Cấu trúc:
Requirement → Assumptions → Engineering Analysis → Architecture → BOM → Feasibility → Warnings → Validation plan.

Bắt buộc có trang **Assumptions & Exclusions** — bảo vệ phòng khi khách đổi yêu cầu.

### 11.2 BOM Export (Excel)

Cho mua hàng và báo giá: Category / Part number / Mô tả / Qty / Đơn giá / Lead time / Nhà cung cấp / Rule ID biện luận.

### 11.3 Project & Revision

```
Vision Project
├── Revision (A, B, C...)   ← MỚI
│   ├── Requirement
│   ├── Assumptions
│   ├── Calculations
│   ├── RuleResults (+ ruleVersion)
│   ├── Architecture
│   ├── BOM
│   └── Feasibility
├── Samples
├── Validation tests
└── Notes
```
Status: `Draft → Analysis → Design → Testing → Validated → Completed`.

Lưu kèm `ruleVersion` để reproduce được báo giá cũ khi rule đã thay đổi.

---

## 12. KNOWLEDGE SYSTEM

Tham chiếu UX: Edmund Optics Knowledge Center. **Tham khảo mô hình trình bày, không copy taxonomy và không copy kiến trúc.**

### 12.1 Copy gì từ Edmund Optics

| Thành phần | Lý do |
|---|---|
| Faceted filter theo media type | Mô hình đúng; chỉ đổi bộ giá trị (§12.3) |
| Glossary A–Z riêng biệt | Khớp trực tiếp entity `TERM` (§3.1), song ngữ VN/EN |
| "Add to saved content" + My Saved Content | Của ta nối vào Project notes → mạnh hơn bản gốc |
| Badge media type trên card | Nhìn là biết đang mở công thức hay case dự án |
| Đếm số lượng + 3 sort (Relevant / Recent / A–Z) | Chi tiết nhỏ, tạo cảm giác thư viện đáng tin |

### 12.2 KHÔNG copy gì — và tại sao

**Không copy taxonomy theo dòng sản phẩm.** EO chia Imaging / Laser Optics / Microscopy / Optics / Optomechanics / Testing vì họ bán optics đa ngành. Ta chỉ làm Machine Vision → 100% nội dung sẽ rơi vào "Imaging", trục đó vô nghĩa.

Trục đúng là **7 feasibility dimension** (§7.2):

```
Resolution · Optics · Lighting · Throughput · Mechanical · Algorithm · Integration
```

Một taxonomy dùng chung cho ba nơi: Knowledge, Rule Catalog, Feasibility. Không tạo trục thứ hai.

**Không copy kiến trúc article độc lập.** EO Knowledge Center là thư viện + faceted search: không có chiều liên kết nào từ kết quả tính toán → bài viết. Article và calculator ("Technical Tool") nằm cạnh nhau như hai loại nội dung ngang hàng.

Copy nguyên mô hình đó = bỏ mất tài sản mạnh nhất của kiến trúc này: `RuleResult.knowledgeRefs`. EO không có nó vì họ không có rule engine. Ta có.

**Không copy scale.** EO có 256 resources và 240+ kỹ sư để viết. Dựng UI cho 256 bài rồi chỉ có 8 bài → thư viện rỗng, phản tác dụng.

Quy tắc: **số bài viết = số rule trong catalog §6.** Bắt đầu ~15 bài cho 15 rule nổ nhiều nhất. Thư viện đầy dần theo rule engine, không bao giờ rỗng.

**Không copy các media type marketing:** Published Article, Scientific Paper, Webinars, Trending. Đó là loại nội dung của công ty làm SEO và lead-gen.

**Không copy chính sách all-public.** Nội dung của ta có hai loại khác nhau về bản chất: kiến thức chung (public được) và case dự án thật của khách hàng (**bắt buộc internal**).

### 12.3 Media type

| Loại | Nội dung | Gắn với |
|---|---|---|
| Nguyên lý · *Principle* | Dark field hoạt động thế nào | — |
| Công thức · *Formula* | Airy disk, DOF, bandwidth | 1 hàm trong `calculation/` |
| Ghi chú rule · *Rule note* | Vì sao MEC-001 tồn tại | **1:1 với rule ID** |
| Lỗi thường gặp · *Pitfall* | Image circle nhỏ hơn sensor | rule category |
| Case dự án · *Project case* | Dự án thật — mặc định `internal` | PROJECT |
| Thuật ngữ · *Glossary* | Telecentric, global shutter | TERM |
| Checklist nghiệm thu | FAT / SAT | VALIDATION_TEST |

### 12.4 Schema

```ts
interface KnowledgeArticle {
  slug: string;
  title: { vi: string; en: string };
  mediaType: 'principle' | 'formula' | 'ruleNote' | 'pitfall'
           | 'projectCase' | 'glossary' | 'checklist';
  dimension: FeasibilityDimension;     // cùng trục với rule & feasibility
  visibility: 'public' | 'internal';   // projectCase default 'internal'

  // ─── Knowledge graph: đây là phần EO không có ───
  relatedRules: string[];              // ['MEC-001', 'MEC-003']
  relatedCalculations: string[];       // tên hàm trong calculation/
  relatedEquipmentCategories: string[];
  relatedTerms: string[];

  // ─── Truy vết nguồn: làm tốt hơn EO ───
  reviewedBy: string;
  reviewedDate: string;
  sourceReferences: string[];          // nguồn công thức
}
```

Ba field cuối là chỗ phải làm **tốt hơn** bản tham chiếu. EO đặt một disclaimer chung cho cả thư viện rằng nội dung có thể được tạo hoặc chỉnh sửa bằng AI. Knowledge base mà kỹ sư dùng để ra quyết định báo giá thì phải biết ai review, ngày nào, công thức lấy từ đâu.

### 12.5 Ba đường vào

```
Đường 1 — CONTEXTUAL (chính, EO không có):
  RuleResult.knowledgeRefs → Article
  Article.relatedRules     → "Rule này đã chạy trên dự án nào"
  Liên kết HAI CHIỀU.

Đường 2 — BROWSE (kiểu EO):
  facet dimension × mediaType, sort, count

Đường 3 — LOOKUP:
  Glossary A–Z + full-text search
```

### 12.6 Template bài viết

Năm mục, viết được trong 30 phút. Không viết dài.

```
Nguyên lý → Khi nào dùng → Công thức → Sai lầm thường gặp → Ví dụ dự án
```

### 12.7 Xử lý bài còn thiếu

Khi `knowledgeRefs` trỏ tới slug chưa tồn tại, UI hiện:

```
📄 MEC-001 — Giãn nở nhiệt trong đo lường
   Chưa có tài liệu · [Viết bài]
```

Chỗ trống trở thành backlog có thứ tự ưu tiên theo tần suất rule nổ, thay vì một danh sách bài viết mơ hồ.

---

## 13. GOLDEN TEST — BẮT BUỘC CHO RULE ENGINE

Đây là cách duy nhất chứng minh engine không nói sảng, và là hàng rào chống regression.

**Cách làm:** lấy **10–15 dự án đã chạy thật** của phòng. Input = requirement thật. Expected = thiết bị đã chọn thật + kết luận kỹ thuật thật. Engine phải cho ra **cùng bậc** kết quả.

Format:

```yaml
# tests/golden/GT-001.yaml
id: GT-001
name: "Appearance Inspection + Measurement — Automotive Part"
source: "Dự án thật, 2025"

input:
  applicationType: AppearanceInspection
  object: { sizeX: 380, sizeY: 280, surface: glossy, heightVariation: 2 }
  detection:   [{ minSize: 0.5, contrast: unknown }]
  measurement: [{ tolerance: 0.1, spanLength: 380, crossesCameraSeam: true }]
  system: { cameraCount: 4, workingDistance: 300 }
  environment: { ambientTempRange: 10 }

expect:
  calculations:
    mmPerPxDetection:   { value: 0.100, tol: 0.005 }
    mmPerPxMeasurement: { value: 0.060, tol: 0.005 }
    governing: measurement
    mpPerCamera:        { value: 8.3, tol: 0.5 }
  rulesFired:  [RES-001, RES-002, RES-003, RES-005, RES-006,
                OPT-004, OPT-006, OPT-007, OPT-008,
                LGT-001, MEC-001, MEC-003, THR-001, THR-002]
  feasibility:
    status: "NOT FEASIBLE AS SPECIFIED"
    limitingFactor: Mechanical
    failingRules: [MEC-001, MEC-003, OPT-008]
```

Tiêu chí release V1b: **toàn bộ golden test pass.**

---

## 14. V1 SCOPE — CHIA 3 GIAI ĐOẠN

v1.0 để 15 hạng mục trong một lần là quá lớn; Equipment Recommendation phụ thuộc DB spec sạch, thường là việc lâu nhất.

### V1a — Requirement Layer

1. Home page mới + Vision Engineer entry
2. Application shortcuts (8 loại, pre-fill `applicationType`)
3. LLM parser (điểm 1) → Requirement JSON có schema validation
4. Requirement summary edit được + badge confidence
5. Progressive questions (chỉ hỏi cái rule cần)
6. Default assumptions + panel Assumptions
7. Save Project + Revision
8. Tools/Knowledge/Equipment reposition trong nav

**Xong khi:** nhập bài toán bằng tiếng Việt tự nhiên → ra requirement có cấu trúc → lưu được → mở lại được.

### V1b — Engineering Core

9. Calculation Engine: RES-001..005, OPT-001..008, THR-001..005
10. Rule Engine + registry + rule catalog §6
11. Feasibility Engine (`min` + limiting factor)
12. Warnings panel
13. Architecture diagram
14. Golden test suite (10–15 case)
15. `knowledgeRefs` trong mọi `RuleResult` — **chỉ là mảng slug, chưa cần bài viết.** Chi phí gần bằng 0 nếu làm cùng rule; rất đắt nếu bổ sung sau

**Xong khi:** toàn bộ golden test pass. Đây là tiêu chí duy nhất.

### V1c — Solution Layer

16. Equipment hard filter + soft rank (reuse equipment DB hiện có)
17. Ba mức giải pháp
18. BOM
19. Concept Report PDF + BOM Excel export
20. "Why this?" (LLM explainer — điểm 2)
21. UI hiển thị `knowledgeRefs` + trạng thái "Chưa có tài liệu" (§12.7). Viết ~15 bài `ruleNote` cho các rule nổ nhiều nhất, theo template §12.6

**Xong khi:** chạy được một dự án thật từ đầu đến BOM gửi mua hàng.

### Đẩy sang V1.1

- **Thư viện Knowledge browse kiểu EO** (facet, sort, card grid) + Glossary A–Z + My Saved Content — chỉ làm khi đã có ≥ 20 bài, nếu không sẽ ra thư viện rỗng (§12.2)
- Migrate nội dung "Cẩm nang kỹ thuật" hiện có sang schema §12.4
- Các `applicationType` còn lại — V1 **chỉ làm AppearanceInspection + Measurement**, nhưng dựng đúng kiến trúc generic
- UI polish
- Validation test tracking

> Lưu ý: liên kết `RuleResult → Knowledge` là **V1b/V1c, không phải V1.1.** Chỉ có UI thư viện mới đẩy sang sau. Lý do: thêm một field mảng slug vào rule khi đang viết rule là miễn phí; đi ngược lại gắn vào ~45 rule đã viết xong thì phải sửa toàn bộ và sửa cả golden test.

### Không làm trong V1

AI training, recommendation ML, tự động mua hàng từ nhà cung cấp.

---

## 15. NGUYÊN TẮC IMPLEMENT

1. Làm tăng dần. Sau mỗi stage: chạy app, kiểm tra lỗi, verify chức năng cũ còn hoạt động, app vẫn dùng được.
2. Không xóa chức năng đang có.
3. Không thêm design system mới. Reuse component và CSS token hiện tại.
4. Khi phải quyết định thiết kế, ưu tiên: **đơn giản, reusable, engineering-oriented, explainable** — hơn là phức tạp, AI-heavy, over-engineered.
5. Ưu tiên theo thứ tự khi có xung đột: **độ ổn định > độ chính xác > tốc độ > khả năng bảo trì > dễ triển khai > chi phí.**

---

## 16. VIỆC ĐẦU TIÊN (TRƯỚC KHI CODE)

1. Inspect repository: framework, routes, components, DB schema, API, calculators, equipment data, auth.
2. Lập architecture map hiện tại.
3. Xác định module nào reuse được, đặc biệt: **calculator nào đã tính đúng → move vào `/lib/vision-engine/calculation/` và bọc thành `CalculationResult`, không viết lại.**
4. Xác định equipment DB thiếu field nào cho hard filter §8.1 (mount, image circle, pixel pitch, interface, MTF, trigger IO, IP, dải nhiệt) → lập migration plan.
5. Xác định page/component cần refactor. **Không xóa gì.**
6. Viết `/docs/VISION_ENGINEER_V1.md`: current architecture / target architecture / data model / user flow / UI flow / calculation flow / **equipment DB gap analysis** / migration plan.

Chỉ bắt đầu implement sau khi bước 6 hoàn tất.

---

## 17. TIÊU CHÍ CUỐI

Sản phẩm phải cho cảm giác:

> **"Một kỹ sư Machine Vision có kinh nghiệm được chuyển thành software."**

Không phải:

> "Một bộ calculator có thêm chatbox."

Phép thử: nhập GT-001 vào hệ thống. Nếu output **không** nói được rằng giãn nở nhiệt và sai số stitching — không phải độ phân giải camera — là yếu tố giới hạn, thì hệ thống vẫn chỉ là calculator.
