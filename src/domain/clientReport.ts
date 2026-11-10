import { POLICY } from './policy.ts';
import type { DecisionVerdict, Evidence, Outcome } from '../types.ts';

export interface ReportSource {
  reportId: string;
  publisherReportId: string;
  status: string;
  periodEnd: string;
}

export interface ClientReport {
  /** True when no decision is recorded yet: the report shows what it would say if the suggested outcome were saved. */
  draft: boolean;
  client: string;
  marketplace: string;
  period: { start: string; end: string };
  decision: { outcome: Outcome; budgetChangePct: number; reason: string; decidedAt: string };
  supportedResult: { label: string; value: string; note: string }[];
  limitations: string[];
  nextStep: string;
  sources: ReportSource[];
}

export interface ReportInput {
  client: string;
  marketplace: string;
  period: { start: string; end: string };
  decision: { outcome: Outcome; budgetChangePct: number; reason: string; decidedAt: string };
  evidence: Evidence;
  verdict: DecisionVerdict;
  limitations: string[];
  sources: ReportSource[];
  draft?: boolean;
}

const day = (value: string | null): string => (value ? value.slice(0, 10) : 'unknown');
const number = (value: number | null): string =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US');

/**
 * The outcome in one sentence a person can act on. Built from the failing check, so the headline and
 * the evidence cannot disagree.
 */
export function verdictHeadline(evidence: Evidence, verdict: DecisionVerdict): string {
  if (verdict.outcome === 'expand_promotion') {
    return `${evidence.growthPct}% growth is verified: a ${verdict.budgetChangePct}% expansion is authorized.`;
  }
  const failing = (code: string): boolean =>
    (evidence.checks ?? []).some((check) => check.code === code && !check.ok);
  if (failing('current_complete')) {
    return `This week is only published through ${day(evidence.currentReport?.periodEnd ?? null)}, not the full week.`;
  }
  if (failing('previous_complete')) {
    return `The previous week is incomplete, so there is nothing comparable to grow from.`;
  }
  if (failing('current_reconciled') || failing('previous_reconciled')) {
    const report = evidence.currentReport;
    const loaded = failing('current_reconciled')
      ? report?.loadedOffers
      : evidence.previousReport?.loadedOffers;
    const declared = failing('current_reconciled')
      ? report?.declaredOfferCount
      : evidence.previousReport?.declaredOfferCount;
    return `Only ${loaded} of ${declared} offers were imported: the comparison cannot be trusted.`;
  }
  if (failing('import_fresh')) return 'The latest import is stale, so this week cannot be reported yet.';
  if (failing('baseline_available')) return 'There is no previous week to compare against.';
  if (evidence.growthPct !== null) {
    return `${evidence.growthPct}% growth is below the ${POLICY.minimumGrowthPct}% needed to expand.`;
  }
  return 'The evidence does not support a growth claim for this week.';
}

/** The next action, derived from the evidence that is missing rather than from a template. */
export function nextStep(evidence: Evidence, verdict: DecisionVerdict): string {
  if (verdict.outcome === 'expand_promotion') {
    return `Share the verified result and propose a ${POLICY.budgetChangePct}% expansion as a draft for the brand manager.`;
  }
  const failing = (code: string): boolean =>
    (evidence.checks ?? []).some((check) => check.code === code && !check.ok);
  if (failing('current_complete')) {
    return `Request the complete publisher report for the week ending ${day(evidence.expectedPeriodEnd)} before restating week-over-week growth.`;
  }
  if (failing('current_reconciled') || failing('previous_reconciled')) {
    return 'Re-import the affected publisher report: the offers we hold do not match the publisher header.';
  }
  if (evidence.growthPct !== null) {
    return `Keep the current promotion and report the verified ${evidence.growthPct}% change.`;
  }
  return 'Keep the current promotion until a comparable weekly snapshot is available.';
}

/** The client report is derived from the stored decision and the evidence it was taken on. */
export function buildClientReport(input: ReportInput): ClientReport {
  const { evidence } = input;
  return {
    draft: input.draft ?? false,
    client: input.client,
    marketplace: input.marketplace,
    period: input.period,
    decision: input.decision,
    supportedResult: [
      {
        label: 'Active subscriptions',
        value: number(evidence.activeSubscriptions),
        note: evidence.currentReport
          ? `${evidence.currentReport.status === 'complete' ? 'complete week' : 'partial coverage'} through ${day(evidence.currentReport.periodEnd)}`
          : 'no report selected',
      },
      {
        label: 'Previous week',
        value: number(evidence.previousSubscriptions),
        note: evidence.previousReport
          ? `through ${day(evidence.previousReport.periodEnd)}`
          : 'no report selected',
      },
      {
        label: 'Week-over-week change',
        value: evidence.growthPct === null ? 'Not comparable' : `${evidence.growthPct}%`,
        note:
          evidence.growthPct === null
            ? 'the two weeks cannot be compared'
            : `policy needs ${POLICY.minimumGrowthPct}%`,
      },
    ],
    limitations: input.limitations,
    nextStep: nextStep(evidence, input.verdict),
    sources: input.sources,
  };
}
