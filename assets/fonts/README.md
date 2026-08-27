# Font dùng cho xuất PDF

`BeVietnamPro-Regular.ttf` và `BeVietnamPro-Bold.ttf` — trích từ gói npm
`@expo-google-fonts/be-vietnam-pro`, giấy phép SIL Open Font License 1.1.

## Vì sao commit file font vào repo thay vì cài qua npm

Font mặc định của PDF (Helvetica) **không có glyph tiếng Việt** — chữ có dấu sẽ mất
hoặc ra ô vuông.

Gói `@fontsource/*` chỉ ship font đã cắt theo subset: file `vietnamese` chỉ chứa
đúng các ký tự riêng của tiếng Việt, không có chữ Latin cơ bản. Dùng nó thì `Đo` ra
được chữ `Đ` nhưng chữ `o` lại rơi về Helvetica. Vì vậy cần file font đầy đủ.

Đọc font từ `node_modules` lúc chạy là chỗ hay hỏng khi deploy — bundler không truy
vết được file nhị phân, build ở máy thì chạy mà lên Vercel thì lỗi. Đặt file trong
repo và khai báo `outputFileTracingIncludes` ở `next.config.ts` để Vercel đóng gói
theo.

## Đổi font

Thay hai file này bằng file `.ttf` khác **có đủ glyph tiếng Việt**, giữ nguyên tên.
Kiểm tra lại bằng:

```bash
npm run test:pdf
```

Script sẽ dựng một PDF mẫu và kiểm tra ở mức bảng ánh xạ ký tự xem dấu tiếng Việt có
mã hoá đúng không.
