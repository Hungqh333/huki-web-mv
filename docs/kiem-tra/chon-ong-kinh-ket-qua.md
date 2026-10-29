# Kết quả chu trình kiểm tra — Chọn ống kính

> File này do `npm run verify:lens` sinh tự động — đừng sửa tay. Chạy lúc 2026-10-29T06:42:53.347Z, hạt giống 20261029, 3000 ca giả lập, 4.5 s.

**Tổng: ĐẠT — không có lỗi.**

Kho thật: `docs/NHAP_THIET_BI_2026-10-16_v5.xlsx` — 1115 ống kính, 376 camera.

## Giả lập

| Phép kiểm | Đạt | Lỗi | Sát ngưỡng / do làm tròn |
|---|---:|---:|---:|
| A1 β cần = min(cạnh cảm biến ÷ cạnh vùng nhìn) | 3000 | 0 | 0 |
| A3 kết luận từng phép kiểm (ngàm, vòng ảnh, WD, vùng nhìn, mm/px, lp/mm, nhiễu xạ, độ sâu) | 120000 | 0 | 0 |
| A4 β ống = f ÷ (WD − sF), vùng nhìn = cảm biến ÷ β | 120000 | 0 | 0 |
| A7 WD thật = f ÷ β_vừa + sF | 86560 | 0 | 0 |
| B1 trạng thái ống gộp đúng từ các phép kiểm | 38007 | 0 | 0 |
| B3 không có NaN / undefined / Infinity trong số và công thức | 38007 | 0 | 0 |
| B3b phần pixel dùng ∈ [0; 1] | 18269 | 0 | 0 |
| B2 thứ tự xếp hạng | 1000 | 0 | 0 |
| B6 đảo thứ tự kho → cùng danh sách, cùng thứ tự | 1000 | 0 | 0 |
| B8 nới ngưỡng LNS-005 không làm thêm ống bị loại | 1000 | 0 | 0 |
| B9 biết 2 trong 3 (vùng nhìn+WD → f → ngược lại) quay vòng khớp | 3000 | 0 | 0 |
| A2 mm/px cần = pitch ÷ β | 2731 | 0 | 0 |
| A5 mm/px của ống | 94901 | 0 | 0 |
| B4 đặt ống đúng WD thật (0,1 mm) → vùng nhìn vừa khít | 26193 | 0 | 0 |
| B11 nhập đúng "WD thật ≈ N mm" đang hiển thị → ống không bị loại vì vùng nhìn hẹp | 26193 | 0 | 0 |
| A6 F nên đặt = max(F cần cho độ sâu, F nhỏ nhất của ống) | 35410 | 0 | 0 |
| B5 WD tăng 10 % không làm ống mất vùng nhìn | 2055 | 0 | 0 |
| B7 nới mm/px cần không làm ống đang đạt bị loại | 32 | 0 | 0 |
| C1 ống nối gợi ý: tổng chiều dài trong dải cần và WD nằm trong dải lấy nét mới | 7 | 0 | 0 |
| C2 khai tay đúng ống nối gợi ý → WD đạt | 7 | 0 | 0 |
| C4 không gợi ý phụ kiện cho telecentric | 14 | 0 | 0 |
| C3 bộ nhân gợi ý: k ≥ k cần, ≤ k tối đa, sau khi lắp mm/px đạt | 7 | 0 | 0 |
| B10 mỗi ống thuộc đúng một tab | 1 | 0 | 0 |

## Kho thật

