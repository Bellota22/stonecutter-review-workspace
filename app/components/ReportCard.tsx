import type { ReportResult } from '../../src/server/caseService.ts';
import { StepBadge, day } from './primitives.tsx';

/** Step 2: the report the client receives, rendered from the saved decision. */
export function ReportCard({ result }: { result: ReportResult }) {
  return (
    <section className="card reportcard" id="report" aria-label="Client report">
      <div className="actioncard__head reportcard__head">
        <StepBadge step={2} done={result.kind === 'ready'} />
        <div>
          <h2 className="card__title">Client report</h2>
          <p className="card__hint">
            Built from the saved decision and the evidence behind it, never from the screen.
          </p>
        </div>
      </div>

      {result.kind === 'no_decision' && (
        <div className="empty">
          <strong>Nothing to send yet.</strong>
          <span>Save a decision in step 1 and the report appears here.</span>
        </div>
      )}

      {result.kind === 'requires_attention' && (
        <div className="notice notice--block" role="alert">
          <span className="notice__mark">!</span>
          <div>
            <strong>Evidence changed. The previous approval is not reused.</strong>
            <ul>
              {result.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
            <span className="notice__foot">Save a new decision version to regenerate the report.</span>
          </div>
        </div>
      )}

      {result.kind === 'policy_changed' && (
        <div className="notice notice--block" role="alert">
          <span className="notice__mark">✗</span>
          <div>
            <strong>The saved decision no longer matches the policy.</strong>
            <ul>
              {result.violations.map((violation) => (
                <li key={violation}>{violation}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.kind === 'ready' && (
        <article className="report">
          <header className="report__head">
            <div>
              <span className="report__label">Weekly marketplace performance</span>
              <h3 className="report__title">
                {result.report.client} · {result.report.marketplace}
              </h3>
              <p className="report__sub">
                Week of {day(result.report.period.start)} to {day(result.report.period.end)} · decision
                recorded {day(result.report.decision.decidedAt)}
              </p>
            </div>
            <span
              className={`chip chip--${result.report.decision.outcome === 'expand_promotion' ? 'ok' : 'warn'}`}
            >
              <span className="chip__dot" />
              {result.report.decision.outcome === 'expand_promotion'
                ? `Expand ${result.report.decision.budgetChangePct}% (draft)`
                : 'Hold'}
            </span>
          </header>

          <p className="provenance" style={{ padding: '0 16px', marginTop: 10 }}>
            Figures below are copied from the selected publisher reports, not from this screen.
          </p>
          <div className="report__figures">
            {result.report.supportedResult.map((row) => (
              <div className="report__figure" key={row.label}>
                <span className="metric__label">{row.label}</span>
                <span className="metric__value metric__value--small">{row.value}</span>
                <span className="metric__note">{row.note}</span>
              </div>
            ))}
          </div>

          <div className="report__body">
            <div className="report__section">
              <span className="report__label">
                Why <span className="provenance">· the reason you recorded</span>
              </span>
              <p className="report__text">{result.report.decision.reason}</p>
            </div>
            <div className="report__section">
              <span className="report__label">
                Limitations <span className="provenance">· from the checks that failed</span>
              </span>
              {result.report.limitations.length === 0 ? (
                <p className="report__text">
                  None material: both weeks are complete and reconcile to the publisher.
                </p>
              ) : (
                <ul className="report__list">
                  {result.report.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="report__section">
              <span className="report__label">
                Next step <span className="provenance">· from the policy</span>
              </span>
              <p className="report__next">{result.report.nextStep}</p>
            </div>
            <div className="report__section">
              <span className="report__label">
                Sources <span className="provenance">· publisher report ids</span>
              </span>
              <ul className="report__list report__list--mono">
                {result.report.sources.map((source) => (
                  <li key={source.reportId}>
                    {source.publisherReportId} · {source.status} · through {day(source.periodEnd)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
