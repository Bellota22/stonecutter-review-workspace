import type { CaseView } from '../../src/server/caseService.ts';
import { Figure, change, day, number } from './primitives.tsx';

/** The two weeks under review, side by side, with coverage limits stated next to each figure. */
export function EvidenceComparison({ view }: { view: CaseView }) {
  const current = view.evidence.currentReport;
  const previous = view.evidence.previousReport;

  return (
    <section className="card" aria-labelledby="evidence-heading">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="evidence-heading">Weekly snapshot</h2>
          <p className="card__hint">
            Week of {day(view.scope.periodStart)} compared with the week of {day(view.evidence.previousReport?.periodStart ?? '')}.
            A figure is only comparable when both weeks are complete publisher reports.
          </p>
        </div>
      </div>
      <div className="figures">
        <Figure
          label="Current week"
          value={number(view.evidence.activeSubscriptions)}
          note={current
            ? `${current.status === 'complete' ? 'Complete week' : 'Partial coverage'} · through ${day(current.periodEnd)}`
            : 'No report selected'}
          tone={current && current.status !== 'complete' ? 'warn' : 'default'}
        />
        <Figure
          label="Previous week"
          value={number(view.evidence.previousSubscriptions)}
          note={previous
            ? `${previous.status === 'complete' ? 'Complete week' : 'Partial coverage'} · through ${day(previous.periodEnd)}`
            : 'No report selected'}
          tone={previous && previous.status !== 'complete' ? 'warn' : 'default'}
        />
        <Figure
          label="Week over week"
          value={change(view.evidence.growthPct)}
          note={view.evidence.growthPct === null
            ? 'The two weeks cannot be compared'
            : 'Verified against both publisher headers'}
          tone={view.evidence.growthPct === null ? 'warn' : 'default'}
        />
      </div>
    </section>
  );
}
