import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './database.ts';
import type { Evidence, Quality } from './types.ts';

export const venvPython = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export function pythonCommand(useVenv = true): string {
  const choices = useVenv && existsSync(venvPython) ? [venvPython]
    : process.env.PYTHON ? [process.env.PYTHON] : ['python3', 'python'];
  for (const command of choices) {
    const result = spawnSync(command, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'], { timeout: 10000 });
    if (result.status === 0) return command;
  }
  throw new Error('Python 3.11+ was not found. Install Python, then run npm run setup. PYTHON may specify its executable path.');
}
export function reconcile(evidence: Evidence): { evidence: Evidence; quality: Quality } {
  const result = spawnSync(pythonCommand(), [path.join(ROOT, 'python/reconcile.py')], {
    input: JSON.stringify(evidence), encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`Python reconciliation failed: ${result.error?.message ?? result.stderr}`);
  let output;
  try { output = JSON.parse(result.stdout); }
  catch { throw new Error('Python reconciliation returned invalid JSON.'); }
  if (!output.evidence || !['ready', 'insufficient'].includes(output.quality?.status) || !Array.isArray(output.quality.reasons)) {
    throw new Error('Python reconciliation returned an invalid result.');
  }
  return output;
}
