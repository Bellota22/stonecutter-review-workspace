import Link from 'next/link';
import { listScopes } from '../../../../src/metrics.ts';
import { withDatabase } from '../../../../src/server/db.ts';
import { openCase } from '../../../../src/server/caseService.ts';
import { listCaseStates } from '../../../../src/server/reviewStore.ts';
import { ChecksList } from '../../../components/ChecksList.tsx';
import { DecisionPanel } from '../../../components/DecisionPanel.tsx';
import { EvidenceComparison } from '../../../components/EvidenceComparison.tsx';
import { Reconciliation } from '../../../components/Reconciliation.tsx';
import { ReportPanel } from '../../../components/ReportPanel.tsx';
import { ScopeNav } from '../../../components/ScopeNav.tsx';
import { StatusChip } from '../../../components/primitives.tsx';
import { VerdictCard } from '../../../components/VerdictCard.tsx';
import { day } from '../../../components/primitives.tsx';

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

  return (
    <main className="shell">
      <ScopeNav scopes={scopes} states={states} active={view.scope} />

      <div className="stack">
        <div className="pagehead">
          <div>
            <h1 className="tight">
              {view.scope.brandName}{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                · {view.scope.marketplace}
              </span>
            </h1>
            <p className="pagehead__sub">
              Week of {day(view.scope.periodStart)} to {day(view.scope.expectedPeriodEnd)} · case{' '}
              <span className="mono">{view.caseId}</span> · opened {day(view.createdAt)}
            </p>
          </div>
          <StatusChip view={view} />
        </div>

        <VerdictCard view={view} />
        <EvidenceComparison view={view} />
        <Reconciliation view={view} />
        <ChecksList view={view} />
        <DecisionPanel view={view} />
        <ReportPanel view={view} />
      </div>
    </main>
  );
}
