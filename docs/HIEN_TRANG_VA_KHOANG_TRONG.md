# HUKI WEB MV — ĐÁNH GIÁ HIỆN TRẠNG & KHOẢNG TRỐNG

**Thay thế hoàn toàn `VISION_ENGINEER_V1.md` bản trước.** Bản trước đọc sai thư mục (`machine-vision-app`) nên mọi kết luận trong đó đều không dùng được.

Dựa trên inspect `H:\AI Cowork\huki web mv` — snapshot 12/09/2026, 211 file.

---

## 1. ĐÍNH CHÍNH BẢN TRƯỚC

| Bản trước nói | Thực tế |
|---|---|
| Không có calculator nào | **Có engine đầy đủ**: `src/lib/vision/` 1.276 dòng, 5 module |
| Chỉ có 8 thiết bị demo | **~78 linh kiện** với spec jsonb có khoá định nghĩa rõ |
| `specs` là text tự do, không parse được | **Có `specs.ts`** định nghĩa khoá, `SENSOR_FORMATS`, `INTERFACE_BANDWIDTH` |
| Chưa có hạ tầng test | **29 unit test** riêng module vision, thêm test DB/RLS/PDF/mutation |
| SQLite, cần đổi Postgres | **Đã là Supabase/Postgres** + RLS + migration có thứ tự |
| Dùng Prisma | Dùng Supabase client |
| Design là template mặc định `create-next-app` | **Đã dọn**, dark mode theo class `.dark`, font local, có comment giải thích |
| Chưa deploy | **Đã có `vercel.json`** |

Hai tài liệu còn lại vẫn dùng được: `VISION_ENGINEER_SPEC_V1.1.md` (công thức, rule catalog) và `UI_CONTENT_V1.md` (phê bình mockup) — cả hai không phụ thuộc repo.

---

## 2. HIỆN TRẠNG

### 2.1 Stack

Next.js 16.3.2 · React 19.2.8 · TypeScript · Tailwind v4 · Supabase (Postgres + RLS) · next-intl (vi/en) · @react-pdf/renderer · TipTap · Vercel

### 2.2 Ba công cụ — xác nhận có đủ

| Route | Công cụ |
|---|---|
| `/cong-cu-chon-thiet-bi` | Bộ chọn thiết bị |
| `/cong-cu-chi-tieu` | Bộ tính chỉ tiêu (KPI) |
| `/cong-cu-may-tinh` | Bộ chọn máy tính (PC Planner) |
| `/cam-nang` | Cẩm nang |

Bản trước nói thiếu "Bộ tính chỉ tiêu" — sai, nó có, thêm cả PC Planner mà spec không nhắc tới.

### 2.3 Engine tính toán — `src/lib/vision/`

| File | Dòng | Nội dung |
|---|---|---|
| `resolution.ts` | 227 | Pixel cần theo từng trục, kiểm ngược từ camera thật, số camera + chồng lấn |
| `timing.ts` | 289 | Byte/px, băng thông, nhoè chuyển động, ngân sách chu kỳ |
| `optics.ts` | 174 | β, tiêu cự, vòng ảnh, đĩa Airy, lp/mm, DOF |
| `linescan.ts` | 147 | Tần số dòng, encoder, băng thông liên tục |
| `lighting.ts` | 90 | Bảng tra đèn theo loại lỗi × bề mặt |
| `types.ts` | 51 | `Check` với `status` + `formula` |

Rule engine đọc từ DB: `src/lib/selector/` (engine, conditions, derive). Luật nằm trong bảng `selector_rules`, không trong code.

### 2.4 Bảng dữ liệu

```
profiles · categories · articles · task_types
components · selector_rules · selector_history
kpi_config · kpi_problem_types · kpi_modifiers · kpi_tightening_factors
```

Linh kiện theo loại (file SQL mới nhất): accessory 21 · camera 10 · lens 9 · light 8 · cable 7 · pc_option 4 · controller 4 · tube 3 · software 3 · light_controller 3 · interface_card 3.

---

## 3. NĂM ĐIỂM CODE ĐÃ LÀM ĐÚNG SẴN

Đây là các yêu cầu trong SPEC v1.1 mà repo **đã đáp ứng**, không cần làm gì:

**FIX #4 — Feasibility là `min()` không phải `mean()`.** `worstStatus()` trong `index.ts` lấy trạng thái xấu nhất theo thang `info < pass < warn < fail`. Đúng nguyên tắc.

**FIX #5 — Không có `confidence` số ảo.** `Check` chỉ có `status` + `formula` + `noteKey`. Không có con số tin cậy bịa. Tốt hơn cả spec tôi viết: `formula` là chuỗi đã thay số, kỹ sư bấm máy tính kiểm lại được.

