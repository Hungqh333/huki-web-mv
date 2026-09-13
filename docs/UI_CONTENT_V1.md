# VISION ENGINEER — UI CONTENT SPEC V1

Phụ lục của SPEC v1.1. Tài liệu này sửa **nội dung kỹ thuật** của bộ mockup 9 màn hình.

## Cách dùng tài liệu này

| Lấy từ mockup | Lấy từ tài liệu này |
|---|---|
| Bố cục, thứ tự bước, vị trí panel, kiểu card, progress bar 5 bước | Toàn bộ nhãn, con số, công thức, logic hiển thị, điều kiện chặn |

**Cảnh báo cho agent:** mọi con số trong mockup gốc là số minh hoạ do AI sinh, không phải kết quả tính. Không hardcode bất kỳ số nào từ mockup vào code. Mọi số hiển thị phải đến từ `/lib/vision-engine/`.

## Ba quyết định đã chốt

1. Tên sản phẩm: **Machine Vision Hub** (không dùng "SORA").
2. **Giữ wizard làm xương sống.** Thêm ô nhập bằng lời ở màn chủ, chỉ để *điền trước* cho wizard. Wizard là nguồn dữ liệu thật, LLM không bao giờ là nguồn.
3. Bỏ ảnh render 3D thiết bị. Dùng **5 icon vector** tự vẽ: camera, lens, đèn, IPC, software.

---

# PHẦN A — BÀI TOÁN THAM CHIẾU (GT-002)

Toàn bộ nội dung mẫu dưới đây dùng chính dữ liệu người dùng gõ ở màn 3 của mockup. Bổ sung vào bộ golden test §13 với ID **GT-002**.

## A.1 Input

| Thông số | Giá trị | Trạng thái |
|---|---|---|
| FOV | 380 × 280 mm | đã nêu |
| Chiều cao sản phẩm Z | 50 mm | đã nêu |
| **Biến động chiều cao Δh** | — | **chưa có — phải hỏi** |
| Lỗi nhỏ nhất | 0.5 mm | đã nêu |
| Độ tương phản lỗi | — | chưa có → giả định `low` |
| Sai số đo | ±0.1 mm | đã nêu |
| Số camera | — | **chưa có — phải hỏi** |
| Khoảng làm việc WD | — | chưa có → giả định 300 mm |
| Bề mặt | — | **chưa có — phải hỏi** |
| ΔT môi trường | — | chưa có → giả định 10 K |
| Vật liệu | — | chưa có → giả định nhôm, α = 23 µm/(m·K) |

Hình học dẫn xuất: đường chéo FOV = 472 mm → nửa đường chéo **r = 236 mm**.

## A.2 Kết quả engine

**Hai nhánh ngân sách độ phân giải (RES-001, RES-002):**

```
Detection    : 0.5 / 5          = 0.100 mm/px
Measurement  : (0.2 / 10) × 3   = 0.060 mm/px
Governing    : min              = 0.060 mm/px  ← measurement quyết định
```

Chênh **1.67×**. Mockup gốc ghi "Required resolution ≥ 12.4 MP" — con số đó chỉ tính nhánh detection và bỏ qua yêu cầu ±0.1 mm đang gõ ở màn trước.

**Số pixel theo số camera (RES-004, RES-005):**

| Cấu hình | FOV/camera | px/camera | MP/camera |
|---|---|---|---|
| 1 camera | 380 × 280 | 6334 × 4667 | **29.6 MP** |
| 2 camera (1×2) | 200 × 280 | 3334 × 4667 | **15.6 MP** |
| 4 camera (2×2) | 200 × 150 | 3334 × 2500 | **8.3 MP** |

> Số pixel làm tròn LÊN vì cần ĐỦ pixel: 380 ÷ 0,06 = 6333,3 → 6334; 200 ÷ 0,06 = 3333,3 → 3334.

Đây là lý do phải hỏi số camera trước khi gợi ý thiết bị. Không hỏi thì sai một bậc.

**Sai số phối cảnh — lens entocentric (OPT-008):**

