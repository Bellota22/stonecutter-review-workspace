import type { CaseView } from '../../src/server/caseService.ts';
import { nextStep, verdictHeadline } from '../../src/domain/clientReport.ts';
import { CHECK_LABELS } from './primitives.tsx';
import { CheckRow } from './WhyCard.tsx';

/** The verdict as a single banner: what the evidence supports, and the shortest reason why. */
export function VerdictBar({ view }: { view: CaseView }) {
  const expand = view.verdict.outcome === 'expand_promotion';
  const headline = verdictHeadline(view.evidence, view.verdict);

  return (
    <section className={`verdictbar ${expand ? 'verdictbar--ok' : 'verdictbar--warn'}`} aria-label="Outcome">
      <span className="verdictbar__outcome">{expand ? 'Supported' : 'Blocked'}</span>
      <div className="verdictbar__body">
        <h1 className="verdictbar__headline">{headline}</h1>
        <p className="verdictbar__meta">
          {expand
            ? `all ${view.evidence.checks?.length ?? 0} checks passed`
            : nextStep(view.evidence, view.verdict)}
        </p>
      </div>
      <a className="verdictbar__link" href="#evidence">
        See evidence
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

/** The checks that decided the outcome, in one collapsible list. */
export function ChecksCard({ view }: { view: CaseView }) {
  const checks = view.evidence.checks ?? [];
  const failed = checks.filter((check) => !check.ok).length;
  return (
    <details className="card disclosure" id="checks" open={failed > 0}>
      <summary className="disclosure__summary">
        <span className="card__title">Evidence checks</span>
        <span className={`chip chip--${failed === 0 ? 'ok' : 'block'}`}>
          <span className="chip__dot" />
          {failed === 0
            ? `${checks.length} of ${checks.length} passed`
            : `${failed} of ${checks.length} blocking`}
        </span>
      </summary>
      <div className="checks">
        {checks.map((check) => (
          <CheckRow
            key={check.code}
            ok={check.ok}
            label={CHECK_LABELS[check.code] ?? check.code}
            detail={check.detail}
          />
        ))}
      </div>
    </details>
  );
}
