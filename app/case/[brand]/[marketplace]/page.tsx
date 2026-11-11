import { Suspense } from 'react';
import { listScopes } from '../../../../src/metrics.ts';
import { withDatabase } from '../../../../src/server/db.ts';
import { openCase, reportFor, type CaseView } from '../../../../src/server/caseService.ts';
import { listCaseStates, type CaseState } from '../../../../src/server/reviewStore.ts';
import { latencyMs, simulateLatency } from '../../../../src/server/demoLatency.ts';
import { DecisionRail } from '../../../components/DecisionRail.tsx';
import { HistoryCard } from '../../../components/HistoryCard.tsx';
import { MetricStrip } from '../../../components/MetricStrip.tsx';
import { ReportCard } from '../../../components/ReportCard.tsx';
import { ScopeNav } from '../../../components/ScopeNav.tsx';
import { CardSkeleton, NavSkeleton, RailSkeleton, SummarySkeleton } from '../../../components/Skeletons.tsx';
import { CaseTabs } from '../../../components/Tabs.tsx';
import { ChecksCard, VerdictBar } from '../../../components/VerdictBar.tsx';
import { WhyCard } from '../../../components/WhyCard.tsx';
import { StatusChip, day } from '../../../components/primitives.tsx';

export const dynamic = 'force-dynamic';

interface ScopeEntry {
  brandId: string;
  marketplace: string;
}

interface NavData {
  scopes: Awaited<ReturnType<typeof listScopes>>;
  states: CaseState[];
}

type View = 'report' | 'review';

/**
 * Two views, one read of the case.
 *
 * - `report` (default): what the client receives. The report opens first, because that is the outcome
 *   the operations manager is producing; the decision controls sit beside it.
 * - `review`: the internal evidence behind that report — publications, reconciliation, checks, history.
 */
export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string; marketplace: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { brand, marketplace } = await params;
  const { view: requested } = await searchParams;
  const view: View = requested === 'review' ? 'review' : 'report';
  const scope: ScopeEntry = { brandId: brand, marketplace: marketplace.toUpperCase() };

  const viewPromise = withDatabase((db) => openCase(db, scope.brandId, scope.marketplace));
  const navPromise = withDatabase(async (db): Promise<NavData> => ({
    scopes: await listScopes(db),
    states: await listCaseStates(db),
  }));
  const latency = latencyMs();

  return (
    <main className="shell">
      <Suspense fallback={<NavSkeleton />}>
        <NavSection promise={navPromise} scope={scope} />
      </Suspense>

      <div className="case">
        {latency > 0 ? (
          <p className="notice notice--info" style={{ fontSize: 12 }}>
            <span className="notice__mark">i</span>
            <span>
              Demo latency is on: {latency} ms per section (
              <span className="mono">ASSESSMENT_LATENCY_MS</span>
              ), so the loading states below are visible.
            </span>
          </p>
        ) : null}

        <Suspense fallback={<SummarySkeleton />}>
          <HeaderSection viewPromise={viewPromise} view={view} />
        </Suspense>

        {view === 'review' ? (
          <>
            <Suspense fallback={<SummarySkeleton />}>
              <SummarySection viewPromise={viewPromise} />
            </Suspense>
            <div className="casegrid">
              <div className="stack">
                <Suspense fallback={<CardSkeleton rows={4} />}>
                  <EvidenceSection viewPromise={viewPromise} />
                </Suspense>
                <Suspense fallback={<CardSkeleton rows={2} />}>
                  <ChecksSection viewPromise={viewPromise} />
                </Suspense>
                <Suspense fallback={<CardSkeleton rows={3} />}>
                  <HistorySection viewPromise={viewPromise} />
                </Suspense>
              </div>
              <Suspense fallback={<RailSkeleton />}>
                <DecisionSection viewPromise={viewPromise} showReportLink />
              </Suspense>
            </div>
          </>
        ) : (
          <div className="casegrid">
            <div className="stack">
              <Suspense fallback={<CardSkeleton rows={5} />}>
                <ReportSection viewPromise={viewPromise} />
              </Suspense>
            </div>
            <Suspense fallback={<RailSkeleton />}>
              <DecisionSection viewPromise={viewPromise} showReportLink={false} />
            </Suspense>
          </div>
        )}
      </div>
    </main>
  );
}

async function NavSection({ promise, scope }: { promise: Promise<NavData>; scope: ScopeEntry }) {
  await simulateLatency('scopes', 0.4);
  const { scopes, states } = await promise;
  return <ScopeNav scopes={scopes} states={states} active={scope} />;
}

async function HeaderSection({ viewPromise, view }: { viewPromise: Promise<CaseView>; view: View }) {
  await simulateLatency('header', 0.5);
  const current = await viewPromise;
  return (
    <>
      <header className="casehead">
        <div>
          <h1>
            {current.scope.brandName} <span>· {current.scope.marketplace}</span>
          </h1>
          <p className="casehead__sub">
            Week of {day(current.scope.periodStart)} to {day(current.scope.expectedPeriodEnd)} ·{' '}
            <span className="mono">{current.caseId}</span>
          </p>
        </div>
        <StatusChip view={current} />
      </header>
      <CaseTabs brandId={current.scope.brandId} marketplace={current.scope.marketplace} active={view} />
    </>
  );
}

async function SummarySection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('summary', 0.7);
  const view = await viewPromise;
  return (
    <>
      <MetricStrip view={view} />
      <VerdictBar view={view} />
    </>
  );
}

async function EvidenceSection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('evidence', 1);
  const view = await viewPromise;
  return <WhyCard view={view} />;
}

async function ChecksSection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('checks', 1.2);
  const view = await viewPromise;
  return <ChecksCard view={view} />;
}

async function HistorySection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('history', 1.4);
  const view = await viewPromise;
  return <HistoryCard view={view} />;
}

async function DecisionSection({
  viewPromise,
  showReportLink,
}: {
  viewPromise: Promise<CaseView>;
  showReportLink: boolean;
}) {
  await simulateLatency('decision', 1.6);
  const view = await viewPromise;
  return <DecisionRail view={view} showReportLink={showReportLink} />;
}

async function ReportSection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('report', 1.8);
  const view = await viewPromise;
  return <ReportCard result={reportFor(view)} scope={view.scope} />;
}
