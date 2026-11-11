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

/**
 * The case is streamed in sections. One read of the case feeds them all, and each section has its own
 * loading placeholder, so a slow section never hides the rest of the page.
 */
export default async function CasePage({
  params,
}: {
  params: Promise<{ brand: string; marketplace: string }>;
}) {
  const { brand, marketplace } = await params;
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
            <DecisionSection viewPromise={viewPromise} />
          </Suspense>
        </div>

        <Suspense fallback={<CardSkeleton rows={5} />}>
          <ReportSection viewPromise={viewPromise} />
        </Suspense>
      </div>
    </main>
  );
}

async function NavSection({ promise, scope }: { promise: Promise<NavData>; scope: ScopeEntry }) {
  await simulateLatency('scopes', 0.4);
  const { scopes, states } = await promise;
  return <ScopeNav scopes={scopes} states={states} active={scope} />;
}

async function SummarySection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('summary', 0.6);
  const view = await viewPromise;
  return (
    <>
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

async function DecisionSection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('decision', 1.6);
  const view = await viewPromise;
  return <DecisionRail view={view} />;
}

async function ReportSection({ viewPromise }: { viewPromise: Promise<CaseView> }) {
  await simulateLatency('report', 2);
  const view = await viewPromise;
  return <ReportCard result={reportFor(view)} scope={view.scope} />;
}
