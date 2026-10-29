# Báo cáo kiểm tra tự động — Chọn ống kính

Ngày 2026-10-29 · Người nhận: anh Hùng · Phạm vi: trang `/chon-ong-kinh` (engine `src/lib/vision/lensSelector.ts`)

## 1. Kết luận nhanh

| | Kết quả |
|---|---|
| Công thức engine (β, vùng nhìn, mm/px, F#max, F nên đặt, WD thật, phụ kiện) | **Đúng.** 0 lỗi trên khoảng 1,6 triệu lượt so với công thức tính lại độc lập, cả kho giả lập lẫn kho thật |
| Kết luận Đạt / Cảnh báo / Loại từng phép kiểm | **Đúng.** 454.494 lượt khớp, 6 lượt nằm sát ngưỡng (chênh < 0,1 %) |
| Lỗi thật phát hiện | **1 lỗi (F1):** nhập đúng con số "WD thật ≈ N mm" đang hiển thị thì ống bị loại vì "vùng nhìn hẹp". Đã tái hiện trên giao diện |
| Vấn đề nghiệp vụ cần anh chốt | **2 vấn đề (F2, F3):** gần như toàn bộ 1.053 ống telecentric trong kho bị loại trong bài đo 2D thông thường |
| Tốc độ | Lọc cả kho 1.115 ống mất trung bình 2 ms, lâu nhất 4 ms |
| Test đơn vị hiện có | 43/43 đạt (test-lens-selector, test-optics-reference, test-front-focal) |

## 2. Chu trình kiểm tra đã xây

Chạy bằng một lệnh, khoảng 4 giây:

```bash
npm run verify:lens
```

- Script nằm ở `scripts/verify-lens-selector.ts`.
- Kết quả chi tiết ghi tự động ra `docs/kiem-tra/chon-ong-kinh-ket-qua.md`.
- Còn lỗi thì lệnh trả mã thoát 1 (báo đỏ).
- Tham số tuỳ chọn:
  - `--n 5000`: chạy nhiều ca hơn.
  - `--seed 7`: dùng bộ ca khác. Cùng hạt giống thì sinh lại đúng các ca cũ, nên lỗi tái hiện được.
  - `--catalog <file.xlsx>`: dùng file kho khác.

Khác với test đơn vị: test đơn vị kiểm vài ca có số tính tay. Chu trình này **sinh hàng nghìn ca ngẫu nhiên** và kiểm bốn lớp:

| Lớp | Kiểm gì | Cách kiểm |
|---|---|---|
| **A. Đối chiếu độc lập** | β cần, mm/px, β của từng ống `f ÷ (WD − sF)`, vùng nhìn, F nên đặt, WD thật, và kết luận 8 phép kiểm (ngàm, vòng ảnh, WD/MOD, vùng nhìn + LNS-005, mm/px, lp/mm, nhiễu xạ, độ sâu) | Công thức được **viết lại trong script**, không gọi hàm của engine, rồi so với engine |
| **B. Tính chất phải luôn đúng** | Trạng thái gộp đúng; thứ tự xếp đúng; không có NaN/Infinity; mỗi ống thuộc đúng một tab; đặt ống ở WD thật thì vừa khít; WD tăng không làm mất vùng nhìn; nới mm/px không làm ống đang đạt thành loại; nới LNS-005 không làm thêm ống bị loại; đảo thứ tự kho không đổi kết quả; "biết 2 trong 3" tính xuôi rồi tính ngược ra đúng số ban đầu; nhập đúng WD thật đang hiển thị thì không bị loại | Chạy engine nhiều lần với đầu vào biến đổi có chủ đích |
| **C. Phụ kiện** | Ống nối gợi ý có tổng chiều dài trong dải cần, WD nằm trong dải lấy nét mới, khai tay lại đúng ống đó thì đạt; bộ nhân có k ≥ k cần, không vượt k tối đa, sau khi lắp thì mm/px đạt; không gợi ý phụ kiện cho telecentric | Kiểm từng phụ kiện engine tự gợi ý |
| **D. Kho thật** | Chất lượng dữ liệu 1.115 ống; quét 7 bài toán điển hình × 3 camera iRayple; đo thời gian | Đọc `docs/NHAP_THIET_BI_2026-10-16_v5.xlsx` |

Số ca của lần chạy chuẩn (hạt giống 20261029):

- 3.000 bài giả lập, mỗi bài so 40 ống trong kho giả lập 400 ống. Các ống có đủ kiểu: ống thường, macro, M12, telecentric, thiếu thông số, có sF.
- 300 bài dùng camera thật, mỗi bài so **toàn bộ 1.115 ống thật**.
- Em chạy thêm 3 hạt giống khác (1, 2, 3): kết quả giống hệt, chỉ phép kiểm B11 báo lỗi.

## 3. Phát hiện

### F1 — Nhập đúng "WD thật" đang hiển thị thì ống bị loại (lỗi thật, mức Trung bình)

**Hiện tượng.** Chi tiết ống hiện "WD thật ≈ 240 mm". Người dùng nhập WD = 240 thì ống chuyển sang **Loại — "Vùng nhìn hẹp hơn vật"**. Cùng lúc đó, ô WD thật vẫn ghi "khớp WD nhập". Hai thông tin mâu thuẫn ngay trên một màn hình.

**Tái hiện trên giao diện** (`/dev/chon-ong-kinh`):

1. Chọn camera Basler a2A2590-22gm, vùng nhìn 100 × 80 mm, WD 300, bấm Hiển thị kết quả.
2. Mở chi tiết ống Coolens FF1620-5M. Ô WD thật hiện "≈ 240 mm".
3. Đổi WD thành 240, bấm Hiển thị kết quả, bật "Hiện cả ống bị loại".
4. FF1620-5M báo **Loại**: `β = 16 ÷ (240 − 0) = 0.0667 · 106.5 × 79.9 mm ⊉ 100 × 80 mm`. Ô WD thật vẫn ghi "≈ 240 mm · khớp WD nhập".

**Nguyên nhân.**

- WD thật thực tế là 240,3 mm, nhưng màn hình làm tròn xuống 240.
- Ở 240 mm, cạnh ngắn của vùng nhìn chỉ còn 79,9 mm, hụt 0,1 mm so với 80 mm cần. Phép kiểm vùng nhìn không cho hụt chút nào nên loại ống.
- Ống càng sát vật (WD nhỏ) thì sai lệch do làm tròn càng lớn.

**Tần suất.**

- Kho thật: 315/868 ống có WD thật (36 %).
- Kho giả lập: 11.664/26.188 ống (45 %).

Lỗi xảy ra mỗi khi số WD thật bị làm tròn xuống.

**Đề xuất sửa** (nhỏ, chỉ đổi cách làm tròn; không đổi công thức, không cần SQL):

1. Hiển thị WD thật **làm tròn lên** tới 1 mm, ví dụ 240,3 → "≈ 241 mm". Ở 241 mm vùng nhìn là 80,2 mm, ống đạt.
2. Chỉ ghi "khớp WD nhập" khi ống thật sự phủ được vùng nhìn ở WD đó.
3. Tính vùng nhìn bằng kích thước cảm biến chưa làm tròn (xem F4).

Sau khi sửa, chạy lại `npm run verify:lens`: phép kiểm B11 phải về 0 lỗi.

### F2 — Telecentric: kho chỉ có một giá trị WD, lệch 1 mm là bị loại (nghiệp vụ / dữ liệu, mức Cao)

- Cả **1.053/1.053** ống telecentric trong kho chỉ khai một giá trị WD (WD min = WD max, ví dụ 110 / 110).
- Engine coi WD ngoài dải hãng ghi là loại. Vì vậy chỉ khi nhập **đúng từng mm** WD danh định thì ống mới qua được phép kiểm WD.

Quét kho thật, bài đo 2D 50 × 40 mm với 3 camera iRayple (1/2.7", 2/3", 1"):

| WD nhập | Đạt | Loại vì WD ngoài dải |
|---|---:|---:|
| 110 mm (đúng WD danh định của nhiều ống) | 0 | 961 / 1.053 |
| 112 mm (lệch 2 mm) | 0 | 1.049 / 1.053 |

Thực tế ống telecentric vẫn nét trong một khoảng quanh WD danh định (độ sâu trường ảnh, thường vài mm). Kho hiện chỉ ghi một con số cho mỗi ống.

### F3 — Phép kiểm nhiễu xạ (OPT-004) loại gần hết telecentric khi pixel nhỏ (nghiệp vụ, mức Cao)

Bài đo 2D 30 × 25 mm, tab Telecentric, để trống WD:

| Camera | Đạt | Loại vì nhiễu xạ |
|---|---:|---:|
| iRayple 1280×1024, 4 µm | 20 | 918 |
| iRayple 2448×2048, 3,45 µm | 2 | 938 |
| iRayple 5472×3648, 2,4 µm | **0** | **1.053 (toàn bộ)** |

- Luật OPT-004 yêu cầu đĩa Airy ≤ 2 pixel: F# làm việc ≤ 2·pitch ÷ (2,44·λ). Với pixel 2,4 µm giới hạn là F/3,6.
- Ống telecentric phần lớn ở F/4,6–F/13. Vì vậy camera pixel nhỏ không ghép được với ống telecentric nào trong kho.
- Engine tính đúng theo luật. Vấn đề là luật hiện đang **LOẠI** ống, trong khi phép kiểm lp/mm (OPT-003) chỉ **CẢNH BÁO**.
- Trong thực tế, nhiều hệ đo vẫn dùng telecentric F/8 với pixel 3,45 µm. Đổi lại ảnh giảm độ tương phản ở chi tiết nhỏ nhất, chứ không phải không dùng được.

Thêm F2: với bài đo 2D, trang Chọn ống kính gần như không đề xuất được ống telecentric nào từ kho hiện có.

### F4 — Làm tròn kích thước cảm biến trước khi tính (mức Thấp)

- Engine làm tròn kích thước cảm biến 3 chữ số (ví dụ 3,9456 → 3,946 mm) rồi mới chia cho β.
- Vùng nhìn hiển thị vì thế lệch tối đa khoảng 0,05 % (thường ≤ 0,1 mm). Đây là các lượt ở cột "do làm tròn" của A4, A7, B4.
- Không làm sai kết luận nào: A3 có 0 lỗi, 6 ca sát ngưỡng. Lỗi này góp phần gây F1, nên sửa luôn cùng F1.

### Chất lượng dữ liệu kho (không phải lỗi phần mềm)

| Mục | Số ống | Ảnh hưởng |
|---|---:|---|
| Ống thường chưa khai sF | 62/62 | Engine dùng sF = 0, có dấu ≈. File sF của Hik (`docs/tham-khao-hang/sf-hikrobot.csv`) là ống Hik, không có trong kho iRayple |
| Ống thường thiếu MOD | 29 (dòng Coolens SFA… ngàm M42) | Phép kiểm WD báo "chưa kiểm được"; không gợi ý được ống nối |
| Thiếu lp/mm | 185 | Camera pixel < 3 µm thì cảnh báo, còn lại "chưa kiểm được" |
| Vòng ảnh (mm) lớn hơn cỡ danh nghĩa ghi kèm > 10 % | 143 | Không ảnh hưởng: engine dùng số mm theo datasheet. Cỡ chỉ là nhãn |
| Thiếu tiêu cự / ngàm / F#; F#min > F#max; WD min > max; giá trị âm hoặc lạ | 0 | — |

### Những phần đã kiểm và ĐÚNG

Lần chạy chuẩn: 0 lỗi ở tất cả các phép kiểm sau, ở cả kho giả lập và kho thật.

- A1–A2 β cần, mm/px cần.
- A3 kết luận từng phép kiểm.
- A4–A5 β, vùng nhìn, mm/px của từng ống.
- A6 F nên đặt.
- A7 WD thật.
- B1–B10:
  - trạng thái gộp, thứ tự xếp;
  - không có NaN, phần pixel dùng nằm trong [0; 1];
  - WD thật vừa khít, WD tăng 10 % không mất vùng nhìn;
  - đảo thứ tự kho không đổi kết quả;
  - nới mm/px và nới LNS-005 không làm hỏng ống đang đạt;
  - "biết 2 trong 3" tính xuôi rồi tính ngược khớp nhau;
  - mỗi ống thuộc đúng một tab.
- C1–C4 ống nối, bộ nhân, không ghép phụ kiện cho telecentric.

## 4. Giới hạn của lần kiểm này

- **Kho thật lấy từ file Excel** `NHAP_THIET_BI_2026-10-16_v5.xlsx`, không đọc trực tiếp database production. Máy local không có quyền đọc kho thật, và em không dùng khoá service-role. Nếu sau ngày 2026-10-17 anh có sửa ống kính trên admin (ví dụ khai sF), các con số ở phần kho thật có thể lệch so với production.
- **Giao diện:** em kiểm tay 1 ca để tái hiện F1. Chưa tự động hoá việc bấm trên trình duyệt.
- **Đối chiếu số của hãng:** vẫn dựa trên test hiện có (8 ống Hikrobot + datasheet Basler, đạt). Chu trình này kiểm engine có tính đúng công thức trong sổ tay không. Việc công thức có khớp thực tế quang học hay không vẫn cần ca đo thật.
- **Chưa commit.** File mới:
  - `scripts/verify-lens-selector.ts`
  - `docs/kiem-tra/chon-ong-kinh-ket-qua.md`
  - báo cáo này

  File sửa: `package.json` (thêm lệnh `verify:lens`).

## 5. Cập nhật sau khi sửa (anh chốt Q1–Q4 như đề xuất, cùng ngày)

| | Đã làm | Kết quả chạy lại |
|---|---|---|
| Q1 | WD thật làm tròn LÊN (1 mm; chụp cận WD − sF < 50 mm thì 0,1 mm); vùng nhìn tính bằng cảm biến chưa làm tròn (F4) | B11 0 lỗi; mọi cột "do làm tròn" về 0. Giao diện: FF1620 hiện "≈ 241 mm", nhập 241 → vùng nhìn 107 × 80,2 ⊇ 100 × 80, "khớp WD nhập" |
| Q2 | Ngưỡng admin mới `telecentricWdTolerance` = 0,02 (±2 %): trong dải đạt, lệch ≤ ±2 % cảnh báo, xa hơn loại | 30 × 25, WD lệch +1,5 % khỏi WD danh định phổ biến nhất: từ 0 lên 3–5 ống cảnh báo |
| Q3 | Ngưỡng admin mới `telecentricDiffractionTolerance` = 1,5×: telecentric vượt F#max ≤ 1,5 lần → cảnh báo, xa hơn → loại; ống thường giữ loại | 30 × 25, camera 3,45 µm: từ 2 lên 18 ống dùng được (2 đạt + 16 cảnh báo); camera 2,4 µm vẫn 0 (F# kho > 1,5 × F/3,6) |
| Q4 | `npm run verify:lens` thêm vào `npm run test:all` | ĐẠT, 4 hạt giống |

- Áp cho **cả hai trang**: Chọn ống kính và Thiết kế hệ thống. Hai trang dùng chung OPT-001 và OPT-004 qua hàm `telecentricWdVerdict` / `diffractionVerdict`.
- Sửa kèm: công thức hiển thị OPT-001 ở Thiết kế hệ thống còn ghi `÷ (WD − f)` (kiểu cũ trước 2026-10-26). Phần tính đã đúng `÷ (WD − sF)`, nay sửa chữ hiển thị cho khớp.
- Sổ tay OPT-001, OPT-004, OPT-012 đã cập nhật và đóng dấu lại.
- Kiểm trước commit: lint, typecheck, 596/596 test, test:pdf 3/3, build đều đạt. Không cần SQL: ngưỡng mới chỉ lưu khi admin sửa khác mặc định.

## 6. Đối chiếu với Hikrobot Lens Selector (lớp E, cùng ngày)

**Chuẩn đang dùng trước đây:** công thức Newton trong sổ tay (OPT-001, OPT-012), đối chiếu với Hik ở 8 ống, một camera, WD 300, và một ống Basler theo datasheet. Phần A–D của chu trình chỉ kiểm "code đúng công thức", chưa kiểm "công thức đúng như hãng".

**Đã làm:**

- Em tự chạy [Hikrobot Lens Selector](https://www.hikrobotics.com/en/machinevision/service/machinevisionTool/?id=3) trong trình duyệt. Công cụ này công khai; API của Hik chặn gọi thẳng từ máy, nên em chạy qua đúng trang công cụ.
- Bộ ca: 12 ca = 3 camera Hik (MV-CS004 6,9 µm · MV-CS050 3,45 µm · MV-CS200 2,4 µm) × 4 bài:
  - nhỏ 30 mm @ WD 150
  - vừa 100 @ 300
  - lớn 300 @ 800
  - chụp cận 15 @ 100
- Mỗi ca lấy hai chế độ của Hik:
  - vùng nhìn + WD → vùng nhìn từng ống;
  - tiêu cự + vùng nhìn → **WD từng ống**, tương đương "WD thật" của mình.
- Tổng cộng 44 ống Hik, 235 lượt so. Dữ liệu lưu ở `scripts/reference/hik-lens-selector-2026-10-29.json`.
- Đoạn mã thu thập để chạy lại khi Hik cập nhật: `scripts/reference/hik-collect.js`.
- `npm run verify:lens` tự đọc mọi file `scripts/reference/*-lens-selector-*.json`.

**Cách so:**

- Hik không công bố sF. Với mỗi ống, em suy sF từ **một** lần xuất hiện: lần có vùng nhìn lớn nhất, vì ít sai số làm tròn nhất.
- Sau đó cho engine **đoán mọi lần xuất hiện còn lại**: ở WD khác, camera khác, chế độ khác, kể cả khi Hik thêm vòng nối.
- Dung sai ±1 % (tối thiểu 0,15 mm cho vùng nhìn, 1 mm cho WD). Lệch quá dung sai → báo đỏ (QD).

**Kết quả: ĐẠT, khớp gần như tuyệt đối.**

| | Lượt | Lệch trung bình | Lệch lớn nhất |
|---|---:|---:|---:|
| E1 Vùng nhìn từng ống ở WD cho trước | 101 | 0,01 % | 0,52 % (Hik làm tròn 0,1 mm trên vùng nhìn 19 mm) |
| E2 WD từng ống để vừa vùng nhìn (= WD thật) | 134 | 0,02 % | 0,25 % |
| E3 WD thật trên bảng = số tính, làm tròn lên ≤ 1 mm | 134 | — | 0 lỗi |
| Trong đó có vòng nối (Hik tự thêm) | 90 | — | 0,52 % |

Kết luận rút ra:

1. Hik dùng **cùng mô hình** với engine của mình: β = f ÷ (WD − sF), mỗi ống một sF cố định. sF suy ra dao động ≤ 0,4 mm giữa các lần xuất hiện, chỉ do Hik làm tròn.
2. Vòng nối không đổi độ phóng đại ở cùng WD, đúng như OPT-010.
3. Engine tính vùng nhìn và WD thật giống Hik.

**Phát hiện mới — F5, mức Cao, là dữ liệu chứ không phải code:**

- sF thật của ống nằm trong khoảng **−20 mm đến +82 mm**. Ví dụ:
  - ống 8 mm: khoảng −14 đến −20 mm;
  - ống 25 mm: −14 đến +10 mm;
  - ống 75 mm: +82 mm.
- Nếu bỏ sF (sF = 0), vùng nhìn lệch so với Hik **trung vị 5,1 %**; 51/101 lượt lệch hơn 5 %; ống 75 mm chụp cận lệch tới 4,6 lần.
- **Cả 62/62 ống thường trong kho thật đang lấy sF = 0** (dấu ≈). Đây là nguồn sai số lớn nhất còn lại của trang Chọn ống kính.
- Đề xuất: khai sF cho các ống thường trong kho bằng ô "Nhập sF hàng loạt" ở Quản trị → Linh kiện. Nguồn sF:
  - datasheet Coolens nếu có ghi sF;
  - hoặc từ một cặp WD + β trên datasheet (ô tính giúp đã có);
  - hoặc đo khi lắp thử.

**Basler (QE):** em đã thử [Basler Lens Selector](https://www.baslerweb.com/en/tools/lens-selector/). Công cụ này chỉ lọc danh sách ống theo tiêu cự cho cảm biến; không tính vùng nhìn hay WD cho từng ống; máy tính chung không phản hồi khi điền tự động. Vì vậy chưa đưa vào chu trình. Phần đối chiếu Basler vẫn là test datasheet cũ (C125-2522, có sF).

## 7. Câu hỏi đã chốt

| # | Câu hỏi | Đề xuất của em |
|---|---|---|
| **Q1** | Sửa F1 (WD thật làm tròn lên, chỉ ghi "khớp WD nhập" khi ống đạt, tính vùng nhìn bằng cảm biến chưa làm tròn)? | **Sửa ngay.** Thay đổi nhỏ, cập nhật sổ tay OPT-012, chạy lại chu trình |
| **Q2** | F2 — WD của telecentric xử lý thế nào? | **Thêm ngưỡng admin "dung sai WD telecentric"**, mặc định ±2 % WD danh định: trong dung sai thì Cảnh báo, ngoài thì Loại. Hoặc: bổ sung dải WD thật vào kho từ datasheet (tốn công nhập liệu hơn) |
| **Q3** | F3 — nhiễu xạ với telecentric: Loại hay Cảnh báo? | **Hạ thành Cảnh báo khi vượt ≤ 1,5 × F#max, Loại khi vượt xa hơn** (ngưỡng admin), tương tự cách OPT-005 xử lý độ sâu. Đồng thời xác nhận F# trong kho Coolens là F# làm việc |
| **Q4** | Đưa `npm run verify:lens` vào bộ kiểm trước mỗi commit? | **Có.** Mất khoảng 4 giây; báo đỏ khi sửa engine ống kính làm sai công thức |