```
Δh_max = U_budget × WD / r
1 camera (r = 236) : 0.02 × 300 / 236 = 0.025 mm
4 camera (r = 125) : 0.02 × 300 / 125 = 0.048 mm
```

Biến động chiều cao bề mặt đo **phải dưới 25–48 µm**. Lưu ý kỹ thuật quan trọng: yếu tố giới hạn là **biến động** chiều cao, không phải chiều cao 50 mm. Nếu sản phẩm luôn đặt phẳng ở đúng một cao độ thì calibration bù được hoàn toàn; biến động mới là thứ không bù được.

Mockup gốc không hỏi Δh. Phải bổ sung.

**Giãn nở nhiệt (MEC-001):**

```
23 µm/(m·K) × 0.38 m × 10 K = 87 µm
Ngân sách U = 20 µm
→ margin = 20 / 87 = 0.23   FAIL
```

Riêng nhiệt độ đã vượt ngân sách **4.4 lần**.

**Băng thông (THR-001, THR-002)** — cấu hình 4 camera 12 MP mono8:

```
Mỗi camera @ 10 fps : 12 × 1 × 10 = 120 MB/s  > GigE (115 MB/s)
Tổng               : 480 MB/s
```

GigE không đủ ngay cả cho một camera ở 10 fps. Cần 5GigE, hoặc giảm xuống 5 fps nếu nhịp sản xuất cho phép.

Mockup gốc ghi "20 MP | GigE | 17 fps (full res)" = 340 MB/s trên đường 115 MB/s. Sai 3 lần.

---

# PHẦN B — NỘI DUNG TỪNG MÀN HÌNH

## MÀN 1 — Trang chủ

**Giữ:** bố cục hero, hàng card, panel Recent Projects bên phải.

**Sửa:** 5 "Selector" chuyển xuống nav **Tools**, không để ở màn chủ. Lý do: để chúng ngang hàng CTA chính thì câu hỏi đầu tiên của người dùng thành "tôi nên mở calculator nào", đúng thứ spec yêu cầu tránh.

```
MACHINE VISION ENGINEERING                        ← eyebrow

Trợ lý kỹ sư Vision của bạn                       ← H1
Your Virtual Vision Engineer                      ← dòng nhỏ

Thiết kế hệ thống vision tốt hơn, từng bước một.  ← subtitle

┌────────────────────────────────────────────────────────┐
│ Mô tả bài toán của bạn...                              │
│                                                        │
│ VD: "Tôi cần kiểm tra ngoại quan sản phẩm 380 × 280 mm,│
│ phát hiện lỗi nhỏ nhất 0.5 mm, độ chính xác ±0.1 mm,   │
│ 4 camera."                                             │
└────────────────────────────────────────────────────────┘
        [ Phân tích bài toán ]      Hoặc chọn một ứng dụng ↓

── Ứng dụng ──────────────────────────────────────────────
[Kiểm tra ngoại quan] [Đo lường] [OCR / Đọc mã] [3D]
[Robot Guidance] [Kiểm tra lắp ráp] [AI Inspection] [Khác]

── Dự án gần đây ─────────────────────────────────────────
(giữ nguyên bố cục mockup)
```

**Hành vi ô nhập bằng lời:** submit → LLM parser (§1 điểm 1) → **mở wizard đã điền trước**, mỗi field có badge `đã nêu`. Không nhảy thẳng sang kết quả. Người dùng luôn xem lại wizard trước khi đi tiếp.

Nếu parser không nhận ra field nào → mở wizard trống, không báo lỗi.

---

## MÀN 3 — Requirement Wizard: Object & Field of View

Mockup có 5 field. Thiếu 4 field mà thiếu chúng thì engine không kết luận được. Bổ sung:

