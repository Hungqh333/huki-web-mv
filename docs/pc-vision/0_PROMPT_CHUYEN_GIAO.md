# Chuyển giao: chuẩn hoá PC công nghiệp + trang "PC Vision"

> Dán toàn bộ file này vào phiên Claude Code của phần mềm đích, kèm thư mục gói này.
> Chủ sở hữu: Nguyễn Văn Hùng, trưởng phòng Vision. Ngày chốt: 03/11/2026.
> Gói được làm nhầm trong dự án "phần mềm quản lý công việc phòng Vision". Chưa có dòng mã nào ở phần mềm thật, chỉ có mẫu giao diện và tài liệu.

---

## PROMPT

Bạn nhận chuyển giao tính năng **"PC Vision"**: danh mục cấu hình PC công nghiệp cho dự án machine vision, kèm phần gợi ý cấu hình theo camera. Toàn bộ quy tắc và quyết định dưới đây **đã được chủ sở hữu chốt**. Không bàn lại, trừ khi phát hiện mâu thuẫn với phần mềm đích; khi đó dừng lại và hỏi.

Cách làm bắt buộc:
1. **Đọc trước khi làm:**
   - File này.
   - `1_mau_trang_pc_vision.html`: mẫu giao diện đã duyệt. Mở bằng trình duyệt; phần `<script>` chứa đủ dữ liệu và logic tính.
   - Cấu trúc phần mềm đích: ngôn ngữ, CSDL, phân quyền, cách ghi lịch sử, cách thêm trang / menu.
2. **Đánh giá khả thi** và đề xuất cách đưa vào phần mềm đích: mô hình dữ liệu, quyền, API, giao diện. Nêu rõ đánh đổi. **Dừng lại chờ duyệt** trước khi viết mã.
3. Mẫu HTML là **bản kiểm chứng giao diện, không phải kiến trúc**. Theo quy ước của phần mềm đích, không chép nguyên JS sang.
4. Trả lời bằng tiếng Việt, có cấu trúc. Khi hỏi chủ sở hữu, dùng **danh sách đánh số** để họ trả lời theo số. Làm xong mỗi bước lớn thì dừng lại báo cáo.
5. Thay đổi giao diện: làm mẫu HTML để chủ sở hữu duyệt trước rồi mới sửa mã.

---

## 1. Mục tiêu

- Chuẩn hoá **mã vật tư PC** (trước đây không theo quy tắc nào) để báo giá, đơn hàng, hoá đơn và máy giao luôn khớp nhau.
- Xác định mỗi cấu hình PC dùng được cho mấy camera, loại camera nào, tốc độ bao nhiêu.
- RAM và ổ cứng thay theo dự án để **tối ưu chi phí**, nhưng vẫn phải **ổn định** khi máy chạy 24/7.

## 2. Quy tắc mã cấu hình PC (đã chốt, đã gửi hãng AAEON)

```
<PN chassis>-<CPU>-G<GPU>-P<W>-R<GB><I|C>-S<dung lượng><I|C>-<ổ dữ liệu>-<HĐH>
RT-661R-Q670-A10-0001-I9-14900-G5070V12-P1000-R64I-S2TI-D0-W11P
```

| # | Trường | Cách ghi | Ví dụ |
|---|---|---|---|
| 1 | PN chassis | Đúng Part Number của hãng, giữ nguyên. Máy tự lắp ráp: `LR-<main>-<vỏ>` | `RT-661R-Q670-A10-0001`, `EBS-I10`, `LR-H610M-XA22` |
| 2 | CPU | Dòng + cấp, gạch nối, số model, giữ hậu tố K/F/T. I = Core i, U = Core Ultra, RZ = Ryzen | `I9-14900`, `I7-14700`, `U7-265` |
| 3 | G (GPU) | Số chip + hậu tố dòng (**TI** = Ti, **S** = Super; bản thường không ghi) + V + VRAM GB. Không có GPU: `G0` | `G5070V12`, `G5060TIV16`, `G4070SV12`, `G0` |
| 4 | P (nguồn) | Công suất W | `P650`, `P1000`, `P1300` |
| 5 | R (RAM) | GB + dòng: **I** công nghiệp / **C** thường; `?` = chưa rõ, chưa được đặt hàng | `R32I`, `R64I`, `R16?` |
| 6 | S (SSD hệ thống) | Số trơn = GB, có T = TB, + I/C | `S512I`, `S1TI` |
| 7 | Ổ dữ liệu | D = SSD, H = HDD, + dung lượng + I/C. Không có: `D0` | `D0`, `D1TC`, `D2TC` |
| 8 | Hệ điều hành | W11P = Win 11 Pro, W11L = Win 11 IoT LTSC, LNX = Linux, NOS = không cài | `W11P` |

