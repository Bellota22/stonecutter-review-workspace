import { withDatabase } from '../../../../src/server/db.ts';
import { PolicyViolation, ValidationError, saveDecision } from '../../../../src/server/caseService.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OUTCOMES = ['expand_promotion', 'hold'] as const;
type Outcome = typeof OUTCOMES[number];

function parse(body: unknown): { brandId: string; marketplace: string; outcome: Outcome; reason: string } | { problems: string[] } {
  if (typeof body !== 'object' || body === null) return { problems: ['A JSON object body is required.'] };
  const record = body as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof record.brandId !== 'string' || !record.brandId) problems.push('brandId is required.');
  if (typeof record.marketplace !== 'string' || !record.marketplace) problems.push('marketplace is required.');
  if (typeof record.outcome !== 'string' || !OUTCOMES.includes(record.outcome as Outcome)) {
    problems.push(`outcome must be one of: ${OUTCOMES.join(', ')}.`);
  }
  if (typeof record.reason !== 'string') problems.push('reason is required.');
  if (problems.length) return { problems };
  return {
    brandId: record.brandId as string, marketplace: record.marketplace as string,
    outcome: record.outcome as Outcome, reason: record.reason as string,
  };
}

/**
 * Records a review decision. The backend re-derives the evidence and the policy verdict on every
 * save, so an unsupported expansion is refused here even if the request did not come from the UI.
 */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'invalid_request', problems: ['A JSON body is required.'] }, { status: 400 }); }

  const input = parse(body);
  if ('problems' in input) {
    return Response.json({ error: 'invalid_request', problems: input.problems }, { status: 400 });
  }

  try {
    const { decision } = await withDatabase(db =>
      saveDecision(db, input.brandId, input.marketplace, { outcome: input.outcome, reason: input.reason }));
    return Response.json({
      decisionId: decision.decisionId, version: decision.version, outcome: decision.outcome,
      budgetChangePct: decision.budgetChangePct, limitations: decision.limitations,
      evidenceFingerprint: decision.evidenceFingerprint,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PolicyViolation) {
      return Response.json({ error: 'policy_violation', violations: error.violations }, { status: 422 });
    }
    if (error instanceof ValidationError) {
      return Response.json({ error: 'invalid_request', problems: error.problems }, { status: 400 });
    }
    throw error;
  }
}