| Phép kiểm | Đạt | Lỗi | Sát ngưỡng / do làm tròn |
|---|---:|---:|---:|
| A1 β cần = min(cạnh cảm biến ÷ cạnh vùng nhìn) | 300 | 0 | 0 |
| A2 mm/px cần = pitch ÷ β | 300 | 0 | 0 |
| A3 kết luận từng phép kiểm (ngàm, vòng ảnh, WD, vùng nhìn, mm/px, lp/mm, nhiễu xạ, độ sâu) | 334500 | 0 | 0 |
| A4 β ống = f ÷ (WD − sF), vùng nhìn = cảm biến ÷ β | 334500 | 0 | 0 |
| A5 mm/px của ống | 332392 | 0 | 0 |
| A7 WD thật = f ÷ β_vừa + sF | 18600 | 0 | 0 |
| B1 trạng thái ống gộp đúng từ các phép kiểm | 6133 | 0 | 0 |
| B3 không có NaN / undefined / Infinity trong số và công thức | 6133 | 0 | 0 |
| B3b phần pixel dùng ∈ [0; 1] | 459 | 0 | 0 |
| B2 thứ tự xếp hạng | 30 | 0 | 0 |
| B6 đảo thứ tự kho → cùng danh sách, cùng thứ tự | 30 | 0 | 0 |
| B4 đặt ống đúng WD thật (0,1 mm) → vùng nhìn vừa khít | 868 | 0 | 0 |
| B11 nhập đúng "WD thật ≈ N mm" đang hiển thị → ống không bị loại vì vùng nhìn hẹp | 868 | 0 | 0 |
| B5 WD tăng 10 % không làm ống mất vùng nhìn | 92 | 0 | 0 |
| B7 nới mm/px cần không làm ống đang đạt bị loại | 10 | 0 | 0 |
| B8 nới ngưỡng LNS-005 không làm thêm ống bị loại | 30 | 0 | 0 |
| A6 F nên đặt = max(F cần cho độ sâu, F nhỏ nhất của ống) | 121906 | 0 | 0 |
| B10 mỗi ống thuộc đúng một tab | 1 | 0 | 0 |

## Đối chiếu Hik

| Phép kiểm | Đạt | Lỗi | Sát ngưỡng / do làm tròn |
|---|---:|---:|---:|
| E1 vùng nhìn từng ống ở WD cho trước (±1 %, tối thiểu 0,15 mm) | 101 | 0 | 0 |
| E3 WD thật hiện trên bảng = số tính, làm tròn lên ≤ 1 mm | 134 | 0 | 0 |
| E2 WD từng ống để vừa vùng nhìn = WD thật (±1 %, tối thiểu 1 mm) | 134 | 0 | 0 |

## Chất lượng dữ liệu ống kính (kho thật)

| Mục | Số ống | Ví dụ |
|---|---:|---|
| Ống thường thiếu tiêu cự | 0 | — |
| Ống thường thiếu MOD (WD tối thiểu) | 29 | LENS-COOLENS-SFA29L-S2045-M42, LENS-COOLENS-SFA29L-S2540-M42, LENS-COOLENS-SFA29L-S3540-M42, LENS-COOLENS-SFA30L-Y2528-M42 |
| Ống thường chưa khai sF (dùng sF = 0, có dấu ≈) | 62 | LENS-COOLENS-MFA110-H16, LENS-COOLENS-MFA110-H25, LENS-COOLENS-MFA110-H08, LENS-COOLENS-MFA110-H12 |
| Ống thiếu vòng ảnh (mm hoặc cỡ) | 0 | — |
| Ống thiếu F# nhỏ nhất | 0 | — |
| Ống thiếu ngàm | 0 | — |
| Ống thiếu lp/mm | 185 | LENS-COOLENS-WWK40-108-111V3, LENS-COOLENS-WWK40-108C-111V3, LENS-COOLENS-WWH15-63CTV3, LENS-COOLENS-WWH20-110ATV4 |
| Telecentric thiếu độ phóng đại | 0 | — |
| Telecentric thiếu dải WD | 0 | — |
| Telecentric chỉ có MỘT giá trị WD (min = max hoặc chỉ một đầu) — nhập WD lệch 1 mm là loại | 1053 | LENS-COOLENS-NIR-WWK10-110CP-111-G, LENS-COOLENS-HR-WWK03-110-230, LENS-COOLENS-HR-WWK03-150-111-G, LENS-COOLENS-WWK0108-400-125-AL |
| F# nhỏ nhất > F# lớn nhất | 0 | — |
| WD min > WD max | 0 | — |
| Vòng ảnh mm lệch > 10 % so với cỡ ghi kèm | 143 | LENS-COOLENS-WWK0176-180-118, LENS-COOLENS-WWK048-165-110, LENS-COOLENS-DTCM210-216-AL, LENS-COOLENS-DTCA210-11-8-M42V2 |
| Giá trị lạ: tiêu cự ≤ 0, vòng ảnh < 3 mm hoặc > 100 mm, độ phóng đại ≤ 0 | 0 | — |