Regex kiểm tra (máy chủ phải kiểm lại, không tin giao diện):
```
^[A-Z0-9][A-Z0-9-]*-(I[3579]|U[579]|RZ[3579])-\d{3,5}[A-Z]{0,2}-G(0|\d{4}(TI|S)?V\d{1,2})-P\d{3,4}-R\d{1,3}[IC]-S(\d{3}|\d{1,2}T)[IC]-(D0|[DH](\d{3}|\d{1,2}T)[IC])-(W11[PL]|LNX|NOS)$
```
- Mã do hệ thống **tự ghép từ các trường**, không gõ tay. Mã là duy nhất. Cấu hình không dùng nữa chuyển sang "Ngừng dùng"; **mã không bao giờ cấp lại** cho cấu hình khác.
- Mã có dấu `?` (khung A) cố ý không qua regex: chờ kiểm tra dòng RAM/SSD rồi mới được đặt hàng.

**Dòng I (công nghiệp):** Kingston Industrial, Innodisk, ATP, Transcend Industrial, Apacer Industrial, WD Industrial. HDD: WD Gold, Seagate Exos. Không có trong danh sách thì là C (ví dụ: Kingston Fury/NV3, Samsung 980/990, Merlin, WD Purple/Blue).

**Luật dòng hàng:**
- Dây chuyền 24/7: RAM và SSD hệ thống **bắt buộc I**.
- Dòng C chỉ dùng cho demo, phòng thí nghiệm, hoặc dự án khách chấp nhận bằng văn bản.
- **Ổ dữ liệu được phép C kể cả 24/7**, với điều kiện: phần mềm vision không treo khi ổ lỗi/đầy, có theo dõi SMART, ổ có độ bền ghi (TBW) cao và không dùng loại QLC.

## 3. Danh mục: 6 khung, 13 cấu hình

**Khung** là phần cố định: chassis, CPU, GPU, nguồn, hệ điều hành, dòng RAM/SSD, năng lực. **Cấu hình** là khung + RAM + SSD + ổ dữ liệu cụ thể. Trong mỗi khung, cấu hình xếp từ nhỏ đến lớn.

| Khung | Phần cố định | Khe card cam / LAN | Tải đỉnh* | Cấu hình (RAM-SSD-ổ dữ liệu) |
|---|---|---|---|---|
| **A** Cơ bản | `EBS-I10-I5-12400-G0-P250` · W11P · RAM/SSD `?` | 0 / 1 | 120W | A1 `R16?-S256?-D0` |
| **B** Tiêu chuẩn | `RT-661R-Q670-A10-0001-I7-14700-G0-P650` · I/I | 3 / 1 | 330W | B1 `R16I-S512I-D0` · B2 `R32I-S512I-D1TC` · B3 `R64I-S512I-D2TC` |
| **C** AI tiết kiệm | `…-I7-14700-G5070V12-P1000` · I/I | 2 / 1 | 570W | Ct1 `R32I-S1TI-D0` · Ct2 `R32I-S512I-D2TC` |
| **C** AI | `…-I9-14900-G5070V12-P1000` · I/I | 2 / 1 | 570W | C1 `R32I-S1TI-D0` · C2 `R64I-S1TI-D0` · C3 `R64I-S512I-D2TC` |
| **D** AI cao | `…-I9-14900-G5080V16-P1300` · I/I | 2 / 1 | 680W | D1 `R64I-S1TI-D0` · D2 `R64I-S512I-D4TC` · D3 `R128I-S1TI-D2TC` |
| **P** Phụ trợ | `LR-H610M-XA22-I5-12400-G0-P450` · C/C | 0 / 0 | 180W | P1 `R16C-S256C-D0` |

\* Tải đỉnh ước tính, chưa tính PoE. Mỗi camera GigE cấp PoE từ card trong máy cộng thêm 13W.

