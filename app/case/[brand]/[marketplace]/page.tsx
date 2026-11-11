import Link from 'next/link';
import { listScopes } from '../../../../src/metrics.ts';
import { withDatabase } from '../../../../src/server/db.ts';
import { openCase, reportFor } from '../../../../src/server/caseService.ts';
import { listCaseStates } from '../../../../src/server/reviewStore.ts';
import { DecisionRail } from '../../../components/DecisionRail.tsx';
import { HistoryCard } from '../../../components/HistoryCard.tsx';
import { MetricStrip } from '../../../components/MetricStrip.tsx';
import { ReportCard } from '../../../components/ReportCard.tsx';
import { ScopeNav } from '../../../components/ScopeNav.tsx';
import { ChecksCard, VerdictBar } from '../../../components/VerdictBar.tsx';
import { WhyCard } from '../../../components/WhyCard.tsx';
import { StatusChip, day } from '../../../components/primitives.tsx';

export const dynamic = 'force-dynamic';

export default async function CasePage({
  params,
}: {
  params: Promise<{ brand: string; marketplace: string }>;
}) {
  const { brand, marketplace } = await params;
  const scopes = await withDatabase((db) => listScopes(db));
  const states = await withDatabase((db) => listCaseStates(db));

  let view;
  try {
    view = await withDatabase((db) => openCase(db, brand, marketplace.toUpperCase()));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The scope could not be opened.';
    return (
      <main className="shell">
        <ScopeNav scopes={scopes} states={states} />
        <section className="card">
          <div className="state">
            <h2>This scope could not be opened</h2>
            <p>{message}</p>
            <Link className="button" href="/">
              Choose another scope
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const report = reportFor(view);

  return (
    <main className="shell">
      <ScopeNav scopes={scopes} states={states} active={view.scope} />

      <div className="case">
        <header className="casehead">
          <div>
            <h1>
              {view.scope.brandName} <span>· {view.scope.marketplace}</span>
            </h1>
            <p className="casehead__sub">
              Week of {day(view.scope.periodStart)} to {day(view.scope.expectedPeriodEnd)} ·{' '}
              <span className="mono">{view.caseId}</span>
            </p>
          </div>
          <StatusChip view={view} />
        </header>

        <MetricStrip view={view} />
        <VerdictBar view={view} />

        <div className="casegrid">
          <div className="stack">
            <WhyCard view={view} />
            <ChecksCard view={view} />
            <HistoryCard view={view} />
          </div>
          <DecisionRail view={view} />
        </div>

        <ReportCard result={report} scope={view.scope} />
      </div>
    </main>
  );
}
