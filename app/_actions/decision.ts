'use server';

import { revalidatePath } from 'next/cache';
import { withDatabase } from '../../src/server/db.ts';
import { CaseError, saveDecision } from '../../src/server/caseService.ts';
import type { Outcome } from '../../src/domain/vocabulary.ts';

import type { DecisionFormState } from './decisionState.ts';

/**
 * The mutation lives on the server. The form posts here, the case is re-read and re-rendered with the
 * new decision, and the interface never keeps its own copy of the state that could disagree with it.
 */
export async function saveDecisionAction(
  _previous: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const brandId = String(formData.get('brandId') ?? '');
  const marketplace = String(formData.get('marketplace') ?? '');
  const outcome: Outcome = formData.get('outcome') === 'expand_promotion' ? 'expand_promotion' : 'hold';
  const reason = String(formData.get('reason') ?? '');

  if (!brandId || !marketplace) {
    return { status: 'error', error: 'invalid_request', details: ['The scope is missing.'] };
  }

  try {
    const { decision } = await withDatabase((db) =>
      saveDecision(db, brandId, marketplace, { outcome, reason }),
    );
    revalidatePath(`/case/${brandId}/${marketplace}`);
    revalidatePath('/');
    return { status: 'idle', savedVersion: decision.version };
  } catch (error) {
    if (error instanceof CaseError) {
      return { status: 'error', error: error.code, details: error.details };
    }
    throw error;
  }
}
