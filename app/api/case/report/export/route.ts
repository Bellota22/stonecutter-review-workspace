import { withDatabase } from '../../../../../src/server/db.ts';
import { openCase, reportFor } from '../../../../../src/server/caseService.ts';
import { exportFileName, renderPdf } from '../../../../../src/server/exportReport.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The client report as a PDF, rendered from the same object the page shows. A draft can be exported
 * too: it is labelled as a draft inside the document and in the file name.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get('brandId');
  const marketplace = url.searchParams.get('marketplace') ?? 'US';

  if (!brandId) {
    return Response.json({ error: 'invalid_request', details: ['brandId is required.'] }, { status: 400 });
  }

  const result = await withDatabase(async (db) => {
    const view = await openCase(db, brandId, marketplace);
    return reportFor(view);
  });

  if (result.kind !== 'ready' && result.kind !== 'draft') {
    return Response.json(
      { error: 'report_unavailable', details: ['The report cannot be exported for this case.'] },
      { status: 409 },
    );
  }

  const body = new Uint8Array(await renderPdf(result.report));
  return new Response(body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${exportFileName(result.report)}"`,
      'content-length': String(body.byteLength),
      'cache-control': 'no-store',
    },
  });
}
