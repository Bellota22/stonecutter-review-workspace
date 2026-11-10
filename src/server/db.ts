import type { PGlite } from '@electric-sql/pglite';
import { openDatabase, rebuildMetrics } from '../database.ts';

/**
 * One PGlite connection per process, plus the review schema it needs.
 * PGlite is single-connection, so every unit of work is serialised through one queue:
 * a mart rebuild can never interleave with a decision write.
 */
const shared = globalThis as typeof globalThis & {
  __reviewDatabase?: Promise<PGlite>;
  __reviewQueue?: Promise<unknown>;
};

/** Review tables are created on every working copy; the bundled snapshot is never touched. */
export async function migrate(db: PGlite): Promise<void> {
  await db.exec(REVIEW_SCHEMA);
}

async function initialise(): Promise<PGlite> {
  const db = await openDatabase();
  await migrate(db);
  await rebuildMetrics(db);
  return db;
}

export function database(): Promise<PGlite> {
  return (shared.__reviewDatabase ??= initialise());
}

export function withDatabase<T>(work: (db: PGlite) => Promise<T>): Promise<T> {
  const previous = shared.__reviewQueue ?? Promise.resolve();
  const next = previous.then(async () => work(await database()));
  shared.__reviewQueue = next.catch(() => undefined);
  return next;
}

/** Review state lives beside the fixture, never inside it: new tables in their own schema. */
const REVIEW_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS review;

CREATE TABLE IF NOT EXISTS review.review_case (
  case_id text PRIMARY KEY,
  brand_id text NOT NULL,
  marketplace text NOT NULL,
  period_start date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'decided', 'needs_attention')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, marketplace, period_start)
);

CREATE TABLE IF NOT EXISTS review.decision (
  decision_id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES review.review_case,
  version integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('expand_promotion', 'hold')),
  budget_change_pct integer NOT NULL CHECK (budget_change_pct >= 0),
  reason text NOT NULL,
  limitations jsonb NOT NULL,
  calculation jsonb NOT NULL,
  sources jsonb NOT NULL,
  evidence jsonb NOT NULL,
  evidence_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

CREATE TABLE IF NOT EXISTS review.event (
  event_id bigserial PRIMARY KEY,
  case_id text NOT NULL REFERENCES review.review_case,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
