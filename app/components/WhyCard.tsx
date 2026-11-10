import type { CaseView } from '../../src/server/caseService.ts';
import { day, number } from './primitives.tsx';

export function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="check">
      <span className={`check__mark ${ok ? 'check__mark--ok' : 'check__mark--fail'}`} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <span className="check__label">{label}</span>
      <span className="check__detail">{detail}</span>
    </div>
  );
}

/**
 * The inconsistency behind the numbers. Several publications can exist for one week (the publisher
 * reissues the week as coverage grows); only one may be counted, and the export is the source of
 * record for which one.
 */
export function WhyCard({ view }: { view: CaseView }) {
  const before = view.previousSelection;
  const publications = view.candidates.length;

  return (
    <details className="card disclosure" id="evidence" open={before !== null}>
      <summary className="disclosure__summary">
        <span className="card__title">Where the numbers came from</span>
        {before ? (
          <span className="chip chip--block">
            <span className="chip__dot" />
            {before.reports} publications of one week
          </span>
        ) : (
          <span className="chip chip--ok">
            <span className="chip__dot" />
            one publication, one week
          </span>
        )}
      </summary>

      <div className="disclosure__body">
        <p className="card__hint" style={{ marginTop: 0 }}>
          The publisher can reissue the same week ({day(view.scope.periodStart)}) several times. All{' '}
          {publications} rows below are that same week — a report may count only one of them, and the export
          decides which.
        </p>

        {before ? (
          <div className="recon">
            <div className="recon__side">
              <span className="recon__label">Old rule counted all of them</span>
              <span className="recon__value recon__value--before">{number(before.total)}</span>
              <span className="recon__delta">{before.reports} publications added together</span>
            </div>
            <div className="recon__arrow" aria-hidden="true">
              →
            </div>
            <div className="recon__side">
              <span className="recon__label">This review counts one</span>
              <span className="recon__value recon__value--after">
                {number(view.evidence.activeSubscriptions)}
              </span>
              <span className="recon__delta">
                −{number(before.total - (view.evidence.activeSubscriptions ?? 0))} subscriptions that never
                existed in one week
              </span>
            </div>
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data data--recon">
            <thead>
              <tr>
                <th scope="col">Publication</th>
                <th scope="col">Coverage</th>
                <th scope="col" className="num">
                  Export
                </th>
                <th scope="col" className="num">
                  Our import
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {view.candidates.map((candidate) => {
                const selected = candidate.verdict === 'selected';
                const gap =
                  candidate.exportTotal !== null && candidate.exportTotal !== candidate.loadedSubscriptions;
                return (
                  <tr key={candidate.reportId} className={selected ? 'is-selected' : 'is-rejected'}>
                    <td>
                      <span className="candidate__id">{candidate.publisherReportId}</span>
                      <span className="candidate__sub">
                        {selected
                          ? `issued ${day(candidate.generatedAt)}`
                          : candidate.reason.replace(/^Rejected: /, '')}
                      </span>
                    </td>
                    <td>
                      {candidate.status === 'complete' ? 'Full week' : 'Partial'}
                      <span className="candidate__sub">through {day(candidate.periodEnd)}</span>
                    </td>
                    <td className="num">
                      {candidate.exportTotal === null ? '—' : number(candidate.exportTotal)}
                      {candidate.exportTotal === null ? (
                        <span className="candidate__sub">not published</span>
                      ) : null}
                    </td>
                    <td className="num">
                      {number(candidate.loadedSubscriptions)}
                      {candidate.loadedOffers !== candidate.declaredOfferCount ? (
                        <span className="candidate__gap">
                          {candidate.loadedOffers}/{candidate.declaredOfferCount} offers
                        </span>
                      ) : null}
                      {gap ? <span className="candidate__gap">differs from export</span> : null}
                    </td>
                    <td>
                      <span className={`tag tag--${selected ? 'selected' : 'rejected'}`}>
                        {selected ? 'Counted' : 'Not counted'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
