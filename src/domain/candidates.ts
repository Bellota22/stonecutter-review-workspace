import type { CandidateReport } from '../metrics.ts';

export interface CandidateView extends CandidateReport {
  verdict: 'selected' | 'rejected';
  reason: string;
  /** What the publisher export says this report totals, when the publisher published it. */
  exportTotal: number | null;
}

export interface PreviousSelection {
  total: number;
  reports: number;
  publisherIds: string[];
}

const time = (value: string): number => Date.parse(value);

/**
 * Why a candidate was not used. Ordered by the same precedence the selection applies, so the
 * explanation and the selection cannot tell different stories.
 */
/**
 * A short reason, deliberately not repeating what the table columns already show: the period column
 * carries the coverage range, so this says only why the row lost.
 */
function rejectionReason(candidate: CandidateReport, selected: CandidateReport | undefined): string {
  if (!selected) return 'no report selected for this week';
  if (candidate.status !== 'complete' && selected.status === 'complete') return 'partial week';
  if (time(candidate.periodEnd) < time(selected.periodEnd)) return 'shorter coverage';
  if (time(candidate.generatedAt) < time(selected.generatedAt)) {
    return `superseded by ${selected.publisherReportId}`;
  }
  if (candidate.publisherReportId === selected.publisherReportId) return 're-import of the same publication';
  return 'lower precedence';
}

/** Pairs every report with the outcome of the selection, the reason, and the publisher export total. */
export function explainCandidates(
  candidates: CandidateReport[],
  exportTotals: Map<string, number> = new Map(),
): CandidateView[] {
  const selected = candidates.find((candidate) => candidate.selected);
  return candidates.map((candidate) => ({
    ...candidate,
    verdict: candidate.selected ? 'selected' : 'rejected',
    reason: candidate.selected
      ? 'Selected: the publisher current report for this week.'
      : rejectionReason(candidate, selected),
    exportTotal: exportTotals.get(candidate.publisherReportId) ?? null,
  }));
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
