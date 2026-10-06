import { spawnSync } from 'node:child_process';
import { pythonCommand, venvPython } from '../src/python.ts';
import { ROOT } from '../src/database.ts';

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
try {
  if (process.argv[2] === 'setup') {
    run(pythonCommand(false), ['-m', 'venv', '.venv']);
    run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
  } else {
    run(pythonCommand(), ['-m', 'pytest', ...process.argv.slice(3)]);
  }
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