## Quét bài toán điển hình (kho thật)

| Bài toán | Camera | Đạt | Cảnh báo | Chưa kiểm được | Loại | Lý do loại nhiều nhất | ms |
|---|---|---:|---:|---:|---:|---|---:|
| Linh kiện nhỏ 20×15, WD 150, ống thường | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 1 | 3 | 0 | 58 | mountMismatch 29, fovTooWide 27 | 1 |
| Linh kiện nhỏ 20×15, WD 150, ống thường | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 0 | 3 | 0 | 59 | fovTooWide 41, mountMismatch 29 | 1 |
| Linh kiện nhỏ 20×15, WD 150, ống thường | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 0 | 0 | 62 | fovTooWide 49, diffractionLensTooSlow 35 | 0 |
| Bo mạch 100×80, WD 300, ống thường | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 4 | 0 | 0 | 58 | fovTooSmall 51, mountMismatch 29 | 0 |
| Bo mạch 100×80, WD 300, ống thường | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 6 | 0 | 0 | 56 | fovTooSmall 35, mountMismatch 29 | 0 |
| Bo mạch 100×80, WD 300, ống thường | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 2 | 0 | 60 | fovTooSmall 34, diffractionLensTooSlow 32 | 0 |
| Hộp 300×200, WD 800, ống thường | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 4 | 0 | 0 | 58 | fovTooSmall 51, mountMismatch 29 | 0 |
| Hộp 300×200, WD 800, ống thường | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 7 | 0 | 0 | 55 | fovTooSmall 43, mountMismatch 29 | 1 |
| Hộp 300×200, WD 800, ống thường | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 4 | 0 | 58 | diffractionLensTooSlow 31, mountMismatch 29 | 1 |
| Đo 2D 30×25, telecentric, WD để trống | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 20 | 14 | 0 | 1019 | fovTooSmall 888, diffractionLensTooSlow 518 | 4 |
| Đo 2D 30×25, telecentric, WD để trống | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 2 | 16 | 0 | 1035 | fovTooSmall 777, diffractionLensTooSlow 686 | 3 |
| Đo 2D 30×25, telecentric, WD để trống | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 0 | 0 | 1053 | diffractionLensTooSlow 935, fovTooSmall 693 | 4 |
| Bo mạch 100×80, WD 300, Δh 10 mm | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 4 | 0 | 0 | 58 | fovTooSmall 51, mountMismatch 29 | 1 |
| Bo mạch 100×80, WD 300, Δh 10 mm | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 6 | 0 | 0 | 56 | fovTooSmall 35, mountMismatch 29 | 1 |
| Bo mạch 100×80, WD 300, Δh 10 mm | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 2 | 0 | 60 | fovTooSmall 34, diffractionLensTooSlow 32 | 1 |
| Đo 2D 30×25, telecentric, WD 228 (WD danh định phổ biến nhất) | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 3 | 0 | 0 | 1050 | wdOutOfRange 1024, fovTooSmall 888 | 4 |
| Đo 2D 30×25, telecentric, WD 228 (WD danh định phổ biến nhất) | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 0 | 5 | 0 | 1048 | wdOutOfRange 1024, fovTooSmall 777 | 4 |
| Đo 2D 30×25, telecentric, WD 228 (WD danh định phổ biến nhất) | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 0 | 0 | 1053 | wdOutOfRange 1024, diffractionLensTooSlow 935 | 4 |
| Đo 2D 30×25, telecentric, WD 231.4 (lệch +1,5 %) | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 0 | 3 | 0 | 1050 | wdOutOfRange 1026, fovTooSmall 888 | 4 |
| Đo 2D 30×25, telecentric, WD 231.4 (lệch +1,5 %) | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 0 | 5 | 0 | 1048 | wdOutOfRange 1026, fovTooSmall 777 | 4 |
| Đo 2D 30×25, telecentric, WD 231.4 (lệch +1,5 %) | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 0 | 0 | 1053 | wdOutOfRange 1026, diffractionLensTooSlow 935 | 4 |
| Đo 2D 30×25, telecentric, WD 239.4 (lệch +5 %) | CAM-IRAYPLE-A3138CU000E (1280×1024, 4 µm, 1/2.7) | 0 | 2 | 0 | 1051 | wdOutOfRange 1021, fovTooSmall 888 | 4 |
| Đo 2D 30×25, telecentric, WD 239.4 (lệch +5 %) | CAM-IRAYPLE-AE5508CG000E (2448×2048, 3.45 µm, 2/3) | 0 | 2 | 0 | 1051 | wdOutOfRange 1021, fovTooSmall 777 | 4 |
| Đo 2D 30×25, telecentric, WD 239.4 (lệch +5 %) | CAM-IRAYPLE-A3B00MU000E (5472×3648, 2.4 µm, 1) | 0 | 0 | 0 | 1053 | wdOutOfRange 1021, diffractionLensTooSlow 935 | 3 |