Dùng cho / không dùng cho (ghi theo khung):
- **A:** thuật toán cổ điển (đo, đếm, có/không, đọc code). Không dùng cho AI, không lắp thêm card. Chưa biết dòng RAM/SSD.
- **B:** cổ điển nhiều camera, ảnh lớn. Không dùng cho AI tốc độ cao.
- **C tiết kiệm:** AI suy luận. Không dùng cho nhiều camera cổ điển chạy song song.
- **C AI:** AI suy luận + cổ điển nhiều camera. Không dùng cho huấn luyện model lớn tại máy.
- **D:** AI nặng, ảnh 20MP+, line scan, huấn luyện tại máy. Card GPU dày khoảng 2,5 khe, phải đo thực tế.
- **P:** màn hình HMI cho smart camera. Không thu ảnh, không dùng cho dây chuyền 24/7.

Danh sách 13 cấu hình là đề xuất ban đầu; chủ sở hữu thêm/sửa trong phần mềm.

## 4. Quyền

- **Chỉ chủ sở hữu** được thêm/sửa khung và cấu hình. Kiểm quyền ở **API và CSDL**; ẩn nút trên giao diện không phải là bảo mật.
- Mọi người đăng nhập đều xem được.
- Mọi thay đổi ghi lịch sử: ai sửa, lúc nào, giá trị trước/sau.
- Không xoá cứng; dùng trạng thái "Đang dùng / Ngừng dùng".
- **Chưa đưa giá vào** (quyết định 5).

## 5. Trang "PC Vision": mục riêng trên menu, 4 tab

### Tab 1. Danh mục cấu hình
- Nhóm theo khung. **Tiêu đề nhóm:** ô vuông nhỏ màu chứa chữ cấp + tên khung (không dùng dấu "—", chủ sở hữu không thích), chip CPU / GPU / nguồn / khe / dòng hàng, dòng "Dùng cho · Không dùng cho".
- **Dòng cấu hình:** tên ngắn, mã (phần khung in mờ, phần `R…-S…-D…` in đậm), RAM, SSD, ổ dữ liệu, nút Sửa (chỉ chủ sở hữu thấy).
- **Form thêm/sửa:** chọn từng trường bằng ô chọn, mã ghép trực tiếp. Hiện ngay khi: mã sai regex, có GPU mà VRAM = 0 (hoặc ngược lại), trùng mã (khi sửa thì bỏ qua chính dòng đang sửa), tải đỉnh vượt 70% nguồn. Tự nhận thuộc khung nào (khoá: pn, cpu, gpu, vram, p, os, dòng RAM, dòng SSD); khung mới thì hiện thêm ô cấp, tên, số khe, số LAN, tải đỉnh, dùng cho / không dùng cho.

### Tab 2. Gợi ý cấu hình (chỉ tính để xem, không lưu)
**Đầu vào:**
- Bảng camera: tên, độ phân giải, bit, fps, giao tiếp.
- Chạy AI: không / suy luận / huấn luyện tại máy.
- Dây chuyền 24/7: có / không.
- **"Tính dung lượng lưu ảnh?"**: tuỳ chọn, mặc định **Không**. Khi bật mới hiện cột "Ảnh kiểm/giây" cho từng camera và các ô: giờ chạy/ngày, tỉ lệ NG %, số ngày giữ ảnh NG, dạng lưu ảnh NG, số ngày giữ ảnh OK (0 = bỏ), lưu 1 trên N ảnh OK, dạng lưu ảnh OK.
- **Không thêm cột exposure** (chủ sở hữu đã quyết).

**Công thức:**
- MB mỗi khung = W × H × (1 nếu 8 bit · 1,5 nếu 10/12 bit · 2 nếu 16 bit) / 1e6. MB/s = MB mỗi khung × fps. % cổng = MB/s / băng thông giao tiếp, ngưỡng 70%.
- Băng thông hữu dụng (MB/s): GigE 115 · 2.5GigE 280 · 5GigE 570 · 10GigE 1150 · USB3 380 · CL Base 255 · CL Medium 510 · CL Full 680 · CL Deca 850 · CXP-12 ×1 1250 · CXP-12 ×4 5000.
- RAM cần (GB) = Σ(MB mỗi khung × 20)/1024 + **12** + 8 nếu chạy AI + 16 nếu huấn luyện.
- Ảnh lưu (TB):
  - MB ảnh mỗi ngày = Σ(MB mỗi khung × số ảnh kiểm/giây) × 3600 × giờ chạy.
  - Ảnh NG = MB/ngày × tỉ lệ NG × hệ số nén NG × số ngày giữ NG.
  - Ảnh OK = MB/ngày × (1 − tỉ lệ NG) × hệ số nén OK × số ngày giữ OK / N.
  - Hệ số nén: thô 1, PNG 0,5, JPEG 0,1.
  - Hiện thêm dung lượng "nếu lưu hết ảnh thô" để so sánh.
