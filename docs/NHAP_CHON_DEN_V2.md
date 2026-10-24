# NHÁP CHỜ DUYỆT — Chọn đèn bản 2: bài toán, đặc điểm, vật liệu, bề mặt, màu

Soạn 2026-10-22 theo yêu cầu của anh Hùng: "loại lỗi sai và thiếu; kiểm có/không, align thì sao; bề mặt thiếu
(cao su, nhựa, bản mạch…), chưa liên kết, chưa chặt chẽ; màu thiếu". **Chưa có dòng nào vào code.**
Anh đánh dấu từng dòng: **Đ** = đồng ý · **S** = sửa (ghi chữ mới) · **B** = bỏ.

---

## 0. Bản hiện tại sai ở đâu

| # | Chỗ sai | Vì sao |
|---|---|---|
| 0.1 | "Loại lỗi" có **"Bề mặt bóng hoặc cong"** và **"Vật trong suốt"** | Đây là tính chất vật liệu / bề mặt, không phải lỗi. Người dùng phải chọn sai chỗ mới ra đèn đúng |
| 0.2 | "Bề mặt" trộn **độ bóng** (mờ, bóng, phẳng như gương), **vật liệu** (kim loại, trong suốt) và **màu** (đen) | Một vật vừa là kim loại vừa bóng vừa đen — chỉ chọn được một |
| 0.3 | Chỉ có bài **kiểm lỗi** | Có/không, căn chỉnh (align), đo, đọc mã cần đèn khác hẳn — vd. đo thì đèn nền gần như luôn đúng |
| 0.4 | Màu chỉ xét **màu vật**, 6 màu | Tương phản đến từ **chênh lệch giữa màu chi tiết và màu nền** (vd. chữ đỏ trên nền xanh lá). Thiếu trắng, đen, xám/bạc, nâu, hồng, xanh lơ, vàng kim/đồng |

## 1. Cấu trúc nhập mới — 5 bước, mỗi bước một ý

```
1. Bài toán          → kiểm lỗi / có-không / căn chỉnh / đo / đọc mã-ký tự / kiểm màu
2. Cần thấy cái gì   → danh sách ĐỔI THEO bài toán (mục 2)
3. Vật liệu          → tự điền gợi ý cho bước 4 + 5 (mục 3), sửa lại được
4. Bề mặt & hình dạng → độ bóng (mục 4.1) + hình dạng (mục 4.2)
5. Màu               → màu chi tiết cần thấy + màu nền xung quanh (mục 5)
```

Kết quả vẫn như cũ (kiểu đèn, màu đèn, cỡ, lọc kho, hình minh hoạ) nhưng đi theo thứ tự xét ở mục 6.

## 2. Bài toán và "cần thấy cái gì"

### 2.1 Kiểm lỗi ngoại quan (thay 6 loại lỗi cũ)

| Mã | Lỗi | Gộp / thay mục cũ | Duyệt |
|---|---|---|---|
| scratch | Xước, vết cắt nông | giữ | |
| crack_chip | Nứt, mẻ cạnh, sứt | **mới** | |
| dent_bump | Móp, lõm, lồi | thay "Lõm lồi rất nông" (thêm độ sâu ở mục 2.1b) | |
| burr | Ba via, cạnh sắc | tách từ "Biên dạng, lỗ, ba via" | |
| stain | Vết bẩn, dầu, ố, vân tay | **mới** | |
| particle | Dị vật, bụi, sợi, tóc | **mới** | |
| void | Bọt khí, rỗ, lỗ kim | **mới** | |
| coating | Bong tróc sơn / lớp phủ, thiếu sơn, chảy sơn | **mới** | |
| print | Lỗi in: mờ, nhoè, thiếu nét, lệch | thay "Lỗi in / sai màu" (sai màu chuyển sang bài toán Kiểm màu) | |
| wrinkle | Nhăn, gấp, biến dạng, cong vênh | **mới** | |
| solder | Lỗi mối hàn (thiếu / thừa thiếc, cầu thiếc) — bản mạch | **mới** | |
| ~~glossy_curved~~ | ~~Bề mặt bóng hoặc cong~~ | **bỏ** — chuyển sang Bề mặt (mục 4) | |
| ~~transparent~~ | ~~Vật trong suốt~~ | **bỏ** — chuyển sang Vật liệu (mục 3) | |

