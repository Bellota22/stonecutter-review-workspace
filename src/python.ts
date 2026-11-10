import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './database.ts';
import type { Evidence, EvidenceCheck, Quality } from './types.ts';

export const venvPython = path.join(
  ROOT,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

export function pythonCommand(useVenv = true): string {
  const choices =
    useVenv && existsSync(venvPython)
      ? [venvPython]
      : process.env.PYTHON
        ? [process.env.PYTHON]
        : ['python3', 'python'];
  for (const command of choices) {
    const result = spawnSync(
      command,
      ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'],
      { timeout: 10000 },
    );
    if (result.status === 0) return command;
  }
  throw new Error(
    'Python 3.11+ was not found. Install Python, then run npm run setup. PYTHON may specify its executable path.',
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number | null => value === null || typeof value === 'number';

function isCheck(value: unknown): value is EvidenceCheck {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.ok === 'boolean' &&
    typeof value.detail === 'string'
  );
}

/**
 * The bridge returns JSON, so the boundary is untrusted. Everything the workflow acts on is checked
 * before it is used; the remaining fields are evidence for display and are passed through.
 */
function parseReconciled(stdout: string): { evidence: Evidence; quality: Quality } {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('Python reconciliation returned invalid JSON.');
  }
  if (!isRecord(payload) || !isRecord(payload.evidence) || !isRecord(payload.quality)) {
    throw new Error('Python reconciliation returned an invalid result.');
  }

  const { evidence, quality } = payload;
  const status = quality.status === 'ready' || quality.status === 'insufficient' ? quality.status : null;
  const reasons = Array.isArray(quality.reasons)
    ? quality.reasons.filter((reason): reason is string => typeof reason === 'string')
    : null;
  const checks = Array.isArray(evidence.checks) ? evidence.checks.filter(isCheck) : [];
  const growthPct = isCount(evidence.growthPct) ? evidence.growthPct : null;
  const activeSubscriptions = isCount(evidence.activeSubscriptions) ? evidence.activeSubscriptions : null;
  const previousSubscriptions = isCount(evidence.previousSubscriptions)
    ? evidence.previousSubscriptions
    : null;

  if (status === null || reasons === null) {
    throw new Error('Python reconciliation returned an invalid result.');
  }

  return {
    evidence: {
      ...(evidence as unknown as Evidence),
      growthPct,
      activeSubscriptions,
      previousSubscriptions,
      checks,
    },
    quality: { status, reasons },
  };
}

export function reconcile(evidence: Evidence): { evidence: Evidence; quality: Quality } {
  // The authoritative export rows travel with the evidence so the checks can compare against them.
  const payload = {
    ...evidence,
    exports: { current: evidence.currentExport, previous: evidence.previousExport },
  };
  const result = spawnSync(pythonCommand(), [path.join(ROOT, 'python/reconcile.py')], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error ?? result.status !== 0) {
    throw new Error(`Python reconciliation failed: ${result.error?.message ?? result.stderr}`);
  }
  return parseReconciled(result.stdout);
}