- Dung lượng chứa ảnh của cấu hình: có ổ dữ liệu thì bằng 90% ổ đó; không có thì dùng phân vùng riêng trên SSD = (GB × 0,9 − 150)/1024.
- Số khe card camera = ⌈max(0, số cam GigE/2.5G/5G − 1)/4⌉ + ⌈10GigE/2⌉ + ⌈USB3/4⌉ + ⌈CL Base/2⌉ + CL Medium + CL Full + CL Deca + ⌈CXP×1/4⌉ + CXP×4. Một camera GigE đi cổng LAN onboard.
- PoE = 13W × số camera GigE.

**Đánh giá từng khung:**

| Mức | Trường hợp |
|---|---|
| ✕ Không hợp | Khung phụ trợ (0 khe, 0 LAN). Chạy AI mà không có GPU. Thiếu khe card. RAM cần lớn hơn cấu hình lớn nhất của khung. |
| ! Đạt, có lưu ý | Huấn luyện mà VRAM < 16GB. Ảnh vượt sức chứa cấu hình lớn nhất (dùng NAS, giảm số ngày giữ, hoặc thêm cấu hình ổ lớn hơn). Dây chuyền 24/7 mà RAM/SSD là `?` (kiểm tra trước) hoặc dòng C. Tải đỉnh + PoE vượt 70% nguồn (cấp PoE bằng switch ngoài). Ảnh ≥ 20MP chạy AI trên khung không phải D. |
| i Thông tin | Chọn ổ dữ liệu dòng C cho dây chuyền 24/7: nhắc các điều kiện ở mục 2. |

- Mỗi khung lấy **cấu hình nhỏ nhất** đủ RAM (và đủ chứa ảnh nếu bật tính lưu ảnh).
- Thứ tự: Đạt → Đạt có lưu ý (ít lưu ý trước) → Không hợp (thu gọn, bấm mới xem lý do). Cùng mức thì giữ thứ tự danh mục. Thẻ đầu tiên gắn nhãn "Gợi ý".

**Ô kết quả:** tổng băng thông, RAM cần, ảnh lưu (khi bật), số khe card cần.

### Tab 3. Bảng fps
- Ma trận: 6 độ phân giải (1.3 / 2.3 / 5 / 12 / 20 / 25MP) × 11 giao tiếp. Giá trị = ⌊băng thông / MB mỗi khung⌋. Tô màu: < 10 đỏ, 10–30 vàng, > 30 xanh.
- **Ô "Thời gian phơi sáng (ms)"**, 0 = không xét: chặn fps ≤ ⌊1000/exposure⌋; ô bị chặn có dấu `*`.
- Ghi chú trên đầu tab: fps thật = nhỏ nhất trong 4 giới hạn: cáp, fps tối đa của cảm biến, exposure (chồng lấn ≤ 1000/exp; không chồng lấn ≤ 1000/(exp + thời gian đọc)), trigger và thời gian xử lý.

### Tab 4. Checklist ổn định
Chỉ hiển thị, không ghi nhận tick theo từng máy. Có nút In / tải PDF. (B) = bắt buộc, (K) = khuyến nghị.

- **Phần cứng:**
  - Dây chuyền 24/7: RAM + SSD hệ thống dòng I; không trộn RAM khác lô (B).
  - RAM luôn 2 thanh cùng lô, chốt lúc đặt hàng, không cắm thêm sau (B).
  - Ảnh lưu ở phân vùng hoặc ổ riêng, không lưu ổ C (B).
  - Ổ dữ liệu dòng C trên 24/7: phần mềm không treo, theo dõi SMART, TBW cao, không QLC (B).
  - Không dùng HDD trong tủ máy rung (K).
  - Card mạng chip Intel (i350/i210, X710/X550), có giá chống rung (B).
  - Máy có GPU RTX 50: nguồn ATX 3.1, dây 12V-2x6 nguyên bản, không dùng dây chuyển đổi (B).
  - Cắm chặt đầu 12V-2x6, không bẻ cáp gần đầu cắm (B).
  - Có UPS; tủ ≤ 40°C, có lọc bụi (B).
- **BIOS:**
  - BIOS mới nhất, microcode Intel ≥ 0x12B cho CPU đời 13/14 (B).
  - Công suất mặc định Intel, không ép xung (B).
  - Restore on AC Power Loss = Power On; bật watchdog nếu có (B).
  - Tắt ASPM / PCIe power saving (B).