2.1b — Móp / lõm: thêm lựa chọn **độ sâu**: rõ (nhìn thấy bằng mắt) / rất nông (phải nghiêng mới thấy). Rất nông → đèn nhiều hướng.

### 2.2 Có / không (lắp ráp — đủ linh kiện, đúng vị trí)

| Cần thấy | Ví dụ | Duyệt |
|---|---|---|
| Chi tiết nhô cao khỏi nền | ốc, chân cắm, nút, nắp | |
| Chi tiết phẳng khác màu nền | nhãn, miếng đệm màu | |
| Lỗ / khe xuyên qua | lỗ bắt vít, khe | |
| Chi tiết trong suốt | keo, màng bảo vệ, ống | |
| Chi tiết kim loại bóng | lò xo, ốc mạ, tiếp điểm | |
| Dây, sợi | dây điện, sợi, gioăng | |

### 2.3 Căn chỉnh / định vị (align)

| Cần thấy | Ví dụ | Duyệt |
|---|---|---|
| Đường bao ngoài của vật | phôi trên băng tải, tấm kính | |
| Dấu định vị (fiducial / mark in) | mark trên bản mạch, kính, wafer | |
| Lỗ định vị | lỗ chuẩn trên tấm | |
| Góc / cạnh vát | góc tấm, cạnh vát | |

### 2.4 Đo kích thước 2D

| Cần thấy | Ví dụ | Duyệt |
|---|---|---|
| Biên dạng ngoài (cho ánh sáng soi xuyên được) | chiều dài, đường kính ngoài | |
| Lỗ / khe xuyên | đường kính lỗ, bước lỗ | |
| Cạnh trên mặt vật (không soi xuyên được) | khoảng cách gờ, bậc | |

### 2.5 Đọc mã / ký tự (OCR, OCV, mã vạch, mã 2D)

> Lưu ý: CLAUDE.md §10 để OCR / mã vạch ở phase 2 cho **bộ chọn thiết bị**. Ở trang Chọn đèn chỉ gợi ý đèn — anh quyết (Q2).

| Cần thấy | Ví dụ | Duyệt |
|---|---|---|
| In mực trên nhãn / giấy | tem, nhãn | |
| Khắc laser / dập trên kim loại (DPM) | mã 2D trên chi tiết máy | |
| In phun trên bề mặt cong | chai, lon | |

### 2.6 Kiểm màu

| Cần thấy | Ví dụ | Duyệt |
|---|---|---|
| Đúng màu / phân loại màu | dây màu, nắp màu | |
| Loang màu, sai sắc | lớp sơn | |

## 3. Vật liệu — tự điền bề mặt và màu gợi ý (sửa lại được)

| Vật liệu | Bề mặt gợi ý | Màu / lưu ý gợi ý | Duyệt |
|---|---|---|---|
| Kim loại gia công (phay, tiện, mài) | có vân gia công | xám / bạc | |
| Kim loại đúc | mờ, sần | xám | |
| Kim loại tấm / dập | bán bóng | xám / bạc | |
| Kim loại đánh bóng / mạ (crom, niken) | bóng — phẳng hoặc cong | bạc | |
| Nhôm anod | mờ | theo màu anod (đen, bạc, màu) | |
| Đồng / vàng (tiếp điểm, mạ vàng) | bóng | vàng kim / đồng | |
| Nhựa đúc mờ | mờ | theo màu nhựa | |
| Nhựa bóng | bóng | theo màu nhựa | |
| Nhựa trong suốt | trong suốt | không màu | |
| Nhựa mờ đục (PP, PE trắng đục) | mờ đục (cho sáng xuyên một phần) | trắng đục | |
| Cao su | mờ | thường đen — hấp thụ gần hết ánh sáng | |
| Bản mạch PCB / PCBA | bán bóng + nhiều bậc cao thấp | nền xanh lá; thiếc bạc bóng; linh kiện nhiều màu | |
| Kính / thuỷ tinh | trong suốt, phẳng | không màu | |
| Gốm / sứ | bán bóng | trắng | |
| Màng / film / foil | bóng, dễ nhăn | trong suốt hoặc bạc | |
| Giấy / carton / nhãn | mờ | trắng / nâu | |
| Vải / sợi | mờ, có vân | theo màu | |
| Gỗ | mờ, có vân | nâu | |
| Bề mặt sơn | bán bóng | theo màu sơn | |
| Wafer / chip silicon | bóng phẳng như gương | xám tối | |

