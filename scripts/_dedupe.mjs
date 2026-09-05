import { readFileSync, writeFileSync } from 'node:fs';

const fail = [];
const edit = (p, pairs) => {
  let s = readFileSync(p, 'utf8');
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      fail.push(p + ' :: ' + from.slice(0, 55));
      continue;
    }
    s = s.split(from).join(to);
  }
  writeFileSync(p, s);
};

// --- ComponentPicker: gộp chữ từ bảng luật vào ngay thẻ thiết bị, và thêm thẻ
//     phụ kiện ở cuối (cụm này không có thiết bị để chọn).
edit('src/components/selector/ComponentPicker.tsx', [
  [
    `                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {tResult(row.key)}
                      </h4>`,
    `                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {tResult(row.key)}
                      </h4>`,
  ],
  [
    `      <ol className="mt-4 space-y-3">
        {ROWS.map((row) => {
          const entry = byKey[row.key];
          const fit = fitLine(row.key);`,
    `      <ol className="mt-4 space-y-3">
        {ROWS.map((row, index) => {
          const entry = byKey[row.key];
          const fit = fitLine(row.key);
          const ruleText = result[row.key];`,
  ],
  [
    `                  {fit ? (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {fit}
                    </p>
                  ) : null}`,
    `                  {/*
                    Gợi ý dạng chữ của bảng luật gộp vào đây luôn. Trước đây nó
                    là một danh sách 5 thẻ riêng ngay phía trên, lặp lại đúng
                    những cụm này — đọc hai lần mà không thêm thông tin.
                  */}
                  {fit || ruleText ? (
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {fit ? <p>{fit}</p> : null}
                      {ruleText ? <p>{t('fromRule', { text: ruleText })}</p> : null}
                    </div>
                  ) : null}`,
  ],
  [
    `      </ol>

      {analysis ? (`,
    `      </ol>

      {/* Phụ kiện chưa có thiết bị cụ thể trong catalog — chỉ hiện gợi ý dạng chữ. */}
      {result.accessories ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <IconBadge name="rules" tone="slate" className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">5</span>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {tResult('accessories')}
                </h4>
              </div>
              <p className="mt-1 text-sm">{result.accessories}</p>
            </div>
          </div>
        </div>
      ) : null}

      {analysis ? (`,
  ],
]);

// --- SelectorResultPanel: có catalog thì bỏ hẳn danh sách BOM dạng chữ, và bỏ
//     khối "Cách tính" cũ khi đã có khung kiểm tra khả thi (trùng nội dung, lại
//     còn hiển thị px/mm thay vì mm/px).
edit('src/components/selector/SelectorResultPanel.tsx', [
  [
    `import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { ComponentPicker } from './ComponentPicker';`,
    `import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { appearanceInputFromForm } from '@/lib/vision/fromInput';
import { ComponentPicker } from './ComponentPicker';`,
  ],
  [
    `  const valueOf = (key: (typeof BOM)[number]['key']) => result[key];`,
    `  const valueOf = (key: (typeof BOM)[number]['key']) => result[key];

  /*
   * Có catalog thì phần chọn thiết bị đã liệt kê đúng những cụm này kèm mã hàng
   * thật, nên danh sách dạng chữ chỉ còn là bản lặp. Chỉ giữ lại khi catalog
   * rỗng — lúc đó nó là kết quả duy nhất.
   */
  const hasCatalog = components.length > 0;

  /* Khung kiểm tra khả thi đã trình bày lại các phép tính này theo mm/px và kèm
     PASS/FAIL, nên khối "Cách tính" cũ thành thừa. */
  const hasVisionChecks = appearanceInputFromForm(input) !== null;`,
  ],
  [
    `      <div>
        <h3 className="font-semibold">{t('bomTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('bomHint')}</p>

        <ol className="mt-4 space-y-3">`,
    `      <div hidden={hasCatalog}>
        <h3 className="font-semibold">{t('bomTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('bomHint')}</p>

        <ol className="mt-4 space-y-3">`,
  ],
  [
    `      {result.derived.length > 0 ? (`,
    `      {result.derived.length > 0 && !hasVisionChecks ? (`,
  ],
]);

if (fail.length) {
  console.error('KHONG THAY:\n' + fail.join('\n'));
  process.exit(1);
}
console.log('bo trung lap: gop chu bang luat vao the thiet bi, an BOM va Cach tinh cu');
