# NHÁP CHỜ DUYỆT — Bảng đèn (F3, F4) và số liệu giao tiếp / frame rate (Q4)

Soạn 2026-10-17 theo chốt Q3, Q4 ("tôi soạn nháp có nguồn để anh duyệt"). **Chưa có dòng nào vào code.**
Anh đánh dấu từng dòng: **Đ** = đồng ý · **S** = sửa (ghi số/chữ mới) · **B** = bỏ. Dòng nào được
duyệt mới thành luật có mã, sửa được qua admin như Bảng chiếu sáng hiện có.

---

## A. Kiểu đèn theo loại lỗi (F3) — bảng đang chạy + đề xuất sửa

| Dòng | Đang chạy | Đề xuất | Lý do | Duyệt |
|---|---|---|---|---|
| Vết xước | darkfield | giữ | Xước tán xạ ánh sáng góc thấp → sáng trên nền tối | |
| Bề mặt bóng cong | dome | giữ | Ánh sáng đều mọi hướng, triệt loá | |
| **In / màu sắc** | **coaxial** (thay: bar) | **bar / ring khuếch tán** (thay: coaxial **chỉ khi** bề mặt phẳng phản xạ — khắc laser trên kim loại, mặt chip) | Coaxial chiếu thẳng theo trục camera; trên mực in bề mặt mờ nó không tạo thêm tương phản mà dễ loá điểm. Bề mặt phẳng gương thì coaxial mới là lựa chọn đúng | |
| Biên dạng / lỗ / bavia | backlight | giữ | Đo bóng (silhouette) cho biên sắc nhất | |
| Lõm lồi nông | photometric stereo | giữ | | |
| Vật trong suốt | backlight | giữ | | |
| Bề mặt trong suốt (lấn át) | backlight | giữ | | |
| Bề mặt phản xạ (lấn át) | dome (thay: backlight ở góc gương) | giữ | GT-002 thật | |

## B. Màu đèn / bước sóng (F4) — luật mới

Áp sau khi đã có kiểu đèn. Đầu vào mới cần thêm vào bảng Yêu cầu: **màu vật / màu nền** (tuỳ chọn) và
**mục đích** (làm nổi / làm chìm / xuyên lớp in).

| Mã đề xuất | Điều kiện | Gợi ý | Lý do / nguồn | Duyệt |
|---|---|---|---|---|
| LGT-COL-001 | Camera **màu** | Đèn **trắng** | Camera màu cần đủ phổ, đèn đơn sắc làm mất kênh màu | |
| LGT-COL-002 | Camera đơn sắc, muốn **vật sáng lên** | Đèn **cùng màu** với vật (vd vật đỏ → đèn đỏ) | Vật phản xạ mạnh bước sóng cùng màu → hiện trắng [1][2] | |
| LGT-COL-003 | Camera đơn sắc, muốn **vật tối đi** | Đèn **màu bù** (đỏ ↔ xanh lam/lục, vàng ↔ xanh lam) | Vật hấp thụ màu bù → hiện đen [2] | |
| LGT-COL-004 | Cần nhìn **xuyên** mực in, nhựa màu, nhãn | **IR 850 nm** (camera phải không có lọc IR-cut) | Mực/thuốc nhuộm phần lớn trong suốt với IR [3] | |
| LGT-COL-005 | Chi tiết rất nhỏ / xước mảnh, bài **đo** | Ưu tiên **xanh lam 450–470 nm** | Bước sóng ngắn → đĩa Airy nhỏ hơn 15–20% so với 550 nm. Engine đang tính Airy theo 550 nm: nếu duyệt dòng này, OPT-004 phải lấy λ theo màu đèn | |
| LGT-COL-006 | Vật **huỳnh quang** (keo, dầu, sơn phủ có chất chỉ thị) | **UV 365–395 nm** + lọc chặn UV trước ống | Kích thích huỳnh quang, chỉ phần phát sáng lọt qua lọc | |
| LGT-COL-007 | Môi trường có **ánh sáng ngoài** thay đổi | Đèn đơn sắc + **lọc băng hẹp** cùng bước sóng trước ống | Chặn ánh sáng môi trường, giữ ánh sáng đèn | |
| LGT-COL-008 | Camera đơn sắc dùng IR | Kiểm **QE của cảm biến ở 850 nm** (thường 20–40% so với đỉnh) | Thiếu sáng → phơi lâu → nhoè chuyển động [4] | |

**Câu cần anh trả lời thêm:** LGT-COL-005 có đổi λ của OPT-004 theo màu đèn không? (Nếu có: ống kính đang bị
loại vì nhiễu xạ có thể đạt lại khi dùng đèn xanh lam.)

## C. Giới hạn chiều dài cáp (Interface Advisor)

Đề xuất lấy mức **thận trọng** để chọn, ghi mức "cáp tốt / có kiểm chứng" làm ghi chú. Vượt mức thận trọng → CẢNH BÁO
(không loại), vượt mức cáp tốt → LOẠI và gợi ý cáp quang / bộ lặp.

