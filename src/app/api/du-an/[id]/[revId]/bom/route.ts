import { NextResponse, type NextRequest } from 'next/server';
import { buildBomWorkbook } from '@/lib/export/bomWorkbook';
import { loadRevisionForExport } from '@/lib/export/loadRevision';

/** exceljs cần Node (Buffer, stream) — không chạy được ở Edge. */
export const runtime = 'nodejs';

/** File Excel BOM của một revision đã lưu (V1c C6) — Member trở lên. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; revId: string }> }) {
  const { id, revId } = await params;
  const loaded = await loadRevisionForExport(id, revId, 'xlsx');
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const buffer = await buildBomWorkbook(loaded.doc, loaded.t);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${loaded.fileStem}-bom.xlsx"`,
      // Có giá và nhà cung cấp — không cho CDN hay proxy lưu lại.
      'Cache-Control': 'private, no-store',
    },
  });
}
