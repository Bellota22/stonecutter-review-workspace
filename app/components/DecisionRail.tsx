'use client';

import { useActionState, useState } from 'react';
import type { CaseView } from '../../src/server/caseService.ts';
import type { Outcome } from '../../src/types.ts';
import { day } from './primitives.tsx';
import { saveDecisionAction } from '../_actions/decision.ts';
import { initialDecisionState } from '../_actions/decisionState.ts';

/**
 * The decision form posts a Server Action: the backend re-derives the evidence, saves or refuses, and
 * the case page re-renders from the database. There is no client-side copy of the decision to drift.
 */
export function DecisionRail({ view }: { view: CaseView }) {
  const expandable = view.verdict.outcome === 'expand_promotion';
  const [outcome, setOutcome] = useState<Outcome>(
    view.decision?.outcome ?? (expandable ? 'expand_promotion' : 'hold'),
  );
  const [reason, setReason] = useState('');
  const [state, formAction, pending] = useActionState(saveDecisionAction, initialDecisionState);
  const ready = reason.trim().length >= 10;
  const refused = state.status === 'error';

  return (
    <aside className="actionrail" aria-label="Review actions">
      <form className="card actioncard" action={formAction}>
        <input type="hidden" name="brandId" value={view.scope.brandId} />
        <input type="hidden" name="marketplace" value={view.scope.marketplace} />

        <div className="actioncard__head">
          <div>
            <h2 className="card__title">Record the decision</h2>
            <p className="card__hint">Saved by the backend for this scope and week.</p>
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
            id="reason"
            name="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What did you verify, and what should operations do next?"
            required
            minLength={10}
          />
          <span className="field__hint">{ready ? 'Ready to save.' : 'At least 10 characters.'}</span>
        </label>

        {refused ? (
          <div
            className={`notice notice--${state.error === 'policy_violation' ? 'block' : 'warn'}`}
            role="alert"
          >
            <span className="notice__mark">{state.error === 'policy_violation' ? '✗' : '!'}</span>
            <div>
              <strong>
                {state.error === 'policy_violation' ? 'Refused by the backend' : 'Could not save'}
              </strong>
              <ul>
                {(state.details ?? ['The decision could not be saved.']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <button type="submit" className="button button--primary button--block" disabled={!ready || pending}>
          {pending ? 'Saving…' : view.decision ? 'Save new version' : 'Save decision'}
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

      <a className="railjump" href="#report">
        <span className="railjump__icon" aria-hidden="true">
          ↓
        </span>
        <span>Go to the client report</span>
      </a>
    </aside>
  );
}
