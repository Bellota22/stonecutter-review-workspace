import type { CaseView } from '../../src/server/caseService.ts';
import { day, number } from './primitives.tsx';

/**
 * The inconsistencies this review detected: every report we hold for the week, which one the
 * pipeline counts now, and the number it counted before the correction.
 */
export function Reconciliation({ view }: { view: CaseView }) {
  const before = view.previousSelection;

  return (
    <section className="card" aria-labelledby="recon-heading">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="recon-heading">Why the figures disagreed</h2>
          <p className="card__hint">
            Publisher exports are the source of record. One report can be counted for a week: a complete
            report covered by the publisher wins over a partial one, wider coverage wins over narrower, and
            a newer publication supersedes an older one.
          </p>
        </div>
      </div>

      <div className="card__body" style={{ display: 'grid', gap: 16 }}>
        {before ? (
          <div className="recon">
            <div className="recon__side">
              <span className="recon__label">Counted before this review</span>
              <span className="recon__value recon__value--before">{number(before.total)}</span>
              <span className="recon__delta">
                {before.reports} reports for one week: {before.publisherIds.join(', ')}
              </span>
            </div>
            <div className="recon__arrow" aria-hidden="true">→</div>
            <div className="recon__side">
              <span className="recon__label">Counted now</span>
              <span className="recon__value recon__value--after">{number(view.evidence.activeSubscriptions)}</span>
              <span className="recon__delta">
                {before.total - (view.evidence.activeSubscriptions ?? 0)} subscriptions removed from the weekly figure
              </span>
            </div>
          </div>
        ) : (
          <div className="notice notice--ok">
            <span className="notice__mark">✓</span>
            <div>
              One report covers this week. The weekly figure is the publisher current report and no
              duplicated revision was counted.
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Coverage</th>
                <th scope="col" className="num">Publisher declared</th>
                <th scope="col" className="num">We imported</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {view.candidates.map(candidate => {
                const selected = candidate.verdict === 'selected';
                return (
                  <tr key={candidate.reportId} className={selected ? 'is-selected' : 'is-rejected'}>
                    <td>
                      <div className="candidate__id">{candidate.publisherReportId}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {candidate.status} · issued {day(candidate.generatedAt)}
                      </div>
                    </td>
                    <td>
                      {candidate.status === 'complete' ? 'Full week' : 'Partial'}
                      <div className="muted" style={{ fontSize: 12 }}>through {day(candidate.periodEnd)}</div>
                    </td>
                    <td className="num">{number(candidate.declaredSubscriptions)}</td>
                    <td className="num">
                      {number(candidate.loadedSubscriptions)}
                      {candidate.loadedOffers !== candidate.declaredOfferCount && (
                        <div className="candidate__reason" style={{ color: 'var(--block)' }}>
                          {candidate.loadedOffers} of {candidate.declaredOfferCount} offers
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`tag tag--${selected ? 'selected' : 'rejected'}`}>
                        {selected ? 'Counted' : 'Not counted'}
                      </span>
                      <div className="candidate__reason">{candidate.reason}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
