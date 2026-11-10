'use client';

import { useState } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';
import type { ClientReport } from '../../src/domain/clientReport.ts';
import { day } from './primitives.tsx';

type ReportState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ready'; report: ClientReport }
  | { kind: 'requires_attention'; changes: string[] }
  | { kind: 'policy_changed'; violations: string[] }
  | { kind: 'failed'; message: string };

/** The client-facing report is generated from the saved decision and the evidence it was taken on. */
export function ReportPanel({ view }: { view: CaseView }) {
  const [state, setState] = useState<ReportState>({ kind: 'idle' });

  async function generate() {
    setState({ kind: 'busy' });
    const query = new URLSearchParams({ brandId: view.scope.brandId, marketplace: view.scope.marketplace });
    try {
      const response = await fetch(`/api/case/report?${query}`);
      const body = await response.json();
      if (response.ok) setState({ kind: 'ready', report: body.report });
      else if (body.kind === 'requires_attention') setState({ kind: 'requires_attention', changes: body.changes });
      else if (body.kind === 'policy_changed') setState({ kind: 'policy_changed', violations: body.violations });
      else setState({ kind: 'failed', message: body.error ?? 'The report could not be generated.' });
    } catch {
      setState({ kind: 'failed', message: 'The report could not be generated: the backend is unreachable.' });
    }
  }

  if (!view.decision) {
    return (
      <section className="card">
        <div className="state">
          <h2>No client report yet</h2>
          <p>Save a review decision first. The report is generated from that decision and the evidence behind it.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="report-heading">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="report-heading">Client report</h2>
          <p className="card__hint">
            Generated on demand from the saved decision. If the evidence changes, this refuses to reuse the
            old approval and asks for revalidation instead.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={generate} disabled={state.kind === 'busy'}>
            {state.kind === 'busy' ? 'Generating…' : 'Generate client report'}
          </button>
        </div>
      </div>

      <div className="card__body">
        {state.kind === 'idle' && (
          <p className="muted" style={{ fontSize: 13 }}>
            Version {view.decision.version} is saved. Generate the report to see the supported result, its
            limitations and the next step.
          </p>
        )}

        {state.kind === 'requires_attention' && (
          <div className="notice notice--block" role="alert">
            <span className="notice__mark">!</span>
            <div>
              <strong>Evidence changed. The saved decision is not reused.</strong>
              <ul>{state.changes.map(change => <li key={change}>{change}</li>)}</ul>
              <div style={{ marginTop: 6 }}>Save a new decision version to revalidate and regenerate the report.</div>
            </div>
          </div>
        )}

        {state.kind === 'policy_changed' && (
          <div className="notice notice--block" role="alert">
            <span className="notice__mark">✗</span>
            <div>
              <strong>The saved decision no longer matches the policy.</strong>
              <ul>{state.violations.map(violation => <li key={violation}>{violation}</li>)}</ul>
            </div>
          </div>
        )}

        {state.kind === 'failed' && (
          <div className="notice notice--warn" role="alert">
            <span className="notice__mark">!</span>
            <div>{state.message}</div>
          </div>
        )}

        {state.kind === 'ready' && <ClientReportView report={state.report} />}
      </div>
    </section>
  );
}

function ClientReportView({ report }: { report: ClientReport }) {
  const outcome = report.decision.outcome === 'expand_promotion'
    ? `Expand the promotion by ${report.decision.budgetChangePct}% (draft for the brand manager)`
    : 'Hold the current promotion';

  return (
    <article className="report">
      <header className="report__head">
        <div className="report__title">Weekly marketplace performance · {report.client}</div>
        <div className="report__sub">
          {report.marketplace} marketplace · week of {day(report.period.start)} to {day(report.period.end)}
          {' '}· decision recorded {day(report.decision.decidedAt)}
        </div>
      </header>
      <div className="report__body">
        <div className="report__section">
          <span className="report__label">Decision</span>
          <span className="report__text"><strong>{outcome}</strong></span>
          <span className="report__text">{report.decision.reason}</span>
        </div>

        <div className="report__section">
          <span className="report__label">Supported result</span>
          <dl style={{ margin: 0 }}>
            {report.supportedResult.map(row => (
              <div className="report__row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {row.value}
                  <span className="muted" style={{ display: 'block', fontSize: 11.5, fontWeight: 400 }}>{row.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="report__section">
          <span className="report__label">Limitations</span>
          {report.limitations.length === 0
            ? <span className="report__text">No material limitations: both weeks are complete and reconcile to the publisher.</span>
            : <ul style={{ margin: 0, paddingLeft: 18 }} className="report__text">
                {report.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}
              </ul>}
        </div>

        <div className="report__section">
          <span className="report__label">Next step</span>
          <div className="report__next">{report.nextStep}</div>
        </div>

        <div className="report__section">
          <span className="report__label">Sources</span>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="report__text">
            {report.sources.map(source => (
              <li key={source.reportId}>
                <span className="mono">{source.publisherReportId}</span> · {source.status} · through {day(source.periodEnd)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
