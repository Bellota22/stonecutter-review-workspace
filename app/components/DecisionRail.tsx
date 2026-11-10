'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';
import type { Outcome } from '../../src/types.ts';
import { StepBadge, day } from './primitives.tsx';

type Feedback =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'violations'; items: string[] }
  | { kind: 'failed'; items: string[] };

/** Step 1: record what the evidence supports. Always visible, never below the fold. */
export function DecisionRail({ view }: { view: CaseView }) {
  const router = useRouter();
  const expandable = view.verdict.outcome === 'expand_promotion';
  const [outcome, setOutcome] = useState<Outcome>(
    view.decision?.outcome ?? (expandable ? 'expand_promotion' : 'hold'),
  );
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const ready = reason.trim().length >= 10;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback({ kind: 'busy' });
    try {
      const response = await fetch('/api/case/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brandId: view.scope.brandId,
          marketplace: view.scope.marketplace,
          outcome,
          reason,
        }),
      });
      const body = await response.json();
      if (response.ok) {
        setReason('');
        setFeedback({ kind: 'idle' });
        router.refresh();
        return;
      }
      setFeedback(
        response.status === 422
          ? { kind: 'violations', items: body.details ?? ['The evidence does not support this decision.'] }
          : { kind: 'failed', items: body.details ?? ['The decision could not be saved.'] },
      );
    } catch {
      setFeedback({ kind: 'failed', items: ['The backend is unreachable.'] });
    }
  }

  return (
    <aside className="actionrail" aria-label="Review actions">
      <form className="card actioncard" onSubmit={submit}>
        <div className="actioncard__head">
          <StepBadge step={1} done={Boolean(view.decision)} />
          <div>
            <h2 className="card__title">Record the decision</h2>
            <p className="card__hint">Stored by the backend for this scope and week.</p>
          </div>
        </div>

        {view.attention ? (
          <div className="notice notice--block" role="alert">
            <span className="notice__mark">!</span>
            <div>
              <strong>Evidence changed after the saved decision.</strong>
              <ul>
                {view.attention.changes.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <span className="notice__foot">Save a new version to revalidate.</span>
            </div>
          </div>
        ) : null}

        <div className="segmented" role="radiogroup" aria-label="Decision">
          <label className={`segment${outcome === 'hold' ? ' segment--selected' : ''}`}>
            <input
              type="radio"
              name="outcome"
              value="hold"
              checked={outcome === 'hold'}
              onChange={() => setOutcome('hold')}
            />
            <span className="segment__title">Hold</span>
            <span className="segment__note">always allowed</span>
          </label>
          <label
            className={`segment${outcome === 'expand_promotion' ? ' segment--selected' : ''}${
              expandable ? '' : ' segment--disabled'
            }`}
          >
            <input
              type="radio"
              name="outcome"
              value="expand_promotion"
              checked={outcome === 'expand_promotion'}
              disabled={!expandable}
              onChange={() => setOutcome('expand_promotion')}
            />
            <span className="segment__title">Expand 10%</span>
            <span className="segment__note">{expandable ? 'evidence supports' : 'blocked by evidence'}</span>
          </label>
        </div>

        {!expandable ? (
          <p className="actioncard__blocked">Backend refuses an expansion while a check above fails.</p>
        ) : null}

        <label className="field">
          <span className="field__label">Reason</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What did you verify, and what should operations do next?"
            required
            minLength={10}
          />
          <span className="field__hint">{ready ? 'Ready to save.' : 'At least 10 characters.'}</span>
        </label>

        {feedback.kind === 'violations' || feedback.kind === 'failed' ? (
          <div className={`notice notice--${feedback.kind === 'violations' ? 'block' : 'warn'}`} role="alert">
            <span className="notice__mark">{feedback.kind === 'violations' ? '✗' : '!'}</span>
            <div>
              <strong>{feedback.kind === 'violations' ? 'Refused by the backend' : 'Could not save'}</strong>
              <ul>
                {feedback.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          className="button button--primary button--block"
          disabled={!ready || feedback.kind === 'busy'}
        >
          {feedback.kind === 'busy' ? 'Saving…' : view.decision ? 'Save new version' : 'Save decision'}
        </button>

        {view.decision ? (
          <div className={`saved saved--${view.decision.outcome === 'expand_promotion' ? 'ok' : 'warn'}`}>
            <span className="saved__title">
              v{view.decision.version} ·{' '}
              {view.decision.outcome === 'expand_promotion'
                ? `expand ${view.decision.budgetChangePct}%`
                : 'hold'}
            </span>
            <span className="saved__note">
              saved {day(view.decision.createdAt)} · {view.decision.limitations.length} limitation(s) recorded
            </span>
            <span className="saved__reason">{view.decision.reason}</span>
          </div>
        ) : null}
      </form>

      <a className={`railjump${view.decision ? '' : ' railjump--muted'}`} href="#report">
        <StepBadge step={2} done={Boolean(view.decision)} />
        <span>{view.decision ? 'Client report ready below' : 'Report unlocks after the decision'}</span>
        <span aria-hidden="true">↓</span>
      </a>
    </aside>
  );
}
