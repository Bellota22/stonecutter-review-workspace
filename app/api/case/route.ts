import { withDatabase } from '../../../src/server/db.ts';
import { openCase } from '../../../src/server/caseService.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only view of one review case: evidence, checks, policy verdict and saved decision. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get('brandId');
  const marketplace = url.searchParams.get('marketplace') ?? 'US';
  if (!brandId) {
    return Response.json({ error: 'invalid_request', problems: ['brandId is required.'] }, { status: 400 });
  }
  try {
    const view = await withDatabase((db) => openCase(db, brandId, marketplace));
    return Response.json(view);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: 'case_unavailable', message }, { status: 404 });
  }
}
