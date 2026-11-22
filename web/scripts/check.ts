// Canonical gate: repo rules + tsc + biome + vitest. Prints one "ok check" line or the failures.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

process.chdir(new URL('..', import.meta.url).pathname);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const MAX_LINES = 300;
/** Data, not logic: the contract, the string tables and the mock's fixtures may run longer. */
const LONG =
  /^(src\/(engine\/protocol\.ts|shared\/strings-(en|ja)\.ts|engine\/mock\/fixtures)|scripts\/smoke\.ts)/;
const problems: string[] = [];
for (const f of [...walk('src'), ...walk('scripts'), ...walk('tests')]) {
  if (!/\.(ts|css|html)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n').length;
  if (lines > MAX_LINES && !LONG.test(f)) problems.push(`${f}: ${lines} lines (max ${MAX_LINES})`);
  if (!f.startsWith('src/') || !f.endsWith('.ts')) continue;
  if (/^\s*(export\s+)?class\s/m.test(text))
    problems.push(`${f}: class declaration (use create* factories)`);
  if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/.test(text))
    problems.push(`${f}: HTML string sink (build DOM with h())`);
  if (/\bnew WebSocket\b|\bindexedDB\b/.test(text) && !f.startsWith('src/engine/'))
    problems.push(`${f}: sockets and the event store belong to the engine`);
}

const run = (name: string, cmd: string): void => {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    problems.push(
      `${name} failed:\n${String(err.stdout ?? '')}${String(err.stderr ?? '')}`.slice(0, 6000),
    );
  }
};
run('tsc', 'node_modules/.bin/tsc -p .');
run('biome', 'node_modules/.bin/biome check .');
run('vitest', 'node_modules/.bin/vitest run --maxWorkers=4');
run('package-engine', 'node --test scripts/package-engine.test.mjs');
run('smoke inventory', 'node --test scripts/smoke-check-inventory.test.mjs');
run('smoke socket trace', 'node --test scripts/smoke-socket-trace.test.mjs');

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('ok check');
