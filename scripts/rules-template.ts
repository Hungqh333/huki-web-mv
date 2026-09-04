/**
 * Sinh file Excel mẫu cho đội kỹ thuật điền bảng luật.
 *
 *   npm run import:rules:template
 *
 * File gồm 2 sheet: sheet nhập liệu có sẵn vài dòng ví dụ, và sheet hướng dẫn
 * liệt kê toàn bộ trường dùng được cùng ý nghĩa từng cột.
 */
import ExcelJS from 'exceljs';
import { COLUMNS } from './lib/rules-io';
import { DERIVED_FIELD_KEYS } from '../src/lib/selector/derivedKeys';
import { FIELD_CATALOG } from '../src/lib/selector/fields';

const COLUMN_HELP: Record<string, string> = {
  code: 'Mã luật, duy nhất. Ví dụ MEAS-TELECENTRIC-TOL. Dùng lại mã cũ = cập nhật luật đó.',
  task_slug: 'Bài toán. Xem danh sách ở sheet "Huong dan".',
  priority: 'Số nguyên. SỐ NHỎ = ƯU TIÊN CAO. Luật nền thường để 100.',
  condition_json:
    'Điều kiện để luật khớp. Để trống = luật nền, luôn khớp. Xem cú pháp ở sheet "Huong dan".',
  recommended_camera: 'Để trống nếu luật này không quyết định camera.',
  recommended_lighting: 'Để trống nếu luật này không quyết định ánh sáng.',
  recommended_lens: 'Để trống nếu luật này không quyết định ống kính.',
  recommended_processing:
    'Máy tính / giao tiếp / GPU. Viết điều kiện theo data_rate_mbytes_s (GigE ~125 MB/s).',
  recommended_accessories: 'Kính lọc, cáp, gá đỡ, vỏ bảo vệ — thứ hay bị quên khi báo giá.',
  ai_or_rule_based:
    'rule_based | hybrid | deep_learning. Mặc định rule_based. Chỉ dùng deep_learning khi rule-based thật sự không đáp ứng được.',
  notes_vi: 'Ghi chú / lý do / rủi ro, tiếng Việt. Hiện trong kết quả và báo cáo PDF.',
  notes_en: 'Ghi chú tiếng Anh.',
  is_active: 'TRUE hoặc FALSE. Để trống = TRUE. FALSE để tạm tắt luật mà không xoá.',
};

