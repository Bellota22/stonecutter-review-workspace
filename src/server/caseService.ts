import type { PGlite } from '@electric-sql/pglite';
import { PERIOD_END, PERIOD_START, rebuildMetrics } from '../database.ts';
import { getEvidence, listCandidates, type CandidateReport } from '../metrics.ts';
import { reconcile } from '../python.ts';
import { POLICY, evaluateDecision, evidenceFingerprint } from '../domain/policy.ts';
import type { DecisionVerdict, Evidence, Quality } from '../types.ts';
import {
  appendDecision, appendEvent, ensureCase, latestDecision, setCaseStatus,
  type CaseRow, type DecisionRow, type Scope,
} from './reviewStore.ts';

/** The evidence does not authorize the decision that was requested. */
export class PolicyViolation extends Error {
  constructor(readonly violations: string[]) {
    super('The evidence does not support this decision.');
    this.name = 'PolicyViolation';
  }
}

export class ValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(' '));
    this.name = 'ValidationError';
  }
}

export interface CandidateView extends CandidateReport {
  verdict: 'selected' | 'rejected';
  reason: string;
}

export interface Counterfactual {
  total: number;
  reports: number;
  publisherIds: string[];
}

export interface CaseView {
  caseId: string;
  status: CaseRow['status'];
  createdAt: string;
  updatedAt: string;
  scope: { brandId: string; brandName: string; marketplace: string; periodStart: string; expectedPeriodEnd: string };
  evidence: Evidence;
  quality: Quality;
  verdict: DecisionVerdict;
  fingerprint: string;
  candidates: CandidateView[];
  counterfactual: Counterfactual | null;
  decision: DecisionRow | null;
  attention: { changes: string[] } | null;
}

const time = (value: string) => Date.parse(value);
const day = (value: string | null) => (value ? value.slice(0, 10) : 'unknown');

/** Why the pipeline did not use this report. Ordered by the same precedence the selection uses. */
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

export function explainCandidates(candidates: CandidateReport[]): CandidateView[] {
  const selected = candidates.find(c => c.selected);
  return candidates.map(candidate => candidate.selected
    ? { ...candidate, verdict: 'selected', reason: 'Selected: the publisher current report for this week.' }
    : { ...candidate, verdict: 'rejected', reason: rejectionReason(candidate, selected) });
}

/**
 * What the previous selection counted: every report tied at the highest status was added together.
 * Kept as a diagnostic only, so a reviewer can see the size of the discrepancy being corrected.
 */
function counterfactual(candidates: CandidateReport[]): Counterfactual {
  const complete = candidates.filter(c => c.status === 'complete');
  const counted = complete.length ? complete : candidates.filter(c => c.status === 'partial');
  return {
    total: counted.reduce((sum, c) => sum + c.loadedSubscriptions, 0),
    reports: counted.length,
    publisherIds: counted.map(c => c.publisherReportId),
  };
}

function material(evidence: Evidence) {
  const report = (value: Evidence['currentReport']) => value && {
    publisher: value.publisherReportId, status: value.status, coverage: day(value.periodEnd),
    subscriptions: value.loadedSubscriptions, declared: value.declaredSubscriptions,
    offers: `${value.loadedOffers}/${value.declaredOfferCount}`,
  };
  return {
    activeSubscriptions: evidence.activeSubscriptions,
    previousSubscriptions: evidence.previousSubscriptions,
    current: report(evidence.currentReport),
    previous: report(evidence.previousReport),
  };
}