**Không che bất định.** `standingWarningKey: 'contrastDisclaimer'` luôn hiển thị dù mọi phép kiểm đều PASS, kèm comment: đủ độ phân giải không nói lên lỗi có nổi bật khỏi nền hay không.

**Ưu tiên vision truyền thống.** `APPROACH_WEIGHT` trong `engine.ts`: `rule_based 0 < hybrid 1 < deep_learning 2`, chỉ leo lên DL khi có luật nói rõ.

**Engine thuần.** Comment trong `types.ts` ghi rõ module vision không biết gì về React hay database. Đúng ranh giới §2 của spec.

Ba chỗ xử lý đúng mà bản spec của tôi cũng nêu, và code đã làm trước:

- **Băng thông derate.** `INTERFACE_BANDWIDTH` lấy GigE 110 MB/s thay vì 125 lý thuyết, kèm comment "dùng số lý thuyết là cách dự án chết ở hiện trường".
- **Byte/px của camera màu.** Comment ghi rõ đã sửa lỗi cũ lấy 3 byte/px — camera màu truyền Bayer thô 1 byte/px, lấy 3 là thổi phồng băng thông 3 lần.
- **Vòng ảnh so trên đường chéo.** `opticsChecks` có comment "không phải bề rộng". Đúng.

Một chỗ code **đúng hơn spec tôi viết**: tiêu cự dùng `f ≈ WD × β / (1 + β)` (dạng liên hợp hữu hạn). Spec tôi viết `f = sensor × WD / FOV` = `β × WD`, là xấp xỉ viễn trường. Với β = 0.1, WD = 300: code cho 27.3 mm, tôi cho 30 mm — **lệch 10%**. Code đúng. Sửa §4.2 OPT-001 của spec theo code, không ngược lại.

---

## 4. KHOẢNG TRỐNG THẬT

Đã kiểm từng file. Đây là những gì còn thiếu, xếp theo mức ảnh hưởng.

### GAP 1 — Không có nhánh đo lường theo dung sai ⛔ CAO

`AppearanceInput` có `defectMinSizeMm` và `pxPerDefect`, **không có `toleranceMm`**.

Bài đo lường hiện xử lý bằng cách người dùng tự đặt `pxPerDefect = 10` (theo `PX_PER_DEFECT_GUIDE`, `goalKey: 'measure'`). Đó là kinh nghiệm "10 px trên chi tiết nhỏ nhất", **không phải ngân sách sai số**.

Hệ quả: công cụ trả lời được "có 10 px trên chi tiết không", nhưng **không trả lời được "±0.1 mm có khả thi không"** — mà đó lại là câu khách hàng hỏi.

Cần thêm:
```
T_total = 2 × tolerance
U_budget = T_total / GRR_divisor      (10 tốt, 4 tối thiểu)
mmPerPxMeasurement = U_budget × k_subpixel   (k = 3)
mmPerPxGoverning = min(detection, measurement)
```
Xem §4.1 SPEC. Giữ nguyên nhánh detection đang có, thêm nhánh thứ hai song song.

### GAP 2 — Không có sai số phối cảnh (OPT-008) ⛔ CAO

`heightToleranceMm` đã tồn tại nhưng **chỉ dùng để so với DOF**. Sai số phối cảnh không được tính ở đâu cả.

```
perspective_error ≈ (heightVariation / WD) × r_offaxis
```

Với lens entocentric, đây là nguồn sai số đo lớn nhất. Ví dụ FOV 380×280, Δh = 2 mm, WD = 300: sai số 1.57 mm — trong khi dung sai là ±0.1 mm.

Dữ liệu đã có sẵn (`heightToleranceMm`, `workingDistanceMm`, `fovWidthMm/HeightMm`). Chỉ cần thêm phép tính, không cần thêm trường nhập.

### GAP 3 — Không có giãn nở nhiệt (MEC-001) ⚠ TRUNG BÌNH-CAO

Vắng hoàn toàn. Không có trường vật liệu, không có ΔT.

```
thermal_error = α × L × ΔT
Nhôm: 23 µm/(m·K) × 0.38 m × 10 K = 87 µm
```

Với dung sai ±0.1 mm (ngân sách 20 µm), riêng nhiệt đã vượt 4.4 lần. Chỉ có nghĩa khi GAP 1 xong (phải có `tolerance` mới có ngân sách để so).

### GAP 4 — Không kiểm ghép ảnh giữa camera (MEC-003) ⚠ TRUNG BÌNH

`cameraCount()` tính được cần bao nhiêu camera để phủ chiều dài, có chồng lấn. Nhưng **không kiểm** liệu một kích thước cần đo vắt qua ranh giới giữa hai camera có đo nổi hay không.