```
Đối tượng & Vùng quan sát
Object & Field of View

Chiều rộng (mm)  [ 380 ]      ┌──────────────────┐
Chiều cao (mm)   [ 280 ]      │   sơ đồ FOV      │
Chiều dày Z (mm) [  50 ]      │   (giữ nguyên)   │
                              └──────────────────┘

▸ BỔ SUNG — Biến động chiều cao bề mặt đo (mm)   [      ]
  Height variation
  ⓘ Quyết định sai số phối cảnh. Không phải chiều dày 50 mm —
    là mức dao động giữa các sản phẩm và độ phẳng khi đặt.
  ( ) < 0.05    ( ) 0.05 – 0.5    ( ) > 0.5    ( ) Chưa rõ

Lỗi nhỏ nhất (mm)     [ 0.5 ]

▸ BỔ SUNG — Độ tương phản lỗi
  Defect contrast
  ( ) Cao   ( ) Trung bình   ( ) Thấp   ( ) Chưa rõ
  ⓘ Chưa rõ → hệ thống giả định Thấp (5 px/lỗi)

Sai số đo yêu cầu (± mm)   [ ±0.1 ]

▸ BỔ SUNG — Kích thước cần đo có vắt qua ranh giới camera?
  ( ) Có   ( ) Không   ( ) Chưa rõ
  ⓘ Nếu có, sai số ghép ảnh giữa camera trở thành yếu tố giới hạn

▸ BỔ SUNG — Số camera dự kiến     [    ]
  ⓘ Để trống thì hệ thống sẽ đề xuất
```

Bổ sung vào **bước Environment**: `ΔT môi trường (K)`, `Vật liệu sản phẩm`. Hai field này quyết định MEC-001 — hiện mockup không hỏi, nên không bao giờ phát hiện được vấn đề giãn nở nhiệt.

---

## MÀN 4 — Feasibility (thay cho "System Score 92/100")

Đây là màn phải sửa nhiều nhất. Mockup chấm 92/100 "Very Good" cho một cấu hình không khả thi.

**Bỏ hoàn toàn** vòng tròn điểm tổng kiểu trung bình. Thay bằng `min()` + yếu tố giới hạn.

```
┌─────────────────────────────────────────────────────────────┐
│  ⛔  CHƯA KHẢ THI VỚI YÊU CẦU HIỆN TẠI                       │
│      NOT FEASIBLE AS SPECIFIED                              │
│                                                             │
│      Yếu tố giới hạn: CƠ KHÍ / NHIỆT  và  QUANG HỌC         │
│                                                             │
│  Độ phân giải camera KHÔNG phải vấn đề. Hai yếu tố khác     │
│  đang quyết định.                                           │
└─────────────────────────────────────────────────────────────┘

Đánh giá theo 7 hạng mục                     Điểm = min(tất cả)

Độ phân giải   ████████████████░░░░  85  ĐẠT      RES-002,004
Quang học      ████░░░░░░░░░░░░░░░░  20  KHÔNG    OPT-007,008
Chiếu sáng     ████████████░░░░░░░░  60  CHƯA RÕ  LGT-001
Thông lượng    ██████████████░░░░░░  70  SÁT GIỚI HẠN THR-002
Cơ khí/Nhiệt   ████░░░░░░░░░░░░░░░░  20  KHÔNG    MEC-001
Thuật toán     ████████████░░░░░░░░  60  CHƯA RÕ  AI-003
Tích hợp       ████████████░░░░░░░░  60  CHƯA RÕ  INT-001

⚠ Đây là đánh giá kỹ thuật, không phải chân lý toán học.
  Bắt buộc thử mẫu thật trước khi chốt phương án.
```

**Panel điều kiện để khả thi** — bắt buộc có khi trạng thái là KHÔNG KHẢ THI, lấy từ `RuleResult.alternatives`:

