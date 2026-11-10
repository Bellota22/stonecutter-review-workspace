import Link from 'next/link';
import { PERIOD_END, PERIOD_START } from '../src/database.ts';
import { listScopes } from '../src/metrics.ts';
import { withDatabase } from '../src/server/db.ts';
import { listCaseStates } from '../src/server/reviewStore.ts';
import { day } from './components/primitives.tsx';

export const dynamic = 'force-dynamic';

const STEPS = [
  ['Investigate', 'See which report the pipeline counted, what the publisher declared, and why they disagree.'],
  ['Validate the correction', 'Check the selected report against the publisher control totals before trusting a figure.'],
  ['Record and report', 'Save the decision the evidence supports, then generate the client report from it.'],
];

export default async function Home() {
  const scopes = await withDatabase(db => listScopes(db));
  const states = await withDatabase(db => listCaseStates(db));

  return (
    <main className="shell" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="stack" style={{ maxWidth: 980 }}>
        <section>
          <h1 className="tight" style={{ fontSize: 30 }}>Weekly review workspace</h1>
          <p className="pagehead__sub" style={{ maxWidth: '68ch' }}>
            Open a scope to investigate a week that does not reconcile, validate the correction against the
            publisher exports, and record the decision the client report is built from.
          </p>
        </section>

        <section className="card" aria-labelledby="scopes-heading">
          <div className="card__head">
            <div>
              <h2 className="card__title" id="scopes-heading">Scopes in this dataset</h2>
              <p className="card__hint">
                {scopes.length} brand and marketplace scopes · week of {day(PERIOD_START)} to {day(PERIOD_END)}
              </p>
            </div>
          </div>
          <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {scopes.map(scope => {
              const state = states.find(s => s.brandId === scope.brandId && s.marketplace === scope.marketplace);
              const label = !state ? 'Not reviewed'
                : state.status === 'needs_attention' ? 'Requires attention'
                : state.outcome === 'expand_promotion' ? 'Decision: expand'
                : 'Decision: hold';
              return (
                <Link key={`${scope.brandId}-${scope.marketplace}`} href={`/case/${scope.brandId}/${scope.marketplace}`}
                  className="card" style={{ padding: 16, display: 'grid', gap: 8, boxShadow: 'none' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 14 }}>{scope.brandName}</strong>
                    <span className="chip chip--neutral">{scope.marketplace}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 500 }}>Open review →</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {STEPS.map(([title, text], index) => (
              <div key={title} style={{ display: 'grid', gap: 4 }}>
                <span className="verdict__outcome">Step {index + 1}</span>
                <strong style={{ fontSize: 14 }}>{title}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