Với hệ nhiều camera đo span lớn, sai số hiệu chuẩn/ghép ảnh thường là yếu tố giới hạn thật, không phải pixel size. Cần thêm trường `crossesCameraSeam` và phép kiểm tương ứng.

### GAP 5 — Không có trần khả thi của telecentric (OPT-007) ⚠ TRUNG BÌNH

Ống telecentric cần đường kính đầu ≈ 1.15–1.3 × kích thước FOV. FOV 380 mm → cần ống ~450 mm: không có sản phẩm thương mại ở giá chấp nhận được.

Nếu bảng `selector_rules` gợi ý telecentric cho FOV lớn thì đang gợi ý thứ không mua được. Cần một luật chặn kèm phương án thay thế: chia nhỏ FOV/camera, hoặc kẹp ổn định chiều cao rồi hiệu chuẩn.

### GAP 6 — `SENSOR_FORMATS` thiếu 1.1" và APS-C ⚠ TRUNG BÌNH, sửa nhanh

Bảng hiện có: 1/3, 1/2.5, 1/2, 1/1.8, 2/3, 1, 4/3.

**Thiếu 1.1"** — đây là format phổ biến nhất của camera công nghiệp 12–24 MP hiện nay (IMX253, IMX255, IMX531). Thiếu nó thì nhóm camera đang dùng nhiều nhất không tính được tiêu cự.

```ts
'1.1':   { widthMm: 14.13, heightMm: 10.35 },   // đường chéo 17.5
'APS-C': { widthMm: 23.60, heightMm: 15.60 },   // đường chéo 28.3
```

**Lưu ý coupling:** `SENSOR_FORMAT_ORDER` là mảng riêng, dùng để so vòng ảnh. Thêm vào `SENSOR_FORMATS` mà quên `SENSOR_FORMAT_ORDER` thì phép kiểm vòng ảnh sẽ âm thầm bỏ qua format mới — không FAIL, không cảnh báo. Nên đổi thành **một nguồn duy nhất**: thêm `order` hoặc `diagonalMm` vào chính `SENSOR_FORMATS` rồi sort, xoá mảng thứ hai.

### GAP 7 — `INTERFACE_BANDWIDTH` thiếu 2 chuẩn ⚠ THẤP, sửa nhanh

Thiếu `CXP-12` (~1200 MB/s mỗi lane) và Camera Link.

**Đã sửa:** thêm `CXP-12` = 1200 MB/s/lane (12,5 Gbps; BitFlow, KAYA, Euresys). Camera Link tách theo cấu hình: `CameraLink-Base` 255, `-Medium` 510, `-Full` 680, `-Deca` 850 MB/s (Gidel, Agmanic). Con số ~800 MB/s ghi ở bản trước không khớp cấu hình nào nên đã bỏ.

### GAP 8 — Ba công cụ còn rời rạc 🔵 ĐÂY MỚI LÀ VIỆC CHÍNH

Đây chính là nội dung spec yêu cầu, và là khoảng trống lớn nhất về **sản phẩm** (khác với khoảng trống về kỹ thuật ở GAP 1–7).

Hiện tại: 3 công cụ độc lập, `selector_history` lưu từng lần chạy bộ chọn thiết bị.

Còn thiếu:
- Thực thể **PROJECT** với revision (Rev A/B/C khi khách đổi yêu cầu)
- Luồng liên thông: nhập bài toán → phân tích → kiến trúc → thiết bị → khả thi → lưu
- Điểm khả thi tổng hợp theo 7 hạng mục (hiện `worstStatus` chỉ chạy trong phạm vi một lần phân tích)
- Trang chủ theo hướng trợ lý kỹ thuật (xem `UI_CONTENT_V1.md` màn 1)
- Ô nhập bằng lời điền trước cho wizard

---

## 5. KẾ HOẠCH SỬA LẠI

Bỏ kế hoạch V1a/V1b/V1c ở bản trước — nó viết cho một repo trống. Kế hoạch mới:

### Giai đoạn A — Bịt lỗ kỹ thuật (thuần engine, không đụng UI)

Làm trong `src/lib/vision/`, mỗi phép tính kèm unit test theo đúng phong cách 29 test đang có.

1. **GAP 6 + 7** — thêm 1.1"/APS-C, CXP-12/CameraLink. Gộp `SENSOR_FORMAT_ORDER` vào `SENSOR_FORMATS`. *Nửa ngày, sửa nhanh nhất, giá trị ngay.*
2. **GAP 1** — thêm `toleranceMm` vào `AppearanceInput`, thêm nhánh measurement, `mmPerPxGoverning = min()`. Hiển thị **cả hai nhánh song song** và nêu rõ nhánh nào quyết định.
3. **GAP 2** — `perspectiveErrorMm()` trong `optics.ts`, so với `U_budget` từ bước 2.
4. **GAP 3** — `thermalErrorUm()` + trường vật liệu/ΔT.
5. **GAP 4** — `crossesCameraSeam` + phép kiểm ghép ảnh.
6. **GAP 5** — luật chặn telecentric, thêm vào bảng `selector_rules` (không hardcode).

