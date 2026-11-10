import type { PGlite } from '@electric-sql/pglite';
import { queryRows } from '../database.ts';
import type { ReportSource } from '../domain/clientReport.ts';
import type { EvidenceMaterial } from '../domain/evidence.ts';
import type { CaseStatus, DecisionCalculation, Outcome } from '../types.ts';

export interface Scope {
  brandId: string;
  marketplace: string;
  periodStart: string;
}

export interface CaseRow {
  caseId: string;
  brandId: string;
  marketplace: string;
  periodStart: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRow {
  decisionId: string;
  caseId: string;
  version: number;
  outcome: Outcome;
  budgetChangePct: number;
  reason: string;
  limitations: string[];
  calculation: DecisionCalculation;
  sources: ReportSource[];
  evidence: EvidenceMaterial;
  evidenceFingerprint: string;
  createdAt: string;
}

export interface CaseState {
  brandId: string;
  marketplace: string;
  status: CaseStatus;
  outcome: Outcome | null;
}

const CASE_COLUMNS = `case_id AS "caseId", brand_id AS "brandId", marketplace,
  period_start::text AS "periodStart", status, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;

const DECISION_COLUMNS = `decision_id AS "decisionId", case_id AS "caseId", version, outcome,
  budget_change_pct AS "budgetChangePct", reason, limitations, calculation, sources, evidence,
  evidence_fingerprint AS "evidenceFingerprint", created_at::text AS "createdAt"`;

export function caseIdFor(scope: Scope): string {
  return `case:${scope.brandId}:${scope.marketplace}:${scope.periodStart}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function isReportSource(value: unknown): value is ReportSource {
  return (
    isRecord(value) &&
    typeof value.reportId === 'string' &&
    typeof value.publisherReportId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.periodEnd === 'string'
  );
}

/** jsonb comes back untyped; narrow it once, here, instead of trusting it downstream. */
function toDecisionRow(row: DecisionRow): DecisionRow {
  const sources = Array.isArray(row.sources) ? row.sources.filter(isReportSource) : [];
  return {
    ...row,
    limitations: strings(row.limitations),
    sources,
    calculation: row.calculation,
    evidence: row.evidence,
  };
}

/** Opening a case is idempotent: the scope and week identify it, so a restart reopens the same case. */
export async function ensureCase(db: PGlite, scope: Scope): Promise<CaseRow> {
  const [created] = await queryRows<CaseRow>(
    db,
    `
    INSERT INTO review.review_case (case_id, brand_id, marketplace, period_start)
    VALUES ($1, $2, $3, $4::date)
    ON CONFLICT (brand_id, marketplace, period_start) DO NOTHING
    RETURNING ${CASE_COLUMNS}`,
    [caseIdFor(scope), scope.brandId, scope.marketplace, scope.periodStart],
  );
  if (created) {
    await appendEvent(db, created.caseId, 'case_opened', { scope });
    return created;
  }
  const existing = await findCase(db, scope);
  if (!existing) throw new Error(`The review case for ${caseIdFor(scope)} could not be created or reopened.`);
  return existing;
}

export async function findCase(db: PGlite, scope: Scope): Promise<CaseRow | null> {
  const [row] = await queryRows<CaseRow>(
    db,
    `SELECT ${CASE_COLUMNS} FROM review.review_case
     WHERE brand_id = $1 AND marketplace = $2 AND period_start = $3::date`,
    [scope.brandId, scope.marketplace, scope.periodStart],
  );
  return row ?? null;
}

export async function latestDecision(db: PGlite, caseId: string): Promise<DecisionRow | null> {
  const [row] = await queryRows<DecisionRow>(
    db,
    `SELECT ${DECISION_COLUMNS} FROM review.decision WHERE case_id = $1 ORDER BY version DESC LIMIT 1`,
    [caseId],
  );
  return row ? toDecisionRow(row) : null;
}

export async function appendDecision(
  db: PGlite,
  input: Omit<DecisionRow, 'decisionId' | 'version' | 'createdAt'>,
): Promise<DecisionRow> {
  const [next] = await queryRows<{ version: number }>(
    db,
    'SELECT coalesce(max(version), 0) + 1 AS version FROM review.decision WHERE case_id = $1',
    [input.caseId],
  );
  const version = next?.version ?? 1;
  const [row] = await queryRows<DecisionRow>(
    db,
    `
    INSERT INTO review.decision
      (decision_id, case_id, version, outcome, budget_change_pct, reason, limitations, calculation,
       sources, evidence, evidence_fingerprint)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11)
    RETURNING ${DECISION_COLUMNS}`,
    [
      `${input.caseId}:v${version}`,
      input.caseId,
      version,
      input.outcome,
      input.budgetChangePct,
      input.reason,
      JSON.stringify(input.limitations),
      JSON.stringify(input.calculation),
      JSON.stringify(input.sources),
      JSON.stringify(input.evidence),
      input.evidenceFingerprint,
    ],
  );
  if (!row) throw new Error(`Decision v${version} for ${input.caseId} was not stored.`);
  return toDecisionRow(row);
}

export async function setCaseStatus(db: PGlite, caseId: string, status: CaseStatus): Promise<void> {
  await db.query('UPDATE review.review_case SET status = $2, updated_at = now() WHERE case_id = $1', [
    caseId,
    status,
  ]);
}

export async function appendEvent(db: PGlite, caseId: string, type: string, payload: unknown): Promise<void> {
  await db.query('INSERT INTO review.event (case_id, type, payload) VALUES ($1, $2, $3::jsonb)', [
    caseId,
    type,
    JSON.stringify(payload),
  ]);
}

/** Case status per scope, for navigation. One query, no reconciliation round trip. */
export async function listCaseStates(db: PGlite): Promise<CaseState[]> {
  return queryRows<CaseState>(
    db,
    `
    SELECT c.brand_id AS "brandId", c.marketplace, c.status, d.outcome
    FROM review.review_case c
    LEFT JOIN LATERAL (
      SELECT outcome FROM review.decision WHERE case_id = c.case_id ORDER BY version DESC LIMIT 1
    ) d ON true`,
  );
}

/** Every decision recorded for a case, newest first: the audit trail a reviewer can read. */
export async function listDecisions(db: PGlite, caseId: string, limit = 20): Promise<DecisionRow[]> {
  const rows = await queryRows<DecisionRow>(
    db,
    `SELECT ${DECISION_COLUMNS} FROM review.decision WHERE case_id = $1 ORDER BY version DESC LIMIT $2`,
    [caseId, limit],
  );
  return rows.map(toDecisionRow);
}
