/**
 * Demo knob: artificial latency so the per-section loading states can be seen (and recorded).
 * Off unless `ASSESSMENT_LATENCY_MS` is set; it never changes what the server computes.
 */
const MAX_MS = 5000;

export function latencyMs(): number {
  const raw = Number(process.env.ASSESSMENT_LATENCY_MS ?? '0');
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_MS) : 0;
}

export async function simulateLatency(section: string, factor = 1): Promise<void> {
  const base = latencyMs();
  if (base === 0) return;
  const delay = Math.round(base * factor * (0.85 + Math.random() * 0.3));
  await new Promise((resolve) => setTimeout(resolve, delay));
  console.log(`[demo-latency] ${section} +${delay}ms`);
}
