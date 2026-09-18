# C9 — Checklist chạy một dự án thật trên production

Tiêu chí xong V1c (spec V1.1 §14): **chạy được một dự án thật từ đầu đến BOM gửi mua hàng.**
Chạy thử trên dự án mẫu soạn S-11 (`npm run dryrun:c9 -- <thư-mục>`) đã đi hết luồng; checklist
này dành cho lần chạy bằng dự án thật, trên https://huki-web-mv.vercel.app, bằng tài khoản thật.

Mỗi bước ghi **Đạt / Không** và ghi chú. Bước nào "Không" thì chụp màn hình, không cần làm tiếp
bước phụ thuộc.

## Chuẩn bị (một lần)

1. Kho thiết bị: điền `docs/NHAP_THIET_BI.xlsx` với thiết bị đã dùng thật trong dự án + 2–3
   lựa chọn thay thế mỗi loại. **Điền cả** khẩu F nhỏ nhất / lớn nhất và lp/mm của ống kính,
   số core / cổng LAN của máy tính — thiếu thì mọi phương án mang cờ "chưa kiểm được".
   → Mong đợi: gửi file cho Claude, nhận lại SQL nhập kho, dán vào SQL Editor, "Success".
2. Chuẩn bị mô tả bài toán bằng lời (như email khách), bỏ tên khách và thông tin mật.

## Chạy

| # | Làm | Mong đợi |
|---|---|---|
| 1 | Trang chủ → dán mô tả vào ô nhập bằng lời → Gửi | Mở bảng Yêu cầu, các ô đọc được có nhãn "Đã nêu" kèm đoạn văn gốc |
| 2 | Soát từng ô đã điền với thông số thật; sửa ô sai, điền ô thiếu | Ghi lại ô nào bộ đọc đọc SAI (không tính ô bỏ trống) |
| 3 | Xem khối **Phân tích kỹ thuật** | Kết luận khả thi + yếu tố giới hạn khớp đánh giá của kỹ sư đã làm dự án |
| 4 | Xem **Thiết bị phù hợp** → mở "Đã loại — lý do" | Thiết bị đã dùng thật KHÔNG bị loại; nếu bị loại, ghi mã luật + lý do |
| 5 | Xem **Phương án** (Tiết kiệm / Đề xuất / Hiệu năng cao) | Có ít nhất một mức gần với cấu hình đã dùng thật |
| 6 | Bấm **Vì sao chọn?** ở mức định chọn → **Diễn giải bằng lời** | Khối dữ kiện đủ phần; đoạn diễn giải không có số lạ |
| 7 | **Chọn phương án này** → xem **Danh mục vật tư** | Đủ dòng: camera, ống, đèn, cáp, bộ điều khiển đèn, máy tính, phần mềm, phụ kiện, vật chuẩn |
| 8 | So BOM với BOM thật của dự án | Ghi dòng THIẾU, dòng THỪA, số lượng sai |
| 9 | Lưu dự án (đặt tên) | Có Rev A, thanh lưu báo đã lưu |
| 10 | **Tải BOM (Excel)** | Mở được; thành tiền và tổng là công thức; ghi "Thiếu giá N dòng" nếu có |
| 11 | **Tải Concept Report (PDF)** (tài khoản VIP) | Tiếng Việt đủ dấu, không có giá, trang Giả định & Loại trừ riêng |
| 12 | Gửi file Excel cho mua hàng | Mua hàng đặt được hàng mà KHÔNG phải làm lại — ghi mọi chỗ họ hỏi lại / trả lại |

## Gửi lại cho Claude

- Bảng Đạt / Không của 12 bước + ghi chú.
- File Excel + PDF đã xuất.
- BOM thật của dự án (để thêm thành golden **GT-003**).
- Phản hồi của mua hàng (bước 12).