## 4. Bề mặt và hình dạng

### 4.1 Độ bóng (chọn 1)

| Mã | Bề mặt | Tính chất quang học | Duyệt |
|---|---|---|---|
| matte | Mờ (khuếch tán) | tán xạ đều mọi hướng | |
| semi_gloss | Bán bóng | có điểm loá nhẹ | |
| mirror_flat | Bóng phẳng như gương | phản xạ gương — chỉ thấy đèn khi đèn nằm đúng góc phản xạ | |
| mirror_curved | Bóng cong | phản xạ gương trên mặt cong → nhiều điểm loá | |
| textured | Có vân gia công / sần | vân có hướng làm loá theo hướng chiếu | |
| transparent | Trong suốt | ánh sáng đi xuyên | |
| translucent | Mờ đục | ánh sáng xuyên một phần, tán xạ bên trong | |

### 4.2 Hình dạng (chọn 1)

| Mã | Hình dạng | Duyệt |
|---|---|---|
| flat | Phẳng | |
| curved | Cong (trụ, cầu) | |
| stepped | Nhiều bậc cao thấp (bản mạch, cụm lắp ráp) | |

## 5. Màu — màu chi tiết và màu nền, 13 màu

Camera đơn sắc: chọn màu đèn làm **chênh lệch độ sáng giữa chi tiết và nền lớn nhất**. Mỗi màu có hệ số phản xạ
3 mức (0 tối · 1 vừa · 2 sáng) dưới đèn đỏ / xanh lục / xanh lam; đèn trắng = trung bình. Bảng sửa được qua admin.
Nguồn nguyên lý: wenglor, Advanced Illumination (màu cùng → sáng, màu bù → tối).

| Màu | Đỏ | Lục | Lam | Duyệt |
|---|---|---|---|---|
| Trắng | 2 | 2 | 2 | |
| Xám / bạc | 1 | 1 | 1 | |
| Đen | 0 | 0 | 0 | |
| Đỏ | 2 | 0 | 0 | |
| Cam | 2 | 1 | 0 | |
| Vàng | 2 | 2 | 0 | |
| Xanh lục | 0 | 2 | 0 | |
| Xanh lơ (cyan) | 0 | 2 | 2 | |
| Xanh lam | 0 | 0 | 2 | |
| Tím | 1 | 0 | 2 | |
| Hồng / đỏ tươi (magenta) | 2 | 0 | 2 | |
| Nâu | 1 | 0 | 0 | |
| Vàng kim / đồng (kim loại) | 2 | 1 | 0 | |

Ví dụ: chữ đỏ trên nền xanh lục → đèn đỏ: chữ 2, nền 0 → chênh 2 (tốt nhất). Đèn trắng: chữ ≈ 0,7, nền ≈ 0,7 →
gần như **không thấy chữ** trên camera đơn sắc. Chi tiết và nền cùng nhóm trung tính (trắng / xám / đen) → màu đèn
không giúp, giữ đèn trắng hoặc đỏ (đỏ: LED hiệu suất cao, ít tán xạ hơn lam).
Camera màu → đèn trắng (giữ LGT-009). IR / UV giữ như cũ (nhìn xuyên lớp in, huỳnh quang).

## 6. Thứ tự xét chọn kiểu đèn (đề xuất)

| Bước | Điều kiện | Đèn | Lý do / nguồn | Duyệt |
|---|---|---|---|---|
| 6.1 | Đo / căn chỉnh / có-không theo **đường bao** hoặc **lỗ xuyên**, soi xuyên được | **Đèn nền** (đo chính xác: đèn nền song song + ống telecentric) | Biên sắc nhất, không phụ thuộc bề mặt (Edmund — silhouetting) | |
| 6.2 | Bề mặt **trong suốt** | lỗi bên trong / bọt khí → đèn nền khuếch tán; xước bề mặt → góc thấp chiếu từ cạnh | Opto Engineering; Advanced Illumination | |
| 6.3 | **Bóng phẳng như gương** | đồng trục; dị vật / xước sáng → góc thấp | Keyence; Opto Engineering | |
| 6.4 | **Bóng cong** | vòm (dome); móp → nhiều hướng | Keyence; Opto Engineering | |
| 6.5 | **Nhiều bậc** (bản mạch) | vòm hoặc đèn vòng nhiều tầng góc; fiducial → đồng trục | CCS / Keyence (kiểm PCBA) | |
| 6.6 | Còn lại: tra **ma trận đặc điểm × bề mặt** (mục 7) | | | |
| 6.7 | Màu: mục 5; vật liệu đen / cao su → nhắc đèn mạnh, phơi lâu (LGT-005) | | | |

