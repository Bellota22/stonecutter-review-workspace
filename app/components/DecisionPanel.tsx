'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';
import { day } from './primitives.tsx';

type Outcome = 'hold' | 'expand_promotion';

/**
 * Recording the decision. The outcome list reflects the policy, but the backend re-evaluates the
 * evidence on save and refuses any expansion it cannot support.
 */
export function DecisionPanel({ view }: { view: CaseView }) {
  const router = useRouter();
  const expandable = view.verdict.outcome === 'expand_promotion';
  const [outcome, setOutcome] = useState<Outcome>(view.decision?.outcome ?? view.verdict.outcome);
  const [reason, setReason] = useState(view.decision?.reason ?? '');
  const [busy, setBusy] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setViolations([]); setProblems([]);
    try {
      const response = await fetch('/api/case/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: view.scope.brandId, marketplace: view.scope.marketplace, outcome, reason }),
      });
      const body = await response.json();
      if (response.ok) {
        setReason('');
        router.refresh();
      } else if (response.status === 422) {
        setViolations(body.violations ?? ['The evidence does not support this decision.']);
      } else {
        setProblems(body.problems ?? [body.error ?? 'The decision could not be saved.']);
      }
    } catch {
      setProblems(['The decision could not be saved: the backend is unreachable.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="decision-heading">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="decision-heading">Review decision</h2>
          <p className="card__hint">
            Saved by the backend against this evidence, and reopened with the case. A held decision can
            always be recorded; an expansion is refused unless the evidence proves it.
          </p>
        </div>
      </div>

      <div className="card__body" style={{ display: 'grid', gap: 16 }}>
        {view.decision && (
          <div className={`notice ${view.decision.outcome === 'expand_promotion' ? 'notice--ok' : 'notice--warn'}`}>
            <span className="notice__mark">✓</span>
            <div>
              <strong>
                Version {view.decision.version} saved · {view.decision.outcome === 'expand_promotion'
                  ? `expand ${view.decision.budgetChangePct}%`
                  : 'hold'}
              </strong>
              <div style={{ marginTop: 4 }}>{view.decision.reason}</div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Recorded {day(view.decision.createdAt)} · {view.decision.sources.length} source report(s) ·
                {' '}{view.decision.limitations.length} recorded limitation(s)
              </div>
            </div>
          </div>
        )}

        {view.attention && (
          <div className="notice notice--block">
            <span className="notice__mark">!</span>
            <div>
              <strong>The evidence changed after this decision was saved.</strong>
              <ul>{view.attention.changes.map(change => <li key={change}>{change}</li>)}</ul>
              <div style={{ marginTop: 6 }}>Save a new decision to revalidate the case.</div>
            </div>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div className="choice">
            <label className={`choice__option${outcome === 'hold' ? ' choice__option--selected' : ''}`}>
              <input type="radio" name="outcome" checked={outcome === 'hold'}
                onChange={() => setOutcome('hold')} />
              <span>
                <span className="choice__title">Hold the promotion</span>
                <span className="choice__note">
                  Report the verified result and state what is missing. Always available.
                </span>
              </span>
            </label>

            <label className={`choice__option${outcome === 'expand_promotion' ? ' choice__option--selected' : ''}${
              expandable ? '' : ' choice__option--disabled'}`}>
              <input type="radio" name="outcome" checked={outcome === 'expand_promotion'}
                disabled={!expandable} onChange={() => setOutcome('expand_promotion')} />
              <span>
                <span className="choice__title">Expand the promotion by 10%</span>
                <span className="choice__note">
                  {expandable
                    ? 'Complete, comparable snapshots above the 10% threshold. The suggestion stays a draft for the brand manager.'
                    : 'Blocked by evidence. The backend refuses this decision while a check above fails.'}
                </span>
              </span>
            </label>
          </div>

          <div className="field">
            <label htmlFor="reason">Reason for the decision</label>
            <textarea id="reason" rows={3} value={reason} onChange={event => setReason(event.target.value)}
              placeholder="Why is this the right outcome? Name the evidence you verified and what you are asking operations to do."
              required minLength={10} />
          </div>

          {violations.length > 0 && (
            <div className="notice notice--block" role="alert">
              <span className="notice__mark">✗</span>
              <div>
                <strong>The backend refused this decision.</strong>
                <ul>{violations.map(violation => <li key={violation}>{violation}</li>)}</ul>
              </div>
            </div>
          )}
          {problems.length > 0 && (
            <div className="notice notice--warn" role="alert">
              <span className="notice__mark">!</span>
              <ul style={{ margin: 0 }}>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
            </div>
          )}

          <div className="actions">
            <button type="submit" className="button button--primary" disabled={busy || reason.trim().length < 10}>
              {busy ? 'Saving…' : view.decision ? 'Save new decision version' : 'Save decision'}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              Stored in the backend, not the browser session.
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
