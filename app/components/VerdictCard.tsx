import type { CaseView } from '../../src/server/caseService.ts';
import { Chip } from './primitives.tsx';

/** The supported outcome for the case, and the evidence that supports or blocks it. */
export function VerdictCard({ view }: { view: CaseView }) {
  const expand = view.verdict.outcome === 'expand_promotion';
  const blockers = view.verdict.violations;

  return (
    <section
      className={`card verdict ${expand ? 'verdict--expand' : 'verdict--hold'}`}
      aria-labelledby="verdict-heading"
    >
      <div className="card__body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="verdict__outcome" id="verdict-heading">
            {expand ? 'Supported decision' : 'Blocked by evidence'}
          </span>
          {expand ? (
            <Chip tone="ok">Expand promotion by {view.verdict.budgetChangePct}%</Chip>
          ) : (
            <Chip tone="warn">Hold · no expansion</Chip>
          )}
        </div>
        <h2 className="verdict__headline">{view.verdict.summary}</h2>

        <ul className="verdict__list">
          {expand
            ? (view.evidence.checks ?? []).map((check) => (
                <li key={check.code}>
                  <span className="verdict__mark verdict__mark--ok">✓</span>
                  <span>{check.detail}</span>
                </li>
              ))
            : blockers.map((violation, index) => (
                <li key={index}>
                  <span className="verdict__mark verdict__mark--block">✗</span>
                  <span>{violation}</span>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
