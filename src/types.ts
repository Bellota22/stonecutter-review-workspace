import type { Document } from './knowledge.ts';

export interface Evidence {
  brandId: string; brandName: string; marketplace: string;
  periodStart: string; expectedPeriodEnd: string; asOf: string;
  activeSubscriptions: number | null; previousSubscriptions: number | null;
  growthPct: number | null; sourcePeriodEnd: string | null;
  sourceComplete: boolean; sourceReports: string[]; ingestedAt: string | null;
  previousSourceComplete: boolean; previousSourcePeriodEnd: string | null;
  netSales: number; adSpend: number; attributedAdSales: number; roas: number | null;
  inventoryUnits: number;
  sourceSnapshots: { reportId: string; activeSubscriptions: number }[];
  sourceTotal?: number; reconciliationDelta?: number | null;
}
export interface Quality { status: 'ready' | 'insufficient'; reasons: string[] }
export interface Recommendation {
  action: 'expand_promotion' | 'hold'; budgetChangePct: number;
  narrative: string; citations: string[];
}
export interface AnalystContext {
  systemPolicy: string; evidence: Evidence; quality: Quality; documents: Document[];
}
export interface Report {
  evidence: Evidence; quality: Quality; recommendation: Recommendation;
  trace: { sql: string; parameters: string[]; context: AnalystContext; proposal: Recommendation; validation: string[] };
}