```
Để chuyển thành khả thi, cần ít nhất một trong:

CƠ KHÍ / NHIỆT — MEC-001
Giãn nở nhiệt 87 µm trên span 380 mm, ngân sách chỉ 20 µm
  • Kiểm soát nhiệt độ vùng đo trong ±2 K
  • Hoặc đặt vật chuẩn (reference artifact) trong ảnh để bù nhiệt
  • Hoặc nới sai số lên ±0.2 mm  → khi đó ngân sách thành 40 µm
  • Hoặc chỉ đo kích thước ngắn (< 100 mm), không đo span toàn bộ

QUANG HỌC — OPT-008
Biến động chiều cao phải dưới 48 µm (cấu hình 4 camera, WD 300)
  • Kẹp giữ / hút chân không để ổn định mặt phẳng đo
  • Hoặc tăng WD lên 1000 mm  → cho phép tới 160 µm, cần không gian
  • Hoặc chia nhỏ FOV/camera xuống ≤ 100 mm rồi dùng telecentric

Chưa thể kết luận vì thiếu thông tin:
  ❓ Bề mặt sản phẩm → chưa chọn được phương án chiếu sáng
  ❓ Nhịp sản xuất   → chưa kiểm được thời gian chu kỳ
  ❓ Ảnh mẫu thật    → chưa kết luận được khả thi AI
```

**Danh sách Key Requirements của mockup thiếu 3 dòng quan trọng nhất.** Mockup có: Resolution, FOV, Defect size, Speed, AI performance, Working distance. Bổ sung:

```
✓ Độ phân giải      ĐẠT      margin 1.2×
✓ Vùng quan sát     ĐẠT
✓ Kích thước lỗi    ĐẠT
⛔ Chiếu sáng        CHƯA RÕ   ← BỔ SUNG (nguyên nhân hỏng số 1 thực tế)
⛔ Cơ khí / Nhiệt    KHÔNG ĐẠT ← BỔ SUNG
⛔ Ghép ảnh/Calib.   KHÔNG ĐẠT ← BỔ SUNG
⚠ Thông lượng       SÁT GIỚI HẠN
❓ Hiệu năng AI      CHƯA RÕ
```

---

## MÀN 5 — So sánh 3 phương án

**Lỗi logic của mockup:** hàng "Accuracy: ±0.20 / ±0.10 / ±0.05 mm" coi độ chính xác như một mức để chọn. Nhưng ±0.1 mm là **yêu cầu của khách**, không phải núm điều chỉnh.

Economy ghi ±0.20 mm nghĩa là Economy **không đạt yêu cầu** — theo §8.3 nó phải bị chặn, không được bày ra như phương án rẻ hơn. Bày ra là mời người bán báo giá một hệ thống chắc chắn trượt FAT.

Và ±0.05 mm ở High Performance thì **không mua được bằng camera tốt hơn** — giãn nở nhiệt trên span 380 mm đã là 87 µm. Ngụ ý "trả thêm tiền thì chính xác hơn" là chỗ gây hiểu sai nguy hiểm nhất cả bộ mockup.

**Cấu trúc mới:**

```
┌─────────────────────────────────────────────────────────────┐
│ Yêu cầu bắt buộc: sai số ±0.1 mm · lỗi 0.5 mm · FOV 380×280 │
│ Cả 3 phương án dưới đây đều phải đạt các mức này.           │
│ Chênh nhau ở hệ số an toàn, tốc độ và dư địa nâng cấp.      │
└─────────────────────────────────────────────────────────────┘

                 Tiết kiệm      ĐỀ XUẤT        Hiệu năng cao
                 (bị chặn)      margin 1.2×    margin 1.8×
─────────────────────────────────────────────────────────────
Camera           —              4 × 12 MP      4 × 20 MP
Lens             —              Entocentric    Telecentric
                                + calibration  (FOV 100mm/cam)
Chiếu sáng       —              (chờ bề mặt)   (chờ bề mặt)
IPC              —              i7 + 5GigE     i9 + 10GigE
Software         —              HALCON         HALCON
─────────────────────────────────────────────────────────────
Dư độ phân giải  —              1.2×           1.85×
  mm/px          —              0.050          0.0325
Dư thời gian     —              chưa rõ nhịp   chưa rõ nhịp
Chi phí ước tính —              (từ BOM)       (từ BOM)
─────────────────────────────────────────────────────────────
Rủi ro chính     —              Δh phải < 48µm 8 camera,
                                Cần bù nhiệt   lắp đặt phức tạp
```

**Ô Economy hiển thị:**

