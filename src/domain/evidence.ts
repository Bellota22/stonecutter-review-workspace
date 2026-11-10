import type { Evidence } from '../types.ts';

/** The part of the evidence a recorded decision is pinned to. */
export interface EvidenceMaterial {
  activeSubscriptions: number | null;
  previousSubscriptions: number | null;
  current: ReportMaterial | null;
  previous: ReportMaterial | null;
}

interface ReportMaterial {
  publisher: string;
  status: string;
  coverage: string;
  subscriptions: number;
  declared: number;
  offers: string;
}

export function material(evidence: Evidence): EvidenceMaterial {
  return {
    activeSubscriptions: evidence.activeSubscriptions,
    previousSubscriptions: evidence.previousSubscriptions,
    current: reportMaterial(evidence.currentReport),
    previous: reportMaterial(evidence.previousReport),
  };
}

function reportMaterial(report: Evidence['currentReport']): ReportMaterial | null {
  if (!report) return null;
  return {
    publisher: report.publisherReportId,
    status: report.status,
    coverage: report.periodEnd.slice(0, 10),
    subscriptions: report.loadedSubscriptions,
    declared: report.declaredSubscriptions,
    offers: `${report.loadedOffers}/${report.declaredOfferCount}`,
  };
}

/** What changed between the evidence a decision was taken on and the evidence now. */
export function compareEvidence(stored: EvidenceMaterial, current: Evidence): string[] {
  const now = material(current);
  const changes: string[] = [];
  const push = (label: string, before: unknown, after: unknown): void => {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`${label}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  };
  push('Current week snapshot', stored.current, now.current);
  push('Previous week snapshot', stored.previous, now.previous);
  push('Active subscriptions', stored.activeSubscriptions, now.activeSubscriptions);
  push('Previous subscriptions', stored.previousSubscriptions, now.previousSubscriptions);
  return changes.length > 0
    ? changes
    : ['The evidence changed without a difference in the recorded fields.'];
}
