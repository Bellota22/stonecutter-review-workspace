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
 * The inconsistency behind the numbers: what was counted before, what is counted now, and every
 * report that exists for the week. Collapsed to one line unless there is something to see.
 */
export function WhyCard({ view }: { view: CaseView }) {
  const before = view.previousSelection;
  const open = before !== null;

  return (
    <details className="card disclosure" id="evidence" open={open}>
      <summary className="disclosure__summary">
        <span className="card__title">Where the numbers came from</span>
        {before ? (
          <span className="chip chip--block">
            <span className="chip__dot" />
            {before.reports} reports counted as one week
          </span>
        ) : (
          <span className="chip chip--ok">
            <span className="chip__dot" />
            one report per week
          </span>
        )}
      </summary>

      <div className="disclosure__body">
        {before ? (
          <div className="recon">
            <div className="recon__side">
              <span className="recon__label">Counted before</span>
              <span className="recon__value recon__value--before">{number(before.total)}</span>
              <span className="recon__delta">sum of {before.reports} revisions</span>
            </div>
            <div className="recon__arrow" aria-hidden="true">
              →
            </div>
            <div className="recon__side">
              <span className="recon__label">Counted now</span>
              <span className="recon__value recon__value--after">
                {number(view.evidence.activeSubscriptions)}
              </span>
              <span className="recon__delta">
                −{number(before.total - (view.evidence.activeSubscriptions ?? 0))} duplicate subscriptions
              </span>
            </div>
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Coverage</th>
                <th scope="col" className="num">
                  Declared
                </th>
                <th scope="col" className="num">
                  Imported
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {view.candidates.map((candidate) => {
                const selected = candidate.verdict === 'selected';
                return (
                  <tr key={candidate.reportId} className={selected ? 'is-selected' : 'is-rejected'}>
                    <td>
                      <span className="candidate__id">{candidate.publisherReportId}</span>
                      <span className="candidate__sub">issued {day(candidate.generatedAt)}</span>
                    </td>
                    <td>
                      {candidate.status === 'complete' ? 'Full week' : 'Partial'}
                      <span className="candidate__sub">through {day(candidate.periodEnd)}</span>
                    </td>
                    <td className="num">{number(candidate.declaredSubscriptions)}</td>
                    <td className="num">
                      {number(candidate.loadedSubscriptions)}
                      {candidate.loadedOffers !== candidate.declaredOfferCount ? (
                        <span className="candidate__gap">
                          {candidate.loadedOffers}/{candidate.declaredOfferCount} offers
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`tag tag--${selected ? 'selected' : 'rejected'}`}>
                        {selected ? 'Counted' : 'Not counted'}
                      </span>
                      <span className="candidate__sub">{candidate.reason.replace(/^Rejected: /, '')}</span>
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