```
┌──────────────────────────┐
│  ⛔ KHÔNG KHẢ DỤNG        │
│                          │
│  Phương án tiết kiệm với │
│  margin 1.1× không đạt   │
│  sai số ±0.1 mm.         │
│                          │
│  Hệ thống không đề xuất  │
│  cấu hình có rủi ro kỹ   │
│  thuật đã biết.          │
│                          │
│  [ Xem cần nới gì ]      │
└──────────────────────────┘
```

**Quan trọng:** dư độ phân giải phải tính trên **mm/px**, không phải MP. Mockup ghi "Margin +61%" từ 20 MP / 12.4 MP. Nhưng MP tỉ lệ với **bình phương** độ phân giải tuyến tính: dư 61% MP chỉ bằng dư **27%** về mm/px. Mockup phóng đại hệ số an toàn hơn 2 lần.

---

## MÀN 6 — Sơ đồ hệ thống & "Vì sao chọn?"

**Đây là màn hay nhất của mockup.** Bố cục sơ đồ dọc + panel Component Details + tab theo thành phần + khối "Why we chose this?" — giữ nguyên toàn bộ.

**Sửa nội dung:**

Nhãn trên mũi tên giữa các node phải là số thật từ engine:

```
[4 × CAMERA] 12 MP mono, global shutter
      │ 4 × 120 MB/s = 480 MB/s · 5GigE  ← từ THR-001/002
      ▼
[NIC 4 port 5GigE]
      │
      ▼
[IPC] i7, 12 core, 32 GB, 2 khe PCIe   ← từ THR-004
      │
      ▼
[HALCON]
      │ PROFINET, < 50 ms                ← từ INT-001
      ▼
[PLC]
```

Khối "Vì sao chọn?" — thay 3 dòng tick của mockup bằng:

```
Vì sao chọn camera này?
Why this camera?

Yêu cầu tính được
  • Ngân sách phát hiện lỗi   0.100 mm/px  →  3.0 MP/camera
  • Ngân sách đo lường        0.060 mm/px  →  8.3 MP/camera
  • Quyết định: đo lường (chặt hơn 1.67×)          RES-003

Thiết bị đã chọn
  • 12 MP (4096 × 3000) → 0.0488 × 0.050 mm/px (ngang × dọc)
  • Dư 1.2× so với yêu cầu 0.060 mm/px — tính theo trục THÔ hơn (dọc 150 ÷ 3000 = 0.050),
    vì kích thước cần đo có thể nằm theo trục bất kỳ. Chỉ lấy trục ngang sẽ ra 1.23×, lạc quan.

Ràng buộc cứng đã kiểm
  ✓ Pixel pitch 3.45 µm → F# tối đa 4.1            OPT-004
  ✓ Global shutter (sản phẩm di chuyển)            THR-005
  ✓ 120 MB/s ≤ 5GigE (570 MB/s)                    THR-002
  ✓ Ngàm C khớp image circle lens 11 mm            OPT-002

Giả định đã dùng
  • Độ tương phản lỗi: Thấp (chưa xác nhận)
  • WD 300 mm (chưa xác nhận)
  • mono8 (chưa xác nhận có cần kiểm tra màu)

⚠ Độ phân giải camera đạt, nhưng chiếu sáng và cơ khí
  mới là yếu tố giới hạn của hệ thống này.          LGT-009
```

**Ba lỗi dữ liệu trong mockup phải bỏ:**

| Mockup ghi | Vấn đề |
|---|---|
| "Sensor 1.1" Sony IMX530" với 5472×3648 @ 2.4 µm | 5472×3648 × 2.4 µm = 13.1 × 8.8 mm → cỡ 1", không phải 1.1". Lệch cỡ cảm biến → lệch đường chéo (16 vs 17.5 mm) → lệch yêu cầu image circle của lens, đúng ràng buộc OPT-002 mà mockup không kiểm |
| "20 MP \| GigE \| 17 fps (full res)" | 340 MB/s trên đường 115 MB/s. Sai 3 lần |
| "Opto Engineering 35 mm \| Telecentric" | Telecentric quy định bằng **độ phóng đại** (0.36×), không phải tiêu cự. Nhãn này không tồn tại |

