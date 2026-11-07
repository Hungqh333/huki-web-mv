import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareConfigs, composePcCode, type PcConfig, type PcFrame, type PcLine } from './code';
import { parsePcFrameSpec, type PcFrameSpec } from './specSheet';

/**
 * Đọc supabase/seed_pc.sql thành danh mục PC — cho trang xem trước /dev/pc-vision (máy local,
 * chưa cần dán SQL) và cho test. Mã ghép bằng pc/code.ts, đúng quy tắc trigger CSDL.
 */

type Value = string | number | null;

/** Tách các bộ giá trị `( … )` sau từ khoá `values` đầu tiên kể từ `from`. */
function tuplesAfter(sql: string, from: number): Value[][] {
  const start = sql.toLowerCase().indexOf('values', from);
  const rows: Value[][] = [];
  let i = start + 'values'.length;
  for (;;) {
    while (i < sql.length && /[\s,]/.test(sql[i])) i++;
    if (sql[i] !== '(') break;
    i++;
    const row: Value[] = [];
    for (;;) {
      while (/\s/.test(sql[i])) i++;
      if (sql[i] === "'") {
        let s = '';
        i++;
        for (;;) {
          if (sql[i] === "'" && sql[i + 1] === "'") {
            s += "'";
            i += 2;
          } else if (sql[i] === "'") {
            i++;
            break;
          } else s += sql[i++];
        }
        row.push(s);
      } else {
        const m = /^[^,)\s]+/.exec(sql.slice(i))!;
        i += m[0].length;
        row.push(m[0] === 'null' ? null : Number(m[0]));
      }
      while (/\s/.test(sql[i])) i++;
      if (sql[i] === ',') {
        i++;
        continue;
      }
      i++; // ')'
      break;
    }
    rows.push(row);
  }
  return rows;
}

/** supabase/seed_pc_spec.sql: mỗi lệnh `update … set spec = '<json>'::jsonb where slug in (…)` → spec theo slug. */
function readSpecs(root: string): Map<string, PcFrameSpec> {
  const sql = readFileSync(join(root, 'supabase', 'seed_pc_spec.sql'), 'utf8');
  const out = new Map<string, PcFrameSpec>();
  for (const m of sql.matchAll(/set spec = '((?:[^']|'')*)'::jsonb\s+where slug in \(([^)]*)\)/g)) {
    const spec = parsePcFrameSpec(JSON.parse(m[1].replace(/''/g, "'")));
    for (const slug of m[2].matchAll(/'([^']+)'/g)) out.set(slug[1], spec);
  }
  return out;
}

export function readPcSeed(root = process.cwd()): { frames: PcFrame[]; configs: PcConfig[] } {
  const sql = readFileSync(join(root, 'supabase', 'seed_pc.sql'), 'utf8');
  const specs = readSpecs(root);
  const frames: PcFrame[] = tuplesAfter(sql, sql.indexOf('insert into public.pc_frames')).map((r) => ({
    id: `seed-${r[0]}`, slug: String(r[0]), tier: String(r[1]), nameVi: String(r[2]), nameEn: r[3] as string | null,
    chassisPn: String(r[4]), cpu: String(r[5]), gpu: String(r[6]), vramGb: Number(r[7]), psuW: Number(r[8]), os: String(r[9]),
    ramLine: r[10] as PcLine, ssdLine: r[11] as PcLine, cardSlots: Number(r[12]), lanPorts: Number(r[13]), peakLoadW: Number(r[14]),
    useForVi: r[15] as string | null, useForEn: r[16] as string | null, notForVi: r[17] as string | null, notForEn: r[18] as string | null,
    noteVi: r[19] as string | null, noteEn: r[20] as string | null, status: 'active', sortOrder: Number(r[21]),
    spec: specs.get(String(r[0])) ?? {},
  }));
  const bySlug = new Map(frames.map((f) => [f.slug, f]));
  const configs: PcConfig[] = tuplesAfter(sql, sql.indexOf('insert into public.pc_configs'))
    .map((r) => {
      const frame = bySlug.get(String(r[0]))!;
      const parts = {
        ramGb: Number(r[2]), ssdGb: Number(r[3]),
        dataKind: r[4] as 'D' | 'H' | null, dataGb: r[5] as number | null, dataLine: r[6] as 'I' | 'C' | null,
      };
      return { id: `seed-${r[1]}`, frameId: frame.id, shortName: String(r[1]), ...parts, code: composePcCode(frame, parts), status: 'active' as const };
    })
    .sort(compareConfigs);
  return { frames, configs };
}
