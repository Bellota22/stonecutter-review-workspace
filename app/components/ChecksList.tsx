import type { CaseView } from '../../src/server/caseService.ts';
import { CHECK_LABELS } from './primitives.tsx';

/** Each rule the workflow applies to the evidence, with the measured result behind it. */
export function ChecksList({ view }: { view: CaseView }) {
  const checks = view.evidence.checks ?? [];
  return (
    <section className="card" aria-labelledby="checks-heading">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="checks-heading">Evidence checks</h2>
          <p className="card__hint">
            Growth is only computed when every check holds. Missing or truncated evidence is treated as
            unknown, never as zero.
          </p>
        </div>
      </div>
      <div className="checks">
        {checks.map(check => (
          <div className="check" key={check.code}>
            <span className={`check__mark ${check.ok ? 'check__mark--ok' : 'check__mark--fail'}`} aria-hidden="true">
              {check.ok ? '✓' : '✗'}
            </span>
            <span className="check__label">
              {CHECK_LABELS[check.code] ?? check.code}
              <span className="muted" style={{ display: 'block', fontSize: 12, fontWeight: 400 }}>
                {check.ok ? 'Passed' : 'Failed'}
              </span>
            </span>
            <span className="check__detail">{check.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
