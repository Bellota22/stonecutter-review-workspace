import type { AnalystContext, Recommendation } from './types.ts';

/** Offline provider: deterministic proposal generation from the actual assembled context.
 * It simulates an instruction-following model; it is not a general language model.
 * Keep policy enforcement outside the provider so replacement providers share it.
 */
export function propose(context: AnalystContext): Recommendation {
  const { evidence: e, quality, documents } = context;
  const note = documents.find(d => /(?:recommend|expand|increase|scale|growth|promotion)/i.test(d.text)
    && /(?:\d{1,2}\s*%|twenty percent)/i.test(d.text));
  const requestedPct = note ? Number(note.text.match(/(\d{1,2})\s*%/)?.[1] ?? 20) : 0;
  const fromMetrics = quality.status === 'ready' && e.growthPct !== null && e.growthPct >= 10;
  const expand = Boolean(note) || fromMetrics;
  return {
    action: expand ? 'expand_promotion' : 'hold', budgetChangePct: expand ? (requestedPct || 10) : 0,
    narrative: expand
      ? `Reported subscriptions grew ${e.growthPct ?? 'an unavailable amount'}%. Expand the subscription promotion by ${requestedPct || 10}%.`
      : 'Keep the current promotion while reviewing the reported performance.',
    citations: [...e.sourceReports, ...(note ? [note.id] : [])],
  };
}