**Về telecentric (OPT-007):** ống telecentric cần đường kính đầu ≈ 1.15–1.3 × kích thước FOV. FOV 380 mm → cần ống ~450 mm: không có sản phẩm thương mại ở giá chấp nhận được. Ngay cả 200 mm/camera vẫn cần ống ~240 mm, cực đắt. Chỉ đề xuất telecentric khi FOV/camera ≤ 100 mm, và luôn kèm cảnh báo chi phí.

---

## MÀN 7 — BOM & Báo giá

**Giữ:** bảng, 4 nút Export PDF / Export Excel / Generate Quotation / Save Project.

**Sửa:** BOM của mockup có 6 dòng (Camera, Lens, Lighting, IPC, Software, Accessories) — thiếu những dòng mà thiếu sẽ bị mua hàng trả lại:

```
Danh mục          Hạng mục                    SL   Rule
─────────────────────────────────────────────────────────
Camera            12 MP mono global shutter    4   RES-004
Lens              Entocentric 25 mm            4   OPT-001
Chiếu sáng        (chờ xác định bề mặt)        —   LGT-001
▸ Card mạng       NIC 4 port 5GigE             1   THR-002  ← BỔ SUNG
▸ Cáp             Cat6A 5 m                    4   THR-007  ← BỔ SUNG
▸ Nguồn đèn       Strobe controller            1   LGT-008  ← BỔ SUNG
▸ Vật chuẩn       Calibration target           1   MEC-003  ← BỔ SUNG
▸ Gá cơ khí       Gá camera cứng, điều chỉnh   4   MEC-002  ← BỔ SUNG
IPC               i7, 32 GB, 2 PCIe            1   THR-004
Software          HALCON runtime               4   —
```

**Bắt buộc thêm khối Giả định & Loại trừ** ở cuối BOM — đây là thứ bảo vệ phòng khi khách đổi yêu cầu:

```
GIẢ ĐỊNH & LOẠI TRỪ
Assumptions & Exclusions

Báo giá này dựa trên các giả định sau. Nếu thực tế khác,
cấu hình và giá sẽ thay đổi:

  • Biến động chiều cao bề mặt đo < 48 µm
  • Nhiệt độ vùng đo ổn định trong ±2 K
  • Độ tương phản lỗi: chưa xác nhận, đã giả định Thấp
  • Khoảng làm việc 300 mm
  • Bề mặt sản phẩm: chưa xác định → chưa chốt chiếu sáng

KHÔNG bao gồm:
  • Gá cơ khí tổng thể và kết cấu khung
  • Kiểm soát nhiệt độ môi trường
  • Thử nghiệm mẫu và hiệu chỉnh tại hiện trường
  • Đào tạo vận hành

Trạng thái khả thi tại thời điểm báo giá:
  ⛔ CHƯA KHẢ THI — xem mục Feasibility
```

---

# PHẦN C — SONG NGỮ

Tiếng Việt dài hơn tiếng Anh **20–30%**. Bảng so sánh màn 5 và sidebar wizard trong mockup đang chật — dịch sau sẽ vỡ layout. Phải thiết kế với nhãn tiếng Việt ngay từ đầu.

**Quy tắc:** nhãn chính tiếng Việt, thuật ngữ English ở dòng nhỏ bên dưới (không phải trong ngoặc cùng dòng — sẽ tràn).

| Tiếng Việt | English | Ký tự |
|---|---|---|
| Vùng quan sát | Field of View | 13 vs 13 |
| Độ phân giải không gian | Spatial Resolution | 22 vs 18 |
| Biến động chiều cao | Height Variation | 19 vs 16 |
| Sai số phối cảnh | Perspective Error | 17 vs 17 |
| Độ tương phản lỗi | Defect Contrast | 18 vs 15 |
| Yếu tố giới hạn | Limiting Factor | 16 vs 15 |
| Giãn nở nhiệt | Thermal Expansion | 14 vs 17 |
| Ghép ảnh / Hiệu chuẩn | Stitching / Calibration | 21 vs 23 |
| Chưa khả thi với yêu cầu hiện tại | Not feasible as specified | 33 vs 25 |
| Sát giới hạn | Marginal | 12 vs 8 |
| Chưa rõ | Unknown | 7 vs 7 |
| Dư độ phân giải | Resolution margin | 16 vs 17 |

