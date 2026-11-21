import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createSmokeResults } from '../web/scripts/smoke-real-results.mjs';

const [role, attempt] = process.argv.slice(2);
const file = name => join(attempt, name);
const stat = readFileSync('/proc/self/stat', 'utf8');
const [, , , session] = stat.slice(stat.lastIndexOf(')') + 1).trim().split(' ');
writeFileSync(file(`${role}.session`), session);

if (role === 'detached') {
  writeFileSync(file('detached.pid'), String(process.pid));
  setInterval(() => appendFileSync(file('detached.log'), 'writing\n'), 40);
} else {
  const results = createSmokeResults();
  await results.observe([['independent fixture observation', false]]);
  const browser = spawn(process.execPath, [process.argv[1], 'detached', attempt], {
    detached: true, stdio: 'inherit',
  });
  browser.unref();
  process.on('SIGTERM', async () => {
    // Like Playwright's listener, start asynchronous close work and let the
    // Node process stay alive. This fixture's pending work never settles.
    writeFileSync(file('term.received'), String(performance.now()));
    await setTimeout(100);
    await results.fail(new Error('fixture page closed by watchdog'));
    await results.writeReport([], { published: [], searches: [] });
    writeFileSync(file('closed'), String(performance.now()));
  });
  writeFileSync(file('harness.pid'), String(process.pid));
  setInterval(() => appendFileSync(file('harness.log'), 'writing\n'), 40);
}
