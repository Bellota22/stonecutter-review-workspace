/**
 * Plain module (no `use server`): a "use server" file may only export async functions, and the form
 * needs its initial state and the shape of the result on the client too.
 */
export interface DecisionFormState {
  status: 'idle' | 'error';
  error?: string;
  details?: string[];
  savedVersion?: number;
}

export const initialDecisionState: DecisionFormState = { status: 'idle' };
