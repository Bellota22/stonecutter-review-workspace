import { createHash } from 'node:crypto';
import type { DecisionVerdict, Evidence, Outcome, Quality } from '../types.ts';

/**
 * Authorized application behavior. The model provider proposes; this policy decides.
 * See DATA_DICTIONARY.md "Reporting and recommendation policy".
 */
export const POLICY = {
  minimumGrowthPct: 10,
  budgetChangePct: 10,
  freshnessHours: 48,
  minimumReasonCharacters: 10,
} as const;

/**
 * Turns evidence fitness into the only two outcomes the workflow may record.
 * Every refusal names the evidence that is missing, so the interface can explain it.
 */
export function evaluateDecision(evidence: Evidence, quality: Quality): DecisionVerdict {
  const violations: string[] = [];
  const growth = evidence.growthPct;

  if (quality.status !== 'ready') violations.push(...quality.reasons);
  if (growth === null) {
    violations.push('Weekly growth is not comparable for this scope, so no expansion can be supported.');
  } else if (growth < POLICY.minimumGrowthPct) {
    violations.push(
      `Complete comparable growth of ${growth}% is below the ${POLICY.minimumGrowthPct}% required to expand.`,
    );
  }

  const outcome: Outcome = violations.length === 0 ? 'expand_promotion' : 'hold';
  return {
    outcome,
    budgetChangePct: outcome === 'expand_promotion' ? POLICY.budgetChangePct : 0,
    violations,
    summary: outcome === 'expand_promotion'
      ? `Complete, comparable growth of ${growth}% supports a ${POLICY.budgetChangePct}% promotion expansion suggestion.`
      : 'Hold the promotion until complete, verified and comparable weekly snapshots support a growth claim.',
  };
}

/** Material identity of the evidence a decision was taken on; a change here invalidates that decision. */
export function evidenceFingerprint(evidence: Evidence): string {
  const material = {
    brandId: evidence.brandId,
    marketplace: evidence.marketplace,
    periodStart: evidence.periodStart,
    expectedPeriodEnd: evidence.expectedPeriodEnd,
    current: sourceIdentity(evidence.currentReport),
    previous: sourceIdentity(evidence.previousReport),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function sourceIdentity(report: Evidence['currentReport']) {
  if (!report) return null;
  return {
    reportId: report.reportId,
    publisherReportId: report.publisherReportId,
    status: report.status,
    periodEnd: report.periodEnd,
    declaredOffers: report.declaredOfferCount,
    loadedOffers: report.loadedOffers,
    declaredSubscriptions: report.declaredSubscriptions,
    loadedSubscriptions: report.loadedSubscriptions,
  };
}
