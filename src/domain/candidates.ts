import type { CandidateReport } from '../metrics.ts';

export interface CandidateView extends CandidateReport {
  verdict: 'selected' | 'rejected';
  reason: string;
}

export interface PreviousSelection {
  total: number;
  reports: number;
  publisherIds: string[];
}

const time = (value: string): number => Date.parse(value);
const day = (value: string): string => value.slice(0, 10);

/**
 * Why a candidate was not used. Ordered by the same precedence the selection applies, so the
 * explanation and the selection cannot tell different stories.
 */
function rejectionReason(candidate: CandidateReport, selected: CandidateReport | undefined): string {
  if (!selected) return 'Rejected: no report could be selected for this week.';
  if (candidate.status !== 'complete' && selected.status === 'complete') {
    return `Rejected: ${candidate.status} coverage, while the selected report covers the full week.`;
  }
  if (time(candidate.periodEnd) < time(selected.periodEnd)) {
    return `Rejected: coverage ends ${day(candidate.periodEnd)}, the selected report ends ${day(selected.periodEnd)}.`;
  }
  if (time(candidate.generatedAt) < time(selected.generatedAt)) {
    return `Rejected: superseded. The publisher issued ${selected.publisherReportId} on ${day(selected.generatedAt)}.`;
  }
  if (candidate.publisherReportId === selected.publisherReportId) {
    return `Rejected: re-import of ${candidate.publisherReportId}, which is already selected.`;
  }
  return 'Rejected: a higher-precedence report is selected for this week.';
}

/** Pairs every report with the outcome of the selection and the reason behind it. */
export function explainCandidates(candidates: CandidateReport[]): CandidateView[] {
  const selected = candidates.find((candidate) => candidate.selected);
  return candidates.map((candidate) =>
    candidate.selected
      ? { ...candidate, verdict: 'selected', reason: 'Selected: the publisher current report for this week.' }
      : { ...candidate, verdict: 'rejected', reason: rejectionReason(candidate, selected) },
  );
}

/**
 * What the previous selection counted: every report tied at the highest status was added together.
 * Kept as a diagnostic only, so a reviewer can see the size of the discrepancy being corrected.
 */
export function previousSelection(candidates: CandidateReport[]): PreviousSelection {
  const complete = candidates.filter((candidate) => candidate.status === 'complete');
  const counted =
    complete.length > 0 ? complete : candidates.filter((candidate) => candidate.status === 'partial');
  return {
    total: counted.reduce((sum, candidate) => sum + candidate.loadedSubscriptions, 0),
    reports: counted.length,
    publisherIds: counted.map((candidate) => candidate.publisherReportId),
  };
}
