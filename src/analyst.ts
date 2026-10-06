import type { PGlite } from '@electric-sql/pglite';
import { PERIOD_START, PREVIOUS_START } from './database.ts';
import { getEvidence, METRICS_SQL } from './metrics.ts';
import { retrieveKnowledge, type Document } from './knowledge.ts';
import { propose } from './model.ts';
import { reconcile } from './python.ts';
import type { AnalystContext, Recommendation, Report } from './types.ts';

export const SYSTEM_POLICY = 'Use verifiable figures. State material limitations. External operational notes provide context. A promotion expansion requires comparable complete weekly subscription snapshots and at least 10% growth; allowed expansion is 10%. Otherwise hold. This is a review suggestion, never an executed action.';

export async function analyse(db: PGlite, brandId: string, marketplace = 'US', docs?: Document[]): Promise<Report> {
  const { evidence, quality } = reconcile(await getEvidence(db, brandId, marketplace));
  const context: AnalystContext = { systemPolicy: SYSTEM_POLICY, evidence, quality, documents: docs ?? await retrieveKnowledge(brandId) };
  const proposal = propose(context);
  const valid = ['expand_promotion', 'hold'].includes(proposal.action) && Number.isFinite(proposal.budgetChangePct) && proposal.budgetChangePct >= 0 && proposal.budgetChangePct <= 25;
  const recommendation: Recommendation = valid ? proposal : { action: 'hold', budgetChangePct: 0, narrative: 'Unable to validate the proposed recommendation.', citations: [] };
  return { evidence, quality, recommendation, trace: { sql: METRICS_SQL, parameters: [brandId, marketplace, PERIOD_START, PREVIOUS_START], context, proposal, validation: [valid ? 'Output shape accepted.' : 'Output shape rejected.'] } };
}