/** What changed between the evidence a decision was taken on and the evidence now. */
export function compareEvidence(stored: Record<string, unknown>, current: Evidence): string[] {
  const before = stored as ReturnType<typeof material>;
  const after = material(current);
  const changes: string[] = [];
  const push = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(`${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  };
  push('Current week snapshot', before.current, after.current);
  push('Previous week snapshot', before.previous, after.previous);
  push('Active subscriptions', before.activeSubscriptions, after.activeSubscriptions);
  push('Previous subscriptions', before.previousSubscriptions, after.previousSubscriptions);
  return changes.length ? changes : ['The evidence changed without a difference in the recorded fields.'];
}

export async function openCase(db: PGlite, brandId: string, marketplace: string): Promise<CaseView> {
  await rebuildMetrics(db);
  const raw = await getEvidence(db, brandId, marketplace);
  const { evidence, quality } = reconcile(raw);
  const verdict = evaluateDecision(evidence, quality);
  const fingerprint = evidenceFingerprint(evidence);

  const scope: Scope = { brandId, marketplace, periodStart: PERIOD_START };
  let row = await ensureCase(db, scope);
  const candidates = explainCandidates(await listCandidates(db, brandId, marketplace, PERIOD_START));
  const decision = await latestDecision(db, row.caseId);

  let attention: CaseView['attention'] = null;
  if (decision && decision.evidenceFingerprint !== fingerprint) {
    attention = { changes: compareEvidence(decision.evidence, evidence) };
    if (row.status !== 'needs_attention') {
      await setCaseStatus(db, row.caseId, 'needs_attention');
      await appendEvent(db, row.caseId, 'evidence_changed', { changes: attention.changes });
      row = { ...row, status: 'needs_attention' };
    }
  } else if (decision && row.status === 'needs_attention') {
    await setCaseStatus(db, row.caseId, 'decided');
    row = { ...row, status: 'decided' };
  }

  return {
    caseId: row.caseId, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt,
    scope: { brandId, brandName: evidence.brandName, marketplace, periodStart: PERIOD_START, expectedPeriodEnd: PERIOD_END },
    evidence, quality, verdict, fingerprint, candidates, decision, attention,
    counterfactual: (() => {
      const counted = counterfactual(candidates);
      return counted.total === evidence.activeSubscriptions ? null : counted;
    })(),
  };
}

export async function saveDecision(db: PGlite, brandId: string, marketplace: string, input: {
  outcome: 'expand_promotion' | 'hold'; reason: string;
}): Promise<{ decision: DecisionRow; view: CaseView }> {
  const view = await openCase(db, brandId, marketplace);
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new ValidationError(['A reason of at least 10 characters is required.']);

  if (input.outcome === 'expand_promotion' && view.verdict.outcome !== 'expand_promotion') {
    throw new PolicyViolation(view.verdict.violations.length
      ? view.verdict.violations
      : ['The evidence does not support an expansion.']);
  }

  const budgetChangePct = input.outcome === 'expand_promotion' ? POLICY.budgetChangePct : 0;
  const decision = await appendDecision(db, {
    caseId: view.caseId, outcome: input.outcome, budgetChangePct, reason,
    limitations: view.verdict.violations,
    calculation: {
      activeSubscriptions: view.evidence.activeSubscriptions,
      previousSubscriptions: view.evidence.previousSubscriptions,
      growthPct: view.evidence.growthPct,
      minimumGrowthPct: POLICY.minimumGrowthPct,
      checks: view.evidence.checks ?? [],
    },
    sources: [view.evidence.currentReport, view.evidence.previousReport]
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map(r => ({ reportId: r.reportId, publisherReportId: r.publisherReportId, status: r.status, periodEnd: day(r.periodEnd) })),
    evidence: material(view.evidence) as Record<string, unknown>,
    evidenceFingerprint: view.fingerprint,
  });
  await setCaseStatus(db, view.caseId, 'decided');
  await appendEvent(db, view.caseId, 'decision_saved', {
    version: decision.version, outcome: decision.outcome, budgetChangePct, fingerprints: view.fingerprint,
  });
  return { decision, view: await openCase(db, brandId, marketplace) };
}

export interface ClientReport {
  client: string;
  marketplace: string;
  period: { start: string; end: string };
  decision: { outcome: string; budgetChangePct: number; reason: string; decidedAt: string }; 
  supportedResult: { label: string; value: string; note: string }[];
  limitations: string[];
  nextStep: string;
  sources: DecisionRow['sources'];
}

function nextStep(evidence: Evidence, verdict: DecisionVerdict): string {
  if (verdict.outcome === 'expand_promotion') {
    return `Share the verified result and propose a ${POLICY.budgetChangePct}% expansion as a draft for the brand manager.`;
  }
  const checks = evidence.checks ?? [];
  const failing = (code: string) => checks.some(c => c.code === code && !c.ok);
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

export type ReportResult =
  | { kind: 'ready'; report: ClientReport }
  | { kind: 'requires_attention'; changes: string[] }
  | { kind: 'no_decision' }
  | { kind: 'policy_changed'; violations: string[] };

/** The client report is always derived from the stored decision and the evidence it was taken on. */
export async function generateReport(db: PGlite, brandId: string, marketplace: string): Promise<ReportResult> {
  const view = await openCase(db, brandId, marketplace);
  if (!view.decision) return { kind: 'no_decision' };
  if (view.attention) return { kind: 'requires_attention', changes: view.attention.changes };
  if (view.decision.outcome === 'expand_promotion' && view.verdict.outcome !== 'expand_promotion') {
    return { kind: 'policy_changed', violations: view.verdict.violations };
  }

  const evidence = view.evidence;
  const report: ClientReport = {
    client: view.scope.brandName,
    marketplace: view.scope.marketplace,
    period: { start: PERIOD_START, end: PERIOD_END },
    decision: {
      outcome: view.decision.outcome, budgetChangePct: view.decision.budgetChangePct,
      reason: view.decision.reason, decidedAt: view.decision.createdAt,
    },
    supportedResult: [
      {
        label: 'Active subscriptions',
        value: evidence.activeSubscriptions?.toLocaleString('en-US') ?? 'Unavailable',
        note: evidence.currentReport
          ? `${evidence.currentReport.status === 'complete' ? 'complete week' : 'partial coverage'} through ${day(evidence.currentReport.periodEnd)}`
          : 'no report selected',
      },
      {
        label: 'Previous week',
        value: evidence.previousSubscriptions?.toLocaleString('en-US') ?? 'Unavailable',
        note: evidence.previousReport ? `through ${day(evidence.previousReport.periodEnd)}` : 'no report selected',
      },
      {
        label: 'Week-over-week change',
        value: evidence.growthPct === null ? 'Not comparable' : `${evidence.growthPct}%`,
        note: evidence.growthPct === null ? 'the two weeks cannot be compared' : `policy needs ${POLICY.minimumGrowthPct}%`,
      },
    ],
    limitations: view.decision.limitations,
    nextStep: nextStep(evidence, view.verdict),
    sources: view.decision.sources,
  };
  await appendEvent(db, view.caseId, 'report_generated', { fingerprint: view.fingerprint });
  return { kind: 'ready', report };
}
