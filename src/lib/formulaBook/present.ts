import { FORMULA_BOOK, type FormulaEntry } from './book';

/**
 * Tách nội dung một mục sổ tay để trình bày (chốt 2026-10-27, mẫu CAM-001): mỗi dòng công
 * thức một hàng + ghi chú phụ; kết luận thành bảng "Khi … / nhãn"; mã luật gom về dòng
 * "Liên quan". Chỉ đọc chữ đã có trong book.ts — không viết lại nội dung 75 mục.
 * Hàm thuần, chỉ dùng ở máy chủ (cùng tầng với book.ts).
 */

/** Mã luật / mã mục: RES-004, LGT-001..004, AI-001/002, EXP-001..002. */
const CODE = /\b[A-Z]{2,4}-\d{3}(?:\.\.\d{3}|\/\d{3})?\b/g;

export type FormulaLine = { main: string; note: string | null };
export type VerdictKind = 'bad' | 'warn' | 'ok' | 'unknown' | 'neutral';
export type VerdictRow = { when: string; kind: VerdictKind; label: string | null };

const tidy = (text: string) =>
  text
    .replace(/\s+([,;])/g, '$1')
    .replace(/\(\s*[,;·]\s*/g, '(')
    .replace(/\s*[,;·]\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*[,;·]\s*$/g, '')
    .replace(/^\s*[,;·]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Bỏ mã luật nằm TRONG NGOẶC ("(RES-004)", "(THR-005, chỉ khi …)") — mã đã gom về dòng
 * Liên quan. Mã đứng giữa câu ("theo CAM-002") giữ nguyên để câu không cụt.
 */
function stripCodes(text: string): string {
  return tidy(
    text.replace(/\(([^()]*)\)/g, (_, inner: string) => {
      const rest = tidy(inner.replace(CODE, ''));
      return rest ? `(${rest})` : '';
    })
  );
}

/** Tách một chuỗi theo dấu phân cách, bỏ qua dấu nằm trong ngoặc. */
function splitOutside(text: string, separators: string[]): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const sep = separators.find((s) => text.startsWith(s, i));
      if (sep) {
        parts.push(text.slice(start, i));
        start = i + sep.length;
        i += sep.length - 1;
      }
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Một dòng công thức: phần trong ngoặc ở CUỐI dòng, cách công thức ≥ 2 dấu cách, là ghi chú
 * phụ ("(µs; chỉ khi …)").
 */
export function splitFormulaLine(line: string): FormulaLine {
  const m = line.match(/^(.*\S)\s{2,}\((.*)\)\s*$/);
  const main = stripCodes(m ? m[1] : line);
  const note = m ? stripCodes(`(${m[2]})`).replace(/^\((.*)\)$/, '$1').trim() : '';
  return { main, note: note || null };
}

/**
 * Các dòng công thức của một mục — dòng ghép bằng " · " tách thành từng hàng; dòng bắt đầu
 * bằng dấu cách là ý con của dòng trên (indent).
 */
export function formulaLines(entry: FormulaEntry): (FormulaLine & { indent: boolean })[] {
  return entry.formula
    .flatMap((line) => {
      const indent = /^\s/.test(line);
      const m = line.match(/^(.*\S)(\s{2,}\(.*\))\s*$/);
      const body = m ? m[1] : line;
      const parts = splitOutside(body, [' · ']);
      return parts.map((part, i) => ({ ...splitFormulaLine(i === parts.length - 1 && m ? `${part}${m[2]}` : part), indent }));
    })
    .filter((l) => l.main);
}

/** Ranh giới sau từ khoá — \b của JS không hiểu chữ có dấu (LƯU Ý). */
const END = '(?=$|[\\s(:·,.])';
const KINDS: { kind: VerdictKind; word: string; label: string }[] = [
  { kind: 'bad', word: 'LOẠI', label: 'Loại' },
  // Q2 (2026-10-27): CẢNH BÁO và LƯU Ý gộp một nhãn "Lưu ý"; chữ thường "cảnh báo …" cũng tính.
  { kind: 'warn', word: 'CẢNH BÁO|LƯU Ý|cảnh báo', label: 'Lưu ý' },
  { kind: 'ok', word: 'ĐẠT', label: 'Đạt' },
  { kind: 'unknown', word: 'chưa kiểm được', label: 'Chưa kiểm được' },
];

/** "LƯU Ý (cần strobe)" / "LƯU Ý: cần đèn mạnh" → "Lưu ý · cần strobe". */
function badge(label: string, rest: string): string {
  const detail = stripCodes(rest)
    .replace(/^[:\s]+/, '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  return detail ? `${label} · ${detail}` : label;
}

/** Điều kiện còn lại khi kết luận đứng không có "→": bỏ "luôn", dấu hai chấm cuối. */
function whenOf(text: string): string {
  const w = stripCodes(text)
    .replace(/[:\s]+$/, '')
    .replace(/(^|\s)[Ll]uôn$/u, '')
    .replace(/[:\s]+$/, '')
    .trim();
  return w || 'Mọi trường hợp';
}

/** Một kết luận "điều kiện → KẾT LUẬN (chi tiết)" → hàng bảng (có thể nhiều hàng). */
function verdictRow(clause: string): VerdictRow[] {
  const at = clause.lastIndexOf(' → ');
  if (at >= 0) {
    const when = stripCodes(clause.slice(0, at));
    const result = clause.slice(at + 3).trim();
    for (const k of KINDS) {
      const m = result.match(new RegExp(`^(${k.word})${END}`, 'u'));
      if (m) return [{ when, kind: k.kind, label: badge(k.label, result.slice(m[0].length)) }];
    }
    // "bài đo LOẠI / bài phát hiện CẢNH BÁO" → mỗi trường hợp một hàng.
    const cases = splitOutside(result, [' / ']).map((part) => {
      for (const k of KINDS) {
        const m = new RegExp(`^(.*\\S)\\s+(${k.word})${END}`, 'u').exec(part);
        if (m) return { when: `${when}, ${m[1]}`, kind: k.kind, label: badge(k.label, part.slice(m[0].length)) };
      }
      return null;
    });
    if (cases.length > 1 && cases.every(Boolean)) return cases as VerdictRow[];
    return [{ when, kind: 'neutral', label: stripCodes(result) }];
  }
  // Không có "→": "Luôn CẢNH BÁO (…)", "camera màu + IR: LOẠI", "CẢNH BÁO".
  for (const k of KINDS) {
    const m = new RegExp(`(^|[:\\s])(${k.word})${END}`, 'u').exec(clause);
    if (m) {
      const start = m.index + m[1].length;
      return [{ when: whenOf(clause.slice(0, start)), kind: k.kind, label: badge(k.label, clause.slice(start + m[2].length)) }];
    }
  }
  return [{ when: stripCodes(clause), kind: 'neutral', label: null }];
}

/** Mọi kết luận của một mục: tách câu ghép "·" / ";" thành từng hàng. */
export function verdictRows(entry: FormulaEntry): VerdictRow[] {
  return (entry.verdict ?? []).flatMap((line) => splitOutside(line, [' · ', '; ']).flatMap(verdictRow));
}

/** Mã con → mã mục chứa nó (LGT-003 → LGT-001..004; AI-002 → AI-001/002). */
const ENTRY_OF = (() => {
  const map = new Map<string, string>();
  for (const entry of FORMULA_BOOK.flatMap((s) => s.entries)) {
    map.set(entry.id, entry.id);
    for (const rule of entry.rules ?? []) if (!map.has(rule)) map.set(rule, entry.id);
    const range = entry.id.match(/^([A-Z]+)-(\d{3})\.\.(\d{3})$/);
    if (range) {
      for (let n = Number(range[2]); n <= Number(range[3]); n++) {
        const code = `${range[1]}-${String(n).padStart(3, '0')}`;
        if (!map.has(code)) map.set(code, entry.id);
      }
    }
    const pair = entry.id.match(/^([A-Z]+)-(\d{3})\/(\d{3})$/);
    if (pair) for (const n of [pair[2], pair[3]]) if (!map.has(`${pair[1]}-${n}`)) map.set(`${pair[1]}-${n}`, entry.id);
  }
  return map;
})();

/** Mục sổ tay chứa một mã luật (null nếu sổ tay không có). */
export function entryIdFor(code: string): string | null {
  return ENTRY_OF.get(code) ?? null;
}

/**
 * Dòng "Liên quan": mã luật nhắc tới trong công thức + kết luận, quy về mục chứa nó,
 * bỏ chính mục này và các luật mục này mô tả; giữ thứ tự xuất hiện.
 */
export function relatedEntries(entry: FormulaEntry): string[] {
  const own = new Set([entry.id, ...(entry.rules ?? [])].map((c) => ENTRY_OF.get(c) ?? c));
  const out: string[] = [];
  for (const text of [...entry.formula, ...(entry.verdict ?? [])]) {
    for (const code of text.match(CODE) ?? []) {
      const id = ENTRY_OF.get(code) ?? null;
      if (id && !own.has(id) && !out.includes(id)) out.push(id);
    }
  }
  return out;
}
