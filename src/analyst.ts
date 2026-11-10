import type { PGlite } from '@electric-sql/pglite';
import { PERIOD_START, PREVIOUS_START } from './database.ts';
import { getEvidence, SNAPSHOT_SQL } from './metrics.ts';
import { retrieveKnowledge, type Document } from './knowledge.ts';
import { propose } from './model.ts';
import { reconcile } from './python.ts';
import { evaluateDecision, POLICY } from './domain/policy.ts';
import type { AnalystContext, Recommendation, Report } from './types.ts';

export const SYSTEM_POLICY = 'Use verifiable figures. State material limitations. External operational notes provide context. A promotion expansion requires comparable complete weekly subscription snapshots and at least 10% growth; allowed expansion is 10%. Otherwise hold. This is a review suggestion, never an executed action.';

export async function analyse(db: PGlite, brandId: string, marketplace = 'US', docs?: Document[]): Promise<Report> {
  const { evidence, quality } = reconcile(await getEvidence(db, brandId, marketplace));
  const context: AnalystContext = { systemPolicy: SYSTEM_POLICY, evidence, quality, documents: docs ?? await retrieveKnowledge(brandId) };

  // The provider is third-party output: it may propose, it may not authorize.
  const proposal = propose(context);
  const verdict = evaluateDecision(evidence, quality);
  const disagrees = proposal.action !== verdict.outcome || proposal.budgetChangePct !== verdict.budgetChangePct;
  const narrative = disagrees
    ? `${verdict.summary} The model provider suggested ${proposal.action.replace('_', ' ')} at ${proposal.budgetChangePct}%; only ${POLICY.budgetChangePct}% is authorized, and only on proven comparable growth.`
    : verdict.summary;

  const recommendation: Recommendation = {
    action: verdict.outcome,
    budgetChangePct: verdict.budgetChangePct,
    narrative,
    citations: evidence.currentReport ? [evidence.currentReport.publisherReportId] : [],
  };

  return {
    evidence, quality, recommendation, verdict,
    trace: {
      sql: SNAPSHOT_SQL,
      parameters: [brandId, marketplace, PERIOD_START, PREVIOUS_START],
      context, proposal,
      validation: [
        disagrees ? 'Provider proposal overridden by the policy verdict.' : 'Provider proposal agrees with the policy verdict.',
        `${verdict.violations.length} policy violation(s) recorded.`,
      ],
    },
  };
}
