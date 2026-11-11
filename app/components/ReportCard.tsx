import type { ReportResult } from '../../src/server/caseService.ts';
import type { ClientReport } from '../../src/domain/clientReport.ts';
import { day } from './primitives.tsx';

/**
 * The report is always on the page: with a saved decision it is the client document, without one it
 * is a draft of what the policy verdict would produce. Nothing is hidden behind a button.
 */
export function ReportCard({
  result,
  scope,
}: {
  result: ReportResult;
  scope: { brandId: string; marketplace: string };
}) {
  const report = result.kind === 'ready' || result.kind === 'draft' ? result.report : null;
  const draft = report?.draft ?? false;

  return (
    <section className="card reportcard" id="report" aria-label="Client report">
      <div className="reportcard__head">
        <div>
          <h2 className="card__title">Client report</h2>
          <p className="card__hint">
            {draft
              ? 'Draft: this is what the client would receive if the suggested decision were saved.'
              : 'Built from the saved decision and the evidence behind it, never from this screen.'}
          </p>
        </div>
        <div className="reportcard__actions">
          <a
            className="button"
            href={`/api/case/report/export?brandId=${scope.brandId}&marketplace=${scope.marketplace}&format=pdf`}
          >
            Download {draft ? 'draft ' : ''}PDF
          </a>
          <a
            className="button"
            href={`/api/case/report/export?brandId=${scope.brandId}&marketplace=${scope.marketplace}&format=docx`}
          >
            Download {draft ? 'draft ' : ''}DOCX
          </a>
        </div>
        {report ? (
          <span
            className={`chip chip--${
              draft ? 'neutral' : report.decision.outcome === 'expand_promotion' ? 'ok' : 'warn'
            }`}
          >
            <span className="chip__dot" />
            {draft
              ? 'Draft · no decision'
              : report.decision.outcome === 'expand_promotion'
                ? `Expand ${report.decision.budgetChangePct}%`
                : 'Hold'}
          </span>
        ) : null}
      </div>

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

      {result.kind === 'no_decision' && (
        <div className="empty">
          <strong>No report available.</strong>
          <span>This case has no evidence yet.</span>
        </div>
      )}

      {report ? <ReportDocument report={report} /> : null}
    </section>
  );
}

function ReportDocument({ report }: { report: ClientReport }) {
  return (
    <article className={`report${report.draft ? ' report--draft' : ''}`}>
      <header className="report__head">
        <div>
          <span className="report__label">Weekly marketplace performance</span>
          <h3 className="report__title">
            {report.client} · {report.marketplace}
          </h3>
          <p className="report__sub">
            Week of {day(report.period.start)} to {day(report.period.end)}
            {report.draft
              ? ' · draft, no decision recorded'
              : ` · decision recorded ${day(report.decision.decidedAt)}`}
          </p>
        </div>
        <span className={`chip chip--${report.decision.outcome === 'expand_promotion' ? 'ok' : 'warn'}`}>
          <span className="chip__dot" />
          {report.decision.outcome === 'expand_promotion'
            ? `Expand ${report.decision.budgetChangePct}% (draft)`
            : 'Hold'}
        </span>
      </header>

      <p className="provenance" style={{ padding: '0 16px', marginTop: 10 }}>
        Figures come from the selected publisher reports, verified against the publisher exports.
      </p>
      <div className="report__figures">
        {report.supportedResult.map((row) => (
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
          <p className="report__text">{report.decision.reason}</p>
        </div>
        <div className="report__section">
          <span className="report__label">
            Limitations <span className="provenance">· from the checks that failed</span>
          </span>
          {report.limitations.length === 0 ? (
            <p className="report__text">
              None material: both weeks are complete and reconcile to the publisher.
            </p>
          ) : (
            <ul className="report__list">
              {report.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="report__section">
          <span className="report__label">
            Next step <span className="provenance">· from the policy</span>
          </span>
          <p className="report__next">{report.nextStep}</p>
        </div>
        <div className="report__section">
          <span className="report__label">
            Sources <span className="provenance">· publisher report ids</span>
          </span>
          <ul className="report__list report__list--mono">
            {report.sources.map((source) => (
              <li key={source.reportId}>
                {source.publisherReportId} · {source.status} · through {day(source.periodEnd)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
