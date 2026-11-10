import type { Document } from './knowledge.ts';
import type { CaseStatus, Outcome } from './domain/vocabulary.ts';

export type { CaseStatus, Outcome };

/** One selected weekly report plus the publisher control totals used to verify what we ingested. */
export interface SourceReport {
  reportId: string;
  publisherReportId: string;
  status: 'complete' | 'partial' | string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  extractedAt: string;
  declaredOfferCount: number;
  declaredSubscriptions: number;
  loadedOffers: number;
  loadedSubscriptions: number;
}

/** One row of the publisher's own export: the source of record for a published report. */
export interface PublisherExport {
  publisherReportId: string;
  brandId: string;
  marketplace: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  supersededBy: string;
  declaredSubscriptions: number;
  totalSubscriptions: number;
}

/** A named, human-readable evidence check. The decision policy reads these, the interface shows them. */
export interface EvidenceCheck {
  code:
    | 'import_fresh'
    | 'current_complete'
    | 'previous_complete'
    | 'current_reconciled'
    | 'previous_reconciled'
    | 'current_matches_export'
    | 'previous_matches_export'
    | 'baseline_available';
  ok: boolean;
  detail: string;
}

export interface Evidence {
  brandId: string;
  brandName: string;
  marketplace: string;
  periodStart: string;
  expectedPeriodEnd: string;
  asOf: string;
  activeSubscriptions: number | null;
  previousSubscriptions: number | null;
  growthPct: number | null;
  sourcePeriodEnd: string | null;
  sourceComplete: boolean;
  sourceReports: string[];
  ingestedAt: string | null;
  previousSourceComplete: boolean;
  previousSourcePeriodEnd: string | null;
  netSales: number;
  adSpend: number;
  attributedAdSales: number;
  roas: number | null;
  inventoryUnits: number;
  sourceSnapshots: { reportId: string; activeSubscriptions: number }[];
  sourceTotal?: number;
  reconciliationDelta?: number | null;
  currentReport: SourceReport | null;
  previousReport: SourceReport | null;
  currentExport: PublisherExport | null;
  previousExport: PublisherExport | null;
  checks?: EvidenceCheck[];
}
export interface Quality {
  status: 'ready' | 'insufficient';
  reasons: string[];
}
/** Outcome the policy allows for the evidence. The model proposes; the policy decides. */
export interface DecisionVerdict {
  outcome: Outcome;
  budgetChangePct: number;
  violations: string[];
  summary: string;
}
export interface Recommendation {
  action: Outcome;
  budgetChangePct: number;
  narrative: string;
  citations: string[];
}
export interface AnalystContext {
  systemPolicy: string;
  evidence: Evidence;
  quality: Quality;
  documents: Document[];
}
export interface Report {
  evidence: Evidence;
  quality: Quality;
  recommendation: Recommendation;
  verdict: DecisionVerdict;
  trace: {
    sql: string;
    parameters: string[];
    context: AnalystContext;
    proposal: Recommendation;
    validation: string[];
  };
}

/** The calculation and checks stored with a decision, so the report can be explained later. */
export interface DecisionCalculation {
  activeSubscriptions: number | null;
  previousSubscriptions: number | null;
  growthPct: number | null;
  minimumGrowthPct: number;
  checks: EvidenceCheck[];
}
