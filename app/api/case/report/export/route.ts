import { withDatabase } from '../../../../../src/server/db.ts';
import { openCase, reportFor } from '../../../../../src/server/caseService.ts';
import { exportFileName, renderDocx, renderPdf } from '../../../../../src/server/exportReport.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The client report as a file, rendered from the same object the page shows. A draft can be exported
 * too: it is labelled as a draft inside the document and in the file name.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get('brandId');
  const marketplace = url.searchParams.get('marketplace') ?? 'US';
  const format = url.searchParams.get('format') === 'docx' ? 'docx' : 'pdf';

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

  const bytes = format === 'pdf' ? await renderPdf(result.report) : await renderDocx(result.report);
  const body = new Uint8Array(bytes);
  return new Response(body, {
    headers: {
      'content-type':
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${exportFileName(result.report, format)}"`,
      'content-length': String(body.byteLength),
      'cache-control': 'no-store',
    },
  });
}
