import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { loadRevisionForExport } from '@/lib/export/loadRevision';
import { ConceptReport } from '@/lib/pdf/concept/ConceptReport';
import { registerPdfFonts } from '@/lib/pdf/fonts';

export const runtime = 'nodejs';

/** Concept Report PDF của một revision đã lưu (V1c C6, spec §11.1) — VIP trở lên. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; revId: string }> }) {
  const { id, revId } = await params;
  const loaded = await loadRevisionForExport(id, revId, 'pdf');
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  registerPdfFonts();
  const buffer = await renderToBuffer(<ConceptReport doc={loaded.doc} t={loaded.t} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${loaded.fileStem}-concept-report.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
