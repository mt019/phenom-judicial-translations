import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.resolve(process.env.FOREIGNLAW_DATA_DIR || path.join(repo, '..', 'phenom-foreignlaw-data'));
execFileSync('npm', ['run', 'export:web', '--', '--out', path.join(repo, '.foreignlaw-snapshot')], {
  cwd: data,
  stdio: 'inherit',
});
