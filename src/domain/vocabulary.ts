/** The only two outcomes the policy may authorize. */
export const OUTCOMES = ['expand_promotion', 'hold'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Lifecycle of a review case. */
export const CASE_STATUSES = ['open', 'decided', 'needs_attention'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Quoted list for a SQL IN (...) clause, so the database and the code share one vocabulary. */
export function sqlList(values: readonly string[]): string {
  return values.map(value => `'${value.replaceAll("'", "''")}'`).join(', ');
}
