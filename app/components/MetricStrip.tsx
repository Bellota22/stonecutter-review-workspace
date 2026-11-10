import type { CaseView } from '../../src/server/caseService.ts';
import { Metric, change, day, number } from './primitives.tsx';

/** Four numbers, read before anything else in the case. */
export function MetricStrip({ view }: { view: CaseView }) {
  const current = view.evidence.currentReport;
  const previous = view.evidence.previousReport;
  const decision = view.decision;

  return (
    <section className="metrics" aria-label="Weekly figures">
      <Metric
        label="Active subscriptions"
        value={number(view.evidence.activeSubscriptions)}
        note={current ? `${current.status} · through ${day(current.periodEnd)}` : 'no report selected'}
        tone={current && current.status !== 'complete' ? 'warn' : 'default'}
      />
      <Metric
        label="Previous week"
        value={number(view.evidence.previousSubscriptions)}
        note={previous ? `through ${day(previous.periodEnd)}` : 'no report selected'}
        tone={previous && previous.status !== 'complete' ? 'warn' : 'default'}
      />
      <Metric
        label="Week over week"
        value={change(view.evidence.growthPct)}
        note={
          view.evidence.growthPct === null
            ? 'the two weeks cannot be compared'
            : `policy needs ${10}% to expand`
        }
        tone={view.evidence.growthPct === null ? 'warn' : 'default'}
      />
      <Metric
        label="Decision"
        value={
          decision
            ? decision.outcome === 'expand_promotion'
              ? `Expand ${decision.budgetChangePct}%`
              : 'Hold'
            : '—'
        }
        note={decision ? `v${decision.version} · ${day(decision.createdAt)}` : 'not recorded yet'}
        tone={decision ? (decision.outcome === 'expand_promotion' ? 'ok' : 'warn') : 'default'}
      />
    </section>
  );
}
