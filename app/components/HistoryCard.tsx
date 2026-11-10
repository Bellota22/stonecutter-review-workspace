import type { CaseView } from '../../src/server/caseService.ts';
import { day, number } from './primitives.tsx';

/**
 * Every version recorded for this case, newest first: outcome, the figures it was recorded against,
 * the reason, and which evidence it was pinned to. This is the history the client report follows.
 */
export function HistoryCard({ view }: { view: CaseView }) {
  const versions = view.history;
  if (versions.length === 0) return null;

  return (
    <details className="card disclosure" open>
      <summary className="disclosure__summary">
        <span className="card__title">Decision history</span>
        <span className="chip chip--neutral">
          <span className="chip__dot" />
          {versions.length} version{versions.length === 1 ? '' : 's'} · newest first
        </span>
      </summary>
      <div className="history">
        {versions.map((version, index) => (
          <div className="history__row" key={version.decisionId}>
            <span className="history__version">
              v{version.version}
              {index === 0 ? <span className="tag tag--selected">current</span> : null}
            </span>
            <span>
              {version.outcome === 'expand_promotion' ? `expand ${version.budgetChangePct}%` : 'hold'}
              <span className="candidate__sub">{day(version.createdAt)}</span>
            </span>
            <span className="history__figures">
              <span className="history__numbers">
                {number(version.calculation.activeSubscriptions)} ←{' '}
                {number(version.calculation.previousSubscriptions)}
                {' · '}
                {version.calculation.growthPct === null
                  ? 'not comparable'
                  : `${version.calculation.growthPct}%`}
              </span>
              <span className="history__reason">{version.reason}</span>
              <span className="candidate__sub">
                {version.sources.length} source(s) · {version.limitations.length} limitation(s) · evidence{' '}
                {version.evidenceFingerprint.slice(0, 8)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
