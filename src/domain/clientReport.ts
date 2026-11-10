import { POLICY } from './policy.ts';
import type { DecisionVerdict, Evidence, Outcome } from '../types.ts';

export interface ReportSource {
  reportId: string;
  publisherReportId: string;
  status: string;
  periodEnd: string;
}

export interface ClientReport {
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
}

const day = (value: string | null): string => (value ? value.slice(0, 10) : 'unknown');
const number = (value: number | null): string =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US');

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