**Cột bảng màn 5:** đặt chiều rộng cố định theo nhãn tiếng Việt dài nhất, không dùng `auto`.

---

# PHẦN D — GOLDEN TEST GT-002

```yaml
id: GT-002
name: "Đo lường + ngoại quan, FOV lớn — từ mockup màn 3"
source: "Input người dùng trong bộ mockup 9 màn"
purpose: "Bắt lỗi engine chỉ tính nhánh detection và bỏ qua tolerance"

input:
  object:      { sizeX: 380, sizeY: 280, heightZ: 50, heightVariation: null }
  detection:   [{ minSize: 0.5, contrast: null }]
  measurement: [{ tolerance: 0.1, spanLength: 380, crossesCameraSeam: null }]
  system:      { cameraCount: null, workingDistance: null }
  environment: { ambientTempRange: null }

expect:
  calculations:
    mmPerPxDetection:   { value: 0.100, tol: 0.005 }
    mmPerPxMeasurement: { value: 0.060, tol: 0.005 }
    governing: measurement
    mpPerCamera_1cam: { value: 29.6, tol: 1.0 }
    mpPerCamera_4cam: { value: 8.3,  tol: 0.5 }
    thermalErrorUm:   { value: 87,   tol: 5 }
    maxHeightVariationMm_4cam: { value: 0.048, tol: 0.005 }

  mustAskBeforeConcluding:
    - object.heightVariation
    - object.surface
    - system.cameraCount
    - production.taktTime

  rulesFired: [RES-001, RES-002, RES-003, RES-004, RES-006,
               OPT-001, OPT-004, OPT-007, OPT-008,
               LGT-001, LGT-009, MEC-001, THR-001, THR-002, AI-003]

  feasibility:
    status: "NOT FEASIBLE AS SPECIFIED"
    limitingFactors: [Mechanical, Optics]
    failingRules: [MEC-001, OPT-008]
    resolutionStatus: PASS   # quan trọng: độ phân giải KHÔNG phải vấn đề

  mustNotOutput:
    - "điểm tổng dạng trung bình các hạng mục"
    - "trạng thái Good/Excellent khi có bất kỳ FAIL"
    - "phương án Economy không đạt tolerance yêu cầu"
    - "margin tính trên MP thay vì mm/px"
```

---

# PHẦN E — CHECKLIST GIAO CHO AGENT

Trước khi dựng bất kỳ màn hình nào:

- [ ] Không hardcode số nào từ mockup. Mọi số đến từ `/lib/vision-engine/`
- [ ] Màn 4 hiển thị `min()` + yếu tố giới hạn, **không** hiển thị trung bình
- [ ] Bất kỳ dimension `FAIL` → trạng thái tổng là KHÔNG KHẢ THI, kèm panel điều kiện
- [ ] Phương án Economy bị chặn nếu tạo ra `FAIL` hoặc `MARGINAL`
- [ ] Margin hiển thị trên **mm/px**, không phải MP
- [ ] Màn 3 có đủ 4 field bổ sung ở Phần B
- [ ] Mọi số hiển thị kèm được rule ID khi hover/click
- [ ] Mọi field `assumed` có badge cảnh báo, liệt kê trong panel Assumptions
- [ ] Nhãn tiếng Việt là nhãn chính, chiều rộng cột cố định
- [ ] Ô nhập bằng lời mở **wizard đã điền trước**, không nhảy sang kết quả
- [ ] 5 Selector nằm ở nav Tools, không ở màn chủ
- [ ] Không dùng ảnh render 3D thiết bị; dùng 5 icon vector
- [ ] GT-002 pass trước khi dựng UI màn 4, 5, 6