Thời gian lọc cả kho: trung bình 2 ms, lâu nhất 4 ms (24 lượt, chạy trong Node trên máy này).

## Chi tiết đối chiếu Hik

Nguồn: Hikrobot Lens Selector — https://www.hikrobotics.com/en/machinevision/service/machinevisionTool/?id=3 (API /en/Api/Foreground/Vision/ListLensData, chạy qua trình duyệt bằng scripts/reference/hik-collect.js). File `scripts/reference/hik-lens-selector-2026-10-29.json`: 12 ca, 44 ống, 235 lượt so (không tính lượt neo sF).

- Vùng nhìn ở WD cho trước: 101 lượt, lệch trung bình 0.01 %, lớn nhất 0.52 %.
- WD để vừa vùng nhìn: 134 lượt, lệch trung bình 0.02 %, lớn nhất 0.25 %.
- Lượt có ống nối (hãng thêm vòng nối): 90, lệch lớn nhất 0.52 %.

- **Nếu ống chưa khai sF (engine lấy sF = 0):** vùng nhìn lệch so với Hik trung vị 5.14 %, lớn nhất 464.85 %; 51/101 lượt lệch > 5 %.

Mười lượt lệch nhiều nhất:

| Ca | Ống | Đại lượng | Hãng | Engine | Lệch | Ống nối |
|---|---|---|---:|---:|---:|---:|
| MV-CS004-10GM · 15 × 11.25 mm · WD 100 | MVL-MF2518M-5MPE | vùng nhìn rộng (mm) | 19.2 | 19.1 | -0.52 % | 4 |
| MV-CS050-10GM · 30 × 25.1 mm · WD 150 | MVL-MF3528M-8MP | vùng nhìn rộng (mm) | 29 | 29.1 | +0.34 % | 0 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-KF2540-25MP | vùng nhìn rộng (mm) | 32.5 | 32.4 | -0.31 % | 0 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-KF1224M-25MP | WD (mm) | 55.9 | 56.04 | +0.25 % | 1 |
| MV-CS050-10GM · 100 × 83.66 mm · WD 300 | MVL-MF3528M-8MP | vùng nhìn rộng (mm) | 65.2 | 65.3 | +0.15 % | 0 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-KF1628M-12MPE | WD (mm) | 78.1 | 78.2 | +0.13 % | 1 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-HF1624M-10MP | WD (mm) | 81.1 | 81.03 | -0.08 % | 1 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-MF0828M-8MP | WD (mm) | 32.1 | 32.07 | -0.08 % | 1 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-KF1624M-25MP | WD (mm) | 77.2 | 77.26 | +0.07 % | 1 |
| MV-CS004-10GM · 30 × 22.5 mm · WD 150 | MVL-KF1640-25MP | WD (mm) | 77.5 | 77.45 | -0.07 % | 0 |

sF suy từ số của hãng (mặt trước ống → tiêu điểm trước; "chênh" = khoảng dao động giữa các lần xuất hiện, do hãng làm tròn vùng nhìn 0,1 mm):

