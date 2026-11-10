import { withDatabase } from '../../../../src/server/db.ts';
import { generateReport } from '../../../../src/server/caseService.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generates the client report from the saved decision and the evidence it was recorded against.
 * A changed fingerprint returns 409 instead of reusing the previous approval.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get('brandId');
  const marketplace = url.searchParams.get('marketplace') ?? 'US';
  if (!brandId) {
    return Response.json({ error: 'invalid_request', problems: ['brandId is required.'] }, { status: 400 });
  }

  const result = await withDatabase((db) => generateReport(db, brandId, marketplace));
  if (result.kind === 'ready' || result.kind === 'draft') {
    return Response.json({ kind: result.kind, report: result.report });
  }
  if (result.kind === 'no_decision') {
    return Response.json(
      { kind: 'no_decision', error: 'No decision has been saved for this case.' },
      { status: 404 },
    );
  }
  if (result.kind === 'requires_attention') {
    return Response.json({ kind: 'requires_attention', changes: result.changes }, { status: 409 });
  }
  return Response.json({ kind: 'policy_changed', violations: result.violations }, { status: 409 });
}