const EXAMPLES = [
  {
    code: 'VD-BASE',
    task_slug: '2d-measurement',
    priority: 100,
    condition_json: '',
    recommended_camera: 'Area scan đơn sắc, global shutter',
    recommended_lighting: 'Đèn nền chuẩn trực',
    recommended_lens: 'Ống kính fixed focal',
    recommended_processing: 'GigE, PC công nghiệp i5, 16 GB RAM',
    recommended_accessories: 'Cáp GigE 5 m, gá camera, kính lọc phân cực',
    ai_or_rule_based: 'rule_based',
    notes_vi: 'Cấu hình nền, luôn áp dụng khi không có luật nào cụ thể hơn.',
    notes_en: 'Baseline configuration, applied when no more specific rule matches.',
    is_active: 'TRUE',
  },
  {
    code: 'VD-TOL-CHAT',
    task_slug: '2d-measurement',
    priority: 20,
    condition_json: '{"all":[{"field":"tolerance_mm","op":"lt","value":0.05}]}',
    recommended_camera: '',
    recommended_lighting: '',
    recommended_lens: 'Ống kính telecentric',
    recommended_processing: '',
    recommended_accessories: '',
    ai_or_rule_based: 'rule_based',
    notes_vi: 'Dung sai dưới 0.05 mm thì sai số phối cảnh của ống kính thường đã vượt dung sai.',
    notes_en: 'Below 0.05 mm the perspective error of a standard lens already exceeds the tolerance.',
    is_active: 'TRUE',
  },
  {
    code: 'VD-NHIEU-DIEU-KIEN',
    task_slug: 'appearance-inspection',
    priority: 30,
    condition_json:
      '{"all":[{"field":"surface","op":"in","value":["metal","reflective"]},{"field":"defect_variability","op":"eq","value":"high"}]}',
    recommended_camera: '',
    recommended_lighting: 'Đèn dark field góc thấp',
    recommended_lens: '',
    recommended_processing: 'GPU rời cho suy luận deep learning',
    recommended_accessories: '',
    ai_or_rule_based: 'deep_learning',
    notes_vi: 'Cả hai điều kiện phải cùng đúng thì luật mới khớp.',
    notes_en: 'Both conditions must hold for this rule to match.',
    is_active: 'TRUE',
  },
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Machine Vision Hub';
  workbook.created = new Date();

  // --- Sheet nhập liệu -------------------------------------------------------
  const sheet = workbook.addWorksheet('Bang luat');
  sheet.columns = COLUMNS.map((name) => ({
    header: name,
    key: name,
    width: name.startsWith('notes') || name === 'condition_json' ? 52 : 24,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F2FE' },
  };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const example of EXAMPLES) {
    sheet.addRow(example);
  }

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
  });

  // --- Sheet hướng dẫn -------------------------------------------------------
  const help = workbook.addWorksheet('Huong dan');
  help.columns = [
    { header: '', key: 'a', width: 30 },
    { header: '', key: 'b', width: 96 },
  ];

  const heading = (text: string) => {
    const row = help.addRow({ a: text, b: '' });
    row.font = { bold: true, size: 12 };
    row.getCell('a').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
  };
  const line = (a: string, b: string) => help.addRow({ a, b }).alignment = { vertical: 'top', wrapText: true };

  heading('Ý nghĩa từng cột');
  for (const column of COLUMNS) line(column, COLUMN_HELP[column] ?? '');

  help.addRow({});
  heading('Cú pháp điều kiện');
  line('Để trống', 'Luật nền — luôn khớp với mọi tham số.');
  line('Một điều kiện', '{"all":[{"field":"tolerance_mm","op":"lt","value":0.05}]}');
  line(
    'Nhiều điều kiện',
    '{"all":[{"field":"surface","op":"in","value":["metal"]},{"field":"throughput_ppm","op":"gt","value":60}]} — TẤT CẢ phải cùng đúng.'
  );

  help.addRow({});
  heading('Toán tử (op)');
  line('eq / ne', 'Bằng / khác. value là một giá trị.');
  line('lt / lte / gt / gte', 'Nhỏ hơn / nhỏ hơn bằng / lớn hơn / lớn hơn bằng. Dùng cho số.');
  line('in / nin', 'Nằm trong / không nằm trong danh sách. value phải là mảng, ví dụ ["metal","reflective"].');
  line('exists', 'value là true/false — người dùng có điền trường này hay không.');

  help.addRow({});
  heading('Cách ghép kết quả');
  line(
    'Ưu tiên',
    'Với từng ô (camera / ánh sáng / ống kính), luật có priority NHỎ HƠN thắng. Luật ưu tiên cao để trống ô nào thì lấy giá trị của luật kế tiếp.'
  );
  line(
    'Ghi chú',
    'Gom từ TẤT CẢ luật khớp, không chỉ luật ưu tiên cao nhất — mỗi luật cảnh báo một rủi ro khác nhau.'
  );
  line(
    'Hướng giải quyết',
    'Mặc định rule_based. Chỉ leo lên hybrid / deep_learning khi có luật khớp ghi rõ, và ghi chú của chính luật đó sẽ hiển thị làm lý do.'
  );

  help.addRow({});
  heading('Trường người dùng nhập');
  for (const [key, def] of Object.entries(FIELD_CATALOG)) {
    const values = def.options ? ` Giá trị: ${def.options.map((o) => o.value).join(' | ')}` : '';
    const unit = def.unit ? ` (${def.unit})` : '';
    line(key, `${def.kind}${unit}.${values}`);
  }

  help.addRow({});
  heading('Trường hệ thống tự tính');
  line('(dùng được trong điều kiện như trường thường)', '');
  for (const key of DERIVED_FIELD_KEYS) line(key, '');

  const target = process.argv[2] ?? 'bang-luat-mau.xlsx';
  await workbook.xlsx.writeFile(target);

  console.log(`Đã tạo file mẫu: ${target}`);
  console.log('\nGửi file này cho đội kỹ thuật điền. Điền xong chạy:');
  console.log(`  npm run import:rules -- ${target}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
