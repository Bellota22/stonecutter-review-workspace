import type { PGlite } from '@electric-sql/pglite';
import { PERIOD_END, PERIOD_START, rebuildMetrics } from '../database.ts';
import { getEvidence, listCandidates } from '../metrics.ts';
import { reconcile } from '../python.ts';
import { POLICY, evaluateDecision, evidenceFingerprint } from '../domain/policy.ts';
import {
  explainCandidates,
  previousSelection,
  type CandidateView,
  type PreviousSelection,
} from '../domain/candidates.ts';
import { compareEvidence, material } from '../domain/evidence.ts';
import { buildClientReport, type ClientReport, type ReportSource } from '../domain/clientReport.ts';
import type { CaseStatus, DecisionVerdict, Evidence, Quality } from '../types.ts';
import {
  appendDecision,
  appendEvent,
  ensureCase,
  latestDecision,
  setCaseStatus,
  type CaseRow,
  type DecisionRow,
  type Scope,
} from './reviewStore.ts';

export type FailureCode = 'policy_violation' | 'invalid_request' | 'no_decision';

/** An expected failure with a stable code, so the API can map it to a status without guessing. */
export class CaseError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'CaseError';
  }
}

/** The evidence does not authorize the decision that was requested. */
export class PolicyViolation extends CaseError {
  constructor(violations: string[]) {
    super('policy_violation', 'The evidence does not support this decision.', violations);
    this.name = 'PolicyViolation';
  }

  get violations(): string[] {
    return this.details;
  }
}

export class ValidationError extends CaseError {
  constructor(problems: string[]) {
    super('invalid_request', problems.join(' '), problems);
    this.name = 'ValidationError';
  }

  get problems(): string[] {
    return this.details;
  }
}

export interface CaseView {
  caseId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  scope: {
    brandId: string;
    brandName: string;
    marketplace: string;
    periodStart: string;
    expectedPeriodEnd: string;
  };
  evidence: Evidence;
  quality: Quality;
  verdict: DecisionVerdict;
  fingerprint: string;
  candidates: CandidateView[];
  previousSelection: PreviousSelection | null;
  decision: DecisionRow | null;
  attention: { changes: string[] } | null;
}

export type ReportResult =
  | { kind: 'ready'; report: ClientReport }
  | { kind: 'requires_attention'; changes: string[] }
  | { kind: 'no_decision' }
  | { kind: 'policy_changed'; violations: string[] };

const day = (value: string | null): string => (value ? value.slice(0, 10) : 'unknown');

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
  const counted = previousSelection(candidates);

  const attention = await reconcileAttention(db, row, decision, evidence, fingerprint);
  row = attention.row;

  return {
    caseId: row.caseId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scope: {
      brandId,
      brandName: evidence.brandName,
      marketplace,
      periodStart: PERIOD_START,
      expectedPeriodEnd: PERIOD_END,
    },
    evidence,
    quality,
    verdict,
    fingerprint,
    candidates,
    decision,
    attention: attention.changes ? { changes: attention.changes } : null,
    previousSelection: counted.total === evidence.activeSubscriptions ? null : counted,
  };
}

/**
 * A decision is only valid for the evidence it was taken on. When that evidence moved, the case is
 * marked as requiring attention instead of silently keeping the old approval; when it moves back,
 * the mark is removed.
 */
async function reconcileAttention(
  db: PGlite,
  row: CaseRow,
  decision: DecisionRow | null,
  evidence: Evidence,
  fingerprint: string,
): Promise<{ row: CaseRow; changes: string[] | null }> {
  if (!decision) return { row, changes: null };

  if (decision.evidenceFingerprint !== fingerprint) {
    const changes = compareEvidence(decision.evidence, evidence);
    if (row.status === 'needs_attention') return { row, changes };
    await setCaseStatus(db, row.caseId, 'needs_attention');
    await appendEvent(db, row.caseId, 'evidence_changed', { changes });
    return { row: { ...row, status: 'needs_attention' }, changes };
  }

  if (row.status === 'needs_attention') {
    await setCaseStatus(db, row.caseId, 'decided');
    return { row: { ...row, status: 'decided' }, changes: null };
  }
  return { row, changes: null };
}