| Chuẩn | Thận trọng (dùng để chọn) | Cáp tốt / có kiểm chứng | Nguồn | Duyệt |
|---|---|---|---|---|
| GigE / 5GigE / 10GigE | 100 m (Cat5e / Cat6 / Cat6a) | 100 m; xa hơn → cáp quang | IEEE 802.3 (đoạn đồng 100 m) | |
| USB3 | **3 m** | 5–8 m cáp thụ động chất lượng cao; xa hơn → cáp chủ động / quang | USB-IF khuyến nghị 3 m; Basler ghi tới ~8 m; XIMEA cảnh báo > 5 m kém ổn định [5][6] | |
| CoaXPress CXP-6 | **25 m** | 40 m (RG-6 Belden 1694A), tới 60 m cáp đặc biệt | Chuẩn chỉ quy định suy hao, không ghi độ dài; số theo bảng Wikipedia/Euresys; cáp mini (WAKA) chỉ 25 m [7][8] | |
| CoaXPress CXP-12 | **20 m** | 30 m (RG-6); cáp micro-BNC mảnh 10–20 m | như trên; 3M 1CX ghi 10 m ở CXP-12 [7][8] | |
| Camera Link Base | **10 m** | 10 m | Chuẩn Camera Link giới hạn 10 m [9] | |
| Camera Link Medium / Full / Deca | **7 m** | 7 m; xa hơn → bộ lặp | Clock cao, ít hãng cáp đạt quá 7 m [9] | |

## D. Cách tính frame rate (Frame Rate Calculator)

```
fps_max = min( fps_cảm_biến(ROI) , fps_băng_thông , fps_phơi_sáng )

fps_cảm_biến(ROI) ≈ fps_full × H_full ÷ H_roi       (ƯỚC TÍNH — cảm biến đọc theo hàng; cắt ROI ngang không tăng fps)
                    không vượt mức trần hãng ghi cho ROI nhỏ nhất (nếu có)
fps_băng_thông   = băng_thông_thực_dùng ÷ (W_roi × H_roi × byte/px)     (bảng INTERFACE_BANDWIDTH hiện có)
fps_phơi_sáng    = 1 ÷ t_exp                           khi camera phơi chồng thời gian đọc (overlap)
                 = 1 ÷ (t_exp + t_đọc)                  khi không chồng; t_đọc ≈ 1 ÷ fps_cảm_biến(ROI)
Binning 2×2      : băng thông ÷ 4; fps_cảm_biến chỉ tăng nếu binning trong cảm biến (hãng ghi rõ) — mặc định KHÔNG tăng
```

Trang sẽ ghi rõ "ước tính — timing thật theo từng model, kiểm datasheet". Kiểm chứng: so 3–5 camera trong kho iRayple
có bảng fps theo ROI trong datasheet; lệch > 15% thì báo anh trước khi mở trang.

| Câu chốt | Đề xuất | Duyệt |
|---|---|---|
| Mặc định chồng phơi sáng (overlap)? | Có — hầu hết camera GigE/USB3 công nghiệp hiện nay hỗ trợ; ô chọn để tắt | |
| Binning tăng fps? | Mặc định không, trừ khi khai `sensor_binning = yes` | |

---

### Nguồn
1. Advanced Illumination, *A Practical Guide to Machine Vision Lighting* — https://cdn.graftek.com/system/files/9967/original/Advanced_Illumination_Practical_Guide_to_Machine_Vision_Lighting.pdf
2. wenglor, *Technology and principle of operation of illumination technology* — https://wenglor.com/en/Technology-and-Principle-of-Operation-of-Illumination-Technology/s/Technologie-Beleuchtungstechnik
3. Quality Magazine, *The critical role of wavelength and filters in machine vision illumination* — https://www.qualitymag.com/articles/98658-the-critical-role-of-wavelength-and-filters-in-machine-vision-illumination
4. Advanced Illumination (như [1]), mục ghép bước sóng đèn với độ nhạy cảm biến
5. Basler, *Data transmission USB 3.0* — https://www.baslerweb.com/en/learning/data-transmission-usb-3-0/
6. XIMEA, *Cable lengths and distance options* — https://ximea.com/support/wiki/usb3/Cable_lenghts_and_distance_options
7. Euresys, *Cable Length in the CoaXPress Standard* — https://documentation.euresys.com/Products/eGrabber/eGrabber/en-us/Content/40_App_Notes/CXP_Cable_Length/Cable_Length_in_the_CoaXPress.htm
8. Wikipedia, *CoaXPress* (bảng độ dài điển hình) — https://en.wikipedia.org/wiki/CoaXPress
9. Vision Systems Design, *Accessories complement Camera Link capabilities* — https://www.vision-systems.com/factory/manufacturing/article/16736663/accessories-complement-camera-link-capabilities