- **Windows:**
  - Ưu tiên Windows IoT LTSC (K).
  - Win11 Pro: hoãn cập nhật, tắt tự khởi động lại (B).
  - Power plan High Performance; tắt Sleep, Hibernate, Fast Startup, USB selective suspend, PCIe Link State PM (B).
  - Loại thư mục ảnh và phần mềm khỏi Defender quét (B).
  - Tự đăng nhập, phần mềm tự chạy; đồng bộ giờ NTP với PLC/MES (B).
  - Tự xoá ảnh xoay vòng, OK và NG giữ số ngày riêng, ổ đầy thì xoá cũ nhất (B).
- **Mạng camera:**
  - Mỗi camera 1 cổng, mỗi cổng 1 dải IP, IP tĩnh; không chung cổng với PLC/MES (B).
  - Jumbo frame 9000; Receive Buffers tối đa; tắt Energy Efficient Ethernet (B).
  - Mỗi card chỉ 1 filter driver của 1 hãng camera (B).
  - Nhiều camera qua 1 switch: giới hạn băng thông từng camera (B).
  - USB3: tối đa 2 camera / 1 bộ điều khiển; cáp khoá vít (B).
- **GPU / phần mềm:** cố định phiên bản driver NVIDIA Studio, tắt tự cập nhật; ghi phiên bản CUDA/TensorRT (B).
- **Đồng bộ & FAT:**
  - Mỗi khung có 1 image ổ đĩa chuẩn; các cấu hình cùng khung dùng chung (K).
  - Chạy thử 24h ở 100% trigger: mất khung = 0, RAM không tăng dần, CPU/GPU < 85°C (B).

## 6. Cơ sở của số nguồn (đã chốt 03/11/2026)

Ngưỡng an toàn: tải đỉnh ≤ 70% công suất nguồn.

| Khung | Không PoE | Có PoE 8 cam | Nguồn chọn |
|---|---|---|---|
| B | ~330W | ~434W | 650W (67%). 500W chỉ đạt khi không cấp PoE trong máy, nên không chọn |
| C | ~570W | ~674W | 1000W (67%) |
| D | ~680W | ~784W | 1300W (60%). 1000W sẽ lên 78% |

## 7. File trong gói

| File | Nội dung | Ghi chú |
|---|---|---|
| `1_mau_trang_pc_vision.html` | Mẫu giao diện **đã duyệt**, chạy được. Dữ liệu `KH` / `CH`, logic `tinh()`, `danhGia()` | Nguồn sự thật cho giao diện và logic |
| `2_Quy_tac_ma_PC_gui_hang.docx/.pdf` | Quy tắc mã 2 trang, **đã gửi / sẽ gửi hãng AAEON** | Đã cập nhật P650/P1300, ATX 3.1, hậu tố TI/S |
| `3_PC_chuan_hoa_v2.xlsx` | Đối chiếu mã cũ → mới, quy tắc, năng lực camera, bảng fps, checklist | **CŨ HƠN các quyết định sau**, xem mục 8 |
| `4_Pc_goc.xlsx` | File PC gốc của chủ sở hữu (báo giá / cấu hình AAEON) | Dữ liệu nguồn |

## 8. Việc còn mở

1. **Excel v2 chưa đồng bộ** (chủ sở hữu bảo chưa cần sửa). Lệch so với mẫu ở các điểm:
   - Nguồn B vẫn 1000W (đúng là 650W), D vẫn 1000W (đúng là 1300W).
   - RAM nền trong công thức là +16 (đúng là +12).
   - Regex chưa có hậu tố TI/S.
   - Chưa có khung + 13 cấu hình.
   - Ổ dữ liệu còn ghi I (giờ cho phép C).
2. **Khung A (EBS-I10):** chưa biết RAM/SSD dòng nào (dấu `?`); chưa rõ máy mini nâng RAM/SSD được không.
3. **Chờ hãng AAEON trả lời:** PN `RT-661R-Q670-A10-0001` gồm những gì; đổi nguồn 1000W mặc định sang 650W / 1300W có giữ PN và bảo hành không; sơ đồ khe PCIe khi lắp GPU dày 2–2,5 khe.
4. **RTX 5060 Ti 16GB** làm khung AI tiết kiệm: để sau, khi đã chạy thử model thật của phòng.
5. **Giá:** chưa đưa vào. Sau này phần Gợi ý có thể hiện chênh lệch giá giữa các cấu hình.
6. Dòng 4/5/11 trong file gốc: chưa xác nhận có ổ WD dữ liệu không (đang tạm ghi D0).
