import type { CaseView } from '../../src/server/caseService.ts';
import { day } from './primitives.tsx';

/** Every version recorded for this case: what was decided, when, and on which evidence. */
export function HistoryCard({ view }: { view: CaseView }) {
  const versions = view.history;
  if (versions.length === 0) return null;

  return (
    <details className="card disclosure">
      <summary className="disclosure__summary">
        <span className="card__title">Decision history</span>
        <span className="chip chip--neutral">
          <span className="chip__dot" />
          {versions.length} version{versions.length === 1 ? '' : 's'}
        </span>
      </summary>
      <div className="history">
        {versions.map((version) => (
          <div className="history__row" key={version.decisionId}>
            <span className="history__version">v{version.version}</span>
            <span>
              {version.outcome === 'expand_promotion' ? `expand ${version.budgetChangePct}%` : 'hold'}
              <span className="candidate__sub">{day(version.createdAt)}</span>
            </span>
            <span className="history__reason">
              {version.reason}
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
