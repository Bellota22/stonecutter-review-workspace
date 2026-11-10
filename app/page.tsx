import Link from 'next/link';
import { PERIOD_END, PERIOD_START } from '../src/database.ts';
import { listScopes } from '../src/metrics.ts';
import { withDatabase } from '../src/server/db.ts';
import { listCaseStates } from '../src/server/reviewStore.ts';
import { day } from './components/primitives.tsx';

export const dynamic = 'force-dynamic';

function statusOf(state: { status: string; outcome: string | null } | undefined) {
  if (!state) return { label: 'Not reviewed', tone: '' };
  if (state.status === 'needs_attention') return { label: 'Requires attention', tone: 'dot--block' };
  return state.outcome === 'expand_promotion'
    ? { label: 'Decision saved · expand', tone: 'dot--ok' }
    : { label: 'Decision saved · hold', tone: 'dot--warn' };
}

export default async function Home() {
  const scopes = await withDatabase((db) => listScopes(db));
  const states = await withDatabase((db) => listCaseStates(db));

  return (
    <main className="shell" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="stack" style={{ maxWidth: 1040 }}>
        <header className="hero">
          <h1>Weekly review workspace</h1>
          <p className="hero__sub">
            Pick a scope: you land on the week, see the numbers and the evidence behind them, record the
            decision and the client report appears below it.
          </p>
          <p className="casehead__sub">
            Week of {day(PERIOD_START)} to {day(PERIOD_END)} · {scopes.length} scopes · publisher exports are
            the source of record
          </p>
        </header>

        <section className="scopegrid" aria-label="Scopes">
          {scopes.map((scope) => {
            const state = statusOf(
              states.find((item) => item.brandId === scope.brandId && item.marketplace === scope.marketplace),
            );
            return (
              <Link
                key={`${scope.brandId}-${scope.marketplace}`}
                href={`/case/${scope.brandId}/${scope.marketplace}`}
                className="card card--link scopecard"
              >
                <div className="scopecard__head">
                  <span className="scopecard__brand">{scope.brandName}</span>
                  <span className="chip chip--neutral">{scope.marketplace}</span>
                </div>
                <span className="scopecard__status">
                  <span className={`dot ${state.tone}`} />
                  {state.label}
                </span>
                <span className="scopecard__cta">
                  Open review <span aria-hidden="true">→</span>
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