| Ống | f | sF (mm) | chênh | số lần |
|---|---:|---:|---:|---:|
| MVL-HF0824M-10MP | 8 | -13.89 | 0.04 | 3 |
| MVL-HF0828M-6MPE | 8 | -14.89 | 0.04 | 3 |
| MVL-KF0814M-12MPE | 8 | -19.69 | 0.06 | 4 |
| MVL-KF0818M-12MP | 8 | -16.69 | 0.08 | 4 |
| MVL-MF0824M-5MPE | 8 | -16.59 | 0.08 | 4 |
| MVL-MF0828M-10MPE | 8 | -17.59 | 0.08 | 4 |
| MVL-MF0828M-8MP | 8 | -16.24 | 0.09 | 8 |
| MVL-HF1224M-10MP | 12 | -19.57 | 0.03 | 4 |
| MVL-HF1228M-6MPE | 12 | -14.25 | 0.01 | 4 |
| MVL-KF1224M-25MP | 12 | -16.43 | 0.14 | 6 |
| MVL-KF1228M-12MPE | 12 | -18.36 | 0.09 | 4 |
| MVL-MF1224M-5MPE | 12 | -10.63 | 0.12 | 4 |
| MVL-MF1228M-10MPE | 12 | -11.35 | 0.09 | 4 |
| MVL-HF1624M-10MP | 16 | -15.58 | 0.16 | 6 |
| MVL-HF1628M-6MPE | 16 | -8.78 | 0.17 | 6 |
| MVL-KF1624M-25MP | 16 | -19.36 | 0.16 | 8 |
| MVL-KF1628M-12MPE | 16 | -18.41 | 0.16 | 8 |
| MVL-KF1640-25MP | 16 | -19.17 | 0.18 | 8 |
| MVL-MF1618M-5MPE | 16 | -11.03 | 0.16 | 8 |
| MVL-MF1628M-10MPE | 16 | -7.05 | 0.24 | 8 |
| MVL-HF2524M-10MP | 25 | -8.76 | 0.27 | 6 |
| MVL-HF2528M-6MPE | 25 | -3.86 | 0.12 | 5 |
| MVL-KF2524M-25MP | 25 | -13.96 | 0.34 | 10 |
| MVL-KF2528M-12MPE | 25 | -13.76 | 0.24 | 10 |
| MVL-KF2540-25MP | 25 | -13.26 | 0.37 | 10 |
| MVL-MF2518M-5MPE | 25 | 3.64 | 0.35 | 10 |
| MVL-MF2528M-10MPE | 25 | 2.04 | 0.18 | 10 |
| MVL-MF2528M-8MP | 25 | 10.44 | 0.23 | 12 |
| MVL-HF3028M-6MPE | 30 | 6.4 | 0.02 | 2 |
| MVL-HF3524M-10MP | 35 | 24.72 | 0.11 | 2 |
| MVL-KF3524M-25MP | 35 | -7.25 | 0.22 | 10 |
| MVL-KF3528M-12MPE | 35 | -2.19 | 0.13 | 10 |
| MVL-MF3518M-5MPE | 35 | 21.08 | 0.09 | 6 |
| MVL-MF3528M-10MPE | 35 | 4.88 | 0.08 | 6 |
| MVL-MF3528M-8MP | 35 | 29.58 | 0.27 | 6 |
| MVL-HF4028M-6MPE | 40 | 14.73 | 0.07 | 2 |
| MVL-HF5024M-10MP | 50 | 46.73 | 0 | 1 |
| MVL-KF5024M-25MP | 50 | 1.17 | 0.39 | 11 |
| MVL-KF5028M-12MPE | 50 | 31.57 | 0.31 | 10 |
| MVL-KF5040-25MP | 50 | 9.07 | 0.3 | 11 |
| MVL-MF5028M-10MPE | 50 | 51.19 | 0.32 | 5 |
| MVL-MF5028M-5MPE | 50 | 20.29 | 0.27 | 5 |
| MVL-MF5028M-8MP | 50 | 36.19 | 0.27 | 5 |
| MVL-KF7528M-12MP | 75 | 82.47 | 0.37 | 6 |

