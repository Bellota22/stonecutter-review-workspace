import { withDatabase } from '../../../../src/server/db.ts';
import { CaseError, saveDecision } from '../../../../src/server/caseService.ts';
import { OUTCOMES, type Outcome } from '../../../../src/domain/vocabulary.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DecisionInput {
  brandId: string;
  marketplace: string;
  outcome: Outcome;
  reason: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOutcome = (value: unknown): value is Outcome =>
  typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);

function readText(source: Record<string, unknown>, key: string, problems: string[]): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} is required.`);
    return '';
  }
  return value;
}

function readOutcome(source: Record<string, unknown>, problems: string[]): Outcome {
  const value = source.outcome;
  if (isOutcome(value)) return value;
  problems.push(`outcome must be one of: ${OUTCOMES.join(', ')}.`);
  return 'hold';
}

function parseDecisionInput(body: unknown): DecisionInput | string[] {
  if (!isRecord(body)) return ['A JSON object body is required.'];
  const problems: string[] = [];
  const input: DecisionInput = {
    brandId: readText(body, 'brandId', problems),
    marketplace: readText(body, 'marketplace', problems),
    outcome: readOutcome(body, problems),
    reason: body.reason === undefined ? '' : readText(body, 'reason', problems),
  };
  return problems.length > 0 ? problems : input;
}

function statusFor(code: CaseError['code']): number {
  switch (code) {
    case 'policy_violation':
      return 422;
    case 'invalid_request':
      return 400;
    case 'no_decision':
      return 404;
  }
}

/**
 * Records a review decision. The backend re-derives the evidence and the policy verdict on every
 * save, so an unsupported expansion is refused here even if the request did not come from the UI.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'invalid_request', details: ['A JSON body is required.'] },
      { status: 400 },
    );
  }

  const parsed = parseDecisionInput(body);
  if (Array.isArray(parsed)) {
    return Response.json({ error: 'invalid_request', details: parsed }, { status: 400 });
  }

  try {
    const decision = await withDatabase((db) =>
      saveDecision(db, parsed.brandId, parsed.marketplace, {
        outcome: parsed.outcome,
        reason: parsed.reason,
      }),
    );
    return Response.json(
      {
        decisionId: decision.decision.decisionId,
        version: decision.decision.version,
        outcome: decision.decision.outcome,
        budgetChangePct: decision.decision.budgetChangePct,
        limitations: decision.decision.limitations,
        evidenceFingerprint: decision.decision.evidenceFingerprint,
        scope: { brandId: decision.view.scope.brandId, marketplace: decision.view.scope.marketplace },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CaseError) {
      return Response.json({ error: error.code, details: error.details }, { status: statusFor(error.code) });
    }
    throw error;
  }
}
