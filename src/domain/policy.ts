import { createHash } from 'node:crypto';
import type { DecisionVerdict, Evidence, Quality } from '../types.ts';

/**
 * Authorized application behavior. The model provider proposes; this policy decides.
 * See DATA_DICTIONARY.md "Reporting and recommendation policy".
 */
export const POLICY = {
  minimumGrowthPct: 10,
  budgetChangePct: 10,
  freshnessHours: 48,
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
    violations.push(`Complete comparable growth of ${growth}% is below the ${POLICY.minimumGrowthPct}% required to expand.`);
  }

  const expand = violations.length === 0;
  return {
    outcome: expand ? 'expand_promotion' : 'hold',
    budgetChangePct: expand ? POLICY.budgetChangePct : 0,
    violations,
    summary: expand
      ? `Complete, comparable growth of ${growth}% supports a ${POLICY.budgetChangePct}% promotion expansion suggestion.`
      : 'Hold the promotion until complete, verified and comparable weekly snapshots support a growth claim.',
  };
}

/** Material identity of the evidence a decision was taken on; a change here invalidates that decision. */
export function evidenceFingerprint(evidence: Evidence): string {
  const report = (value: Evidence['currentReport']) => value && {
    reportId: value.reportId, publisherReportId: value.publisherReportId, status: value.status,
    periodEnd: value.periodEnd, declaredOffers: value.declaredOfferCount, loadedOffers: value.loadedOffers,
    declaredSubscriptions: value.declaredSubscriptions, loadedSubscriptions: value.loadedSubscriptions,
  };
  const material = {
    brandId: evidence.brandId, marketplace: evidence.marketplace,
    periodStart: evidence.periodStart, expectedPeriodEnd: evidence.expectedPeriodEnd,
    current: report(evidence.currentReport), previous: report(evidence.previousReport),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}