**Xong khi:** bộ test vision tăng từ 29 lên ~45 test, `npm run test:all` xanh.

### Giai đoạn B — Gắn kết thành Vision Engineer

7. Bảng `projects` + `project_revisions`, migrate `selector_history` vào
8. Feasibility tổng hợp 7 hạng mục (dùng lại `worstStatus` đã có)
9. Trang chủ mới + nav theo `UI_CONTENT_V1.md`
10. Luồng wizard liên thông 3 công cụ
11. Ô nhập bằng lời → điền trước wizard

### Giai đoạn C

12. Nhập thêm linh kiện (xem mục 6)
13. Xuất Concept Report PDF theo dự án — hạ tầng `@react-pdf/renderer` đã có
14. Liên kết kết quả → cẩm nang

---

## 6. VỀ DỮ LIỆU LINH KIỆN

Đánh giá lại: **không phải nút cổ chai như tôi nói trước**, nhưng vẫn cần bổ sung.

Hiện có 10 camera, 9 lens, 8 đèn. Đủ để engine chạy và test, chưa đủ để hard filter luôn trả về kết quả cho mọi bài toán.

Việc cần làm khác với bản trước: không phải "nhập từ 8 lên 110". Mà là:

1. **Kiểm xem spec jsonb của 10 camera hiện có đã đủ khoá chưa** — đặc biệt `pixelSizeUm`, `sensorFormat`, `interfaceName` (engine đang đọc 3 khoá này). Thiếu một khoá thì engine trả `null` và bỏ qua phép kiểm, âm thầm.
2. **Cột `source`** đã có sẵn 3 mức `unverified / datasheet / measured`. Ưu tiên nâng 10 camera hiện có lên `datasheet` trước khi thêm cái mới. Dữ liệu sai tệ hơn dữ liệu thiếu.
3. Bổ sung dần lên ~25–30 camera, 30 lens, 20 đèn.

File `NHAP_DU_LIEU_VISION.xlsx` tôi gửi trước **cần sửa lại** để khớp khoá jsonb thật của bảng `components`, thay vì bảng tôi tự thiết kế. Sheet DỰ ÁN CŨ vẫn dùng được nguyên.

---

## 7. HAI THỨ CẦN GIỮ NGUYÊN

**Phong cách code hiện tại.** Comment tiếng Việt giải thích *vì sao* chứ không chỉ *làm gì*, kèm ghi chú cách làm cũ sai ở đâu. Tên test đọc như yêu cầu kỹ thuật. Đây là chất lượng cao hơn mức trung bình đáng kể — mọi code thêm vào phải theo đúng phong cách này.

**Luật nằm trong DB, không trong code.** `engine.ts` có comment: "Không có luật nào nằm trong file này". Giữ nguyên nguyên tắc đó. GAP 5 phải thêm vào bảng `selector_rules`, không viết vào TypeScript.

---

## 8. RỦI RO

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Agent code sửa lại thứ đã đúng vì tin tài liệu cũ | **Cao** | Xoá `VISION_ENGINEER_V1.md` bản cũ khỏi `docs/` ngay |
| Thêm `toleranceMm` làm vỡ 29 test đang xanh | Trung bình | Trường mới để `null` mặc định, nhánh measurement chỉ chạy khi có giá trị |
| Sửa `SENSOR_FORMATS` quên `SENSOR_FORMAT_ORDER` | Trung bình | Gộp thành một nguồn duy nhất ở bước A1 |
| Next.js 16.3 mới hơn training data | Trung bình | `AGENTS.md` đã có cảnh báo. Bắt agent đọc `node_modules/next/dist/docs/` |
| Spec §4.2 OPT-001 của tôi sai 10% so với code | Đã xử lý | Sửa spec theo code |

---

## 9. BA VIỆC LÀM NGAY

1. **Xoá `docs/VISION_ENGINEER_V1.md` bản cũ**, thay bằng file này. Bản cũ sẽ làm agent đi phá thứ đang chạy đúng.
2. **Chạy Giai đoạn A bước 1** (GAP 6+7). Nửa ngày, sửa hai bảng hằng số, có giá trị ngay.
3. **Điền sheet DỰ ÁN CŨ** trong file Excel. Không phụ thuộc code, và cần cho golden test.