## 7. Ma trận đặc điểm × bề mặt (kiểm lỗi) — đèn chính / thay thế

| Lỗi \ bề mặt | Mờ | Bán bóng | Có vân | Ghi chú | Duyệt |
|---|---|---|---|---|---|
| Xước | góc thấp / thanh nghiêng | góc thấp / vòm | thanh góc thấp **vuông góc hướng vân** / vòm | vân gia công sáng lên dưới góc thấp nếu chiếu dọc vân | |
| Nứt, mẻ cạnh | góc thấp / vòng | góc thấp / đồng trục | góc thấp / vòm | mẻ cạnh trên kính → đèn nền | |
| Móp rõ | thanh nghiêng / nhiều hướng | vòm / nhiều hướng | thanh nghiêng / nhiều hướng | | |
| Móp rất nông | nhiều hướng | nhiều hướng | nhiều hướng | trên bóng: đèn sọc (deflectometry) — chưa có trong 7 kiểu (Q4) | |
| Ba via | đèn nền (nếu ở đường bao) / góc thấp | đèn nền / góc thấp | đèn nền / góc thấp | | |
| Vết bẩn, dầu | vòm / vòng khuếch tán | vòm / đồng trục | vòm / vòng | dầu có chất huỳnh quang → UV | |
| Dị vật, bụi | góc thấp / vòng | góc thấp / đồng trục | vòm / góc thấp | | |
| Bọt khí, rỗ | góc thấp / vòng | góc thấp / vòm | góc thấp / vòm | | |
| Bong sơn | vòng / vòm | vòm / vòng | vòm / vòng | kèm màu đèn theo mục 5 | |
| Lỗi in | vòng / thanh | vòm / đồng trục | vòm / vòng | | |
| Nhăn, biến dạng | thanh góc thấp / nhiều hướng | thanh góc thấp / vòm | thanh góc thấp / nhiều hướng | | |
| Mối hàn | vòm / vòng nhiều tầng | vòm / vòng nhiều tầng | — | | |

(Bóng phẳng, bóng cong, trong suốt đã xét trước ở 6.2–6.4.)

## 8. Kiểu đèn — có thêm không? (Q4)

| Kiểu | Hiện có | Dùng cho | Kho | Duyệt |
|---|---|---|---|---|
| Vòng, vòm, nền, thanh, đồng trục, góc thấp, nhiều hướng | có | | thanh, vòng, đồng trục | |
| **Vòng nhiều tầng góc** (multi-angle) | **mới** | mối hàn, bản mạch nhiều bậc | chưa có | |
| **Đèn sọc / chiếu vân** (deflectometry) | **mới** | móp rất nông trên bề mặt bóng | chưa có | |
| **Đèn line** (cho camera line scan) | **mới** | băng chuyền liên tục, vật dài | seed có 1 đèn line đang khai là "thanh" | |

## 9. Phạm vi

- Chỉ trang Chọn đèn đổi trước. Bảng Yêu cầu của Thiết kế hệ thống và bộ chọn cũ đang lưu `defectType` / `surface`
  theo danh sách cũ trong dự án đã lưu — đổi ở đó cần chuyển dữ liệu cũ, làm bước sau (Q6).

### Nguồn
- Opto Engineering — Illumination geometries and techniques: https://www.opto-e.com/en/basics/illumination-geometries-and-techniques
- KEYENCE — Basics of lighting selection: https://www.keyence.com/products/vision/resources/vision-resources/basics-of-lighting-selection.jsp
- Advanced Illumination — A Practical Guide to Machine Vision Lighting: https://cdn.graftek.com/system/files/9967/original/Advanced_Illumination_Practical_Guide_to_Machine_Vision_Lighting.pdf
- wenglor — Illumination technology: https://wenglor.com/en/Technology-and-Principle-of-Operation-of-Illumination-Technology/s/Technologie-Beleuchtungstechnik
- Edmund Optics — Silhouetting illumination: https://www.edmundoptics.co.uk/ViewDocument/silhouetting-Illumination-18.pdf
- KEYENCE — LumiTrax (nhiều hướng chiếu): https://www.keyence.com/landing/vision/lumitrax-lighting.jsp
