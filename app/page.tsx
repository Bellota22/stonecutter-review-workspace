import { PERIOD_END, PERIOD_START } from '../src/database.ts';
import { listScopes } from '../src/metrics.ts';
import { withDatabase } from '../src/server/db.ts';
import { listCaseStates } from '../src/server/reviewStore.ts';
import { ScopeGrid } from './components/ScopeGrid.tsx';
import { day } from './components/primitives.tsx';

export const dynamic = 'force-dynamic';

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

        <ScopeGrid scopes={scopes} states={states} />
      </div>
    </main>
  );
}