export async function saveDecision(
  db: PGlite,
  brandId: string,
  marketplace: string,
  input: {
    outcome: DecisionVerdict['outcome'];
    reason: string;
  },
): Promise<{ decision: DecisionRow; view: CaseView }> {
  const view = await openCase(db, brandId, marketplace);
  const reason = input.reason.trim();
  if (reason.length < POLICY.minimumReasonCharacters) {
    throw new ValidationError([
      `A reason of at least ${POLICY.minimumReasonCharacters} characters is required.`,
    ]);
  }
  if (input.outcome === 'expand_promotion' && view.verdict.outcome !== 'expand_promotion') {
    throw new PolicyViolation(
      view.verdict.violations.length > 0
        ? view.verdict.violations
        : ['The evidence does not support an expansion.'],
    );
  }

  const decision = await appendDecision(db, {
    caseId: view.caseId,
    outcome: input.outcome,
    budgetChangePct: input.outcome === 'expand_promotion' ? POLICY.budgetChangePct : 0,
    reason,
    limitations: view.verdict.violations,
    calculation: {
      activeSubscriptions: view.evidence.activeSubscriptions,
      previousSubscriptions: view.evidence.previousSubscriptions,
      growthPct: view.evidence.growthPct,
      minimumGrowthPct: POLICY.minimumGrowthPct,
      checks: view.evidence.checks ?? [],
    },
    sources: sourcesOf(view.evidence),
    evidence: material(view.evidence),
    evidenceFingerprint: view.fingerprint,
  });

  await setCaseStatus(db, view.caseId, 'decided');
  await appendEvent(db, view.caseId, 'decision_saved', {
    version: decision.version,
    outcome: decision.outcome,
    budgetChangePct: decision.budgetChangePct,
    fingerprint: view.fingerprint,
  });
  return { decision, view: await openCase(db, brandId, marketplace) };
}

function sourcesOf(evidence: Evidence): ReportSource[] {
  return [evidence.currentReport, evidence.previousReport]
    .filter((report): report is NonNullable<typeof report> => report !== null)
    .map((report) => ({
      reportId: report.reportId,
      publisherReportId: report.publisherReportId,
      status: report.status,
      periodEnd: day(report.periodEnd),
    }));
}

/**
 * What the client report is right now, given the case. Pure: it never writes, so a page can render
 * the report as part of the case instead of asking the user to press a button to see their outcome.
 */
export function reportFor(view: CaseView): ReportResult {
  if (!view.decision) return { kind: 'no_decision' };
  if (view.attention) return { kind: 'requires_attention', changes: view.attention.changes };
  if (view.decision.outcome === 'expand_promotion' && view.verdict.outcome !== 'expand_promotion') {
    return { kind: 'policy_changed', violations: view.verdict.violations };
  }

  const report = buildClientReport({
    client: view.scope.brandName,
    marketplace: view.scope.marketplace,
    period: { start: PERIOD_START, end: PERIOD_END },
    decision: {
      outcome: view.decision.outcome,
      budgetChangePct: view.decision.budgetChangePct,
      reason: view.decision.reason,
      decidedAt: view.decision.createdAt,
    },
    evidence: view.evidence,
    verdict: view.verdict,
    limitations: view.decision.limitations,
    sources: view.decision.sources,
  });
  return { kind: 'ready', report };
}

/** Records that the report was produced, then returns it. */
export async function generateReport(
  db: PGlite,
  brandId: string,
  marketplace: string,
): Promise<ReportResult> {
  const view = await openCase(db, brandId, marketplace);
  const result = reportFor(view);
  if (result.kind === 'ready') {
    await appendEvent(db, view.caseId, 'report_generated', { fingerprint: view.fingerprint });
  }
  return result;
}
