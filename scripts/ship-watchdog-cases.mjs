import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, deploys } from './ship-test-support.mjs';

for (const [retry, status] of [['pass', 0], ['fail', 1]]) {
  test(`watchdog reaps surviving writers before sealing evidence and a ${retry} retry`, async t => {
    const f = fixture(t, { watchdog: true });
    const term = join(f.root, 'tmp/unrelated-term');
    const bystander = spawn(process.execPath, ['-e', String.raw`
      process.on('SIGTERM', () => require('node:fs').writeFileSync(process.argv[1], 'signaled'));
      process.stdout.write('ready\n');
      setInterval(() => {}, 1000);
    `, term], { stdio: ['ignore', 'pipe', 'inherit'] });
    const bystanderExit = once(bystander, 'exit');
    let first;
    try {
      await once(bystander.stdout, 'data');
      const result = f.run('', { LKJSTR_SHIP_TEST_SMOKE: `watchdog,${retry}`, LKJSTR_SHIP_TEST_WATCHDOG: String(bystander.pid) });
      const tmp = join(f.root, 'tmp');
      const runs = readdirSync(tmp).filter(name => /^ship-\d/.test(name));
      assert.equal(runs.length, 1, result.log);
      const run = join(tmp, runs[0]);
      first = join(run, 'smoke-1');
      const second = join(run, 'smoke-2');
      const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
      assert.equal(result.status, status, result.log);
      assert.equal(read(run, 'revision').trim(), f.git(['rev-parse', 'HEAD']).trim());
      assert.equal(read(first, 'status'), '124\n');
      assert.equal(read(second, 'status'), `${status}\n`);
      assert.equal(read(first, 'engine-package.log'), 'fixture build completed before browser launch\n');
      assert.match(read(first, 'stdout'), /^stdout smoke-1$/m);
      assert.match(read(first, 'stderr'), /^stderr smoke-1$/m);
      const earlyAndLate = read(first, 'smoke-real-failures.jsonl').trim().split('\n').map(JSON.parse);
      assert.deepEqual(earlyAndLate.map(row => row.name), ['independent fixture observation', 'failure']);
      assert.match(earlyAndLate[0].stack, /independent fixture observation/);
      assert.match(earlyAndLate[1].stack, /fixture page closed by watchdog/);
      assert.deepEqual(JSON.parse(read(first, 'smoke-real/report.json')).failures, earlyAndLate);
      assert.match(read(first, 'detached.log'), /writing\n/);
      for (const [cwd, manifest] of [[run, 'scripts.sha256'], [first, 'evidence.sha256'], [second, 'evidence.sha256']]) {
        const hashes = spawnSync('sha256sum', ['-c', manifest], { cwd, encoding: 'utf8' });
        assert.equal(hashes.status, 0, hashes.stdout + hashes.stderr);
      }
      const events = f.events();
      assert.equal(events.filter(row => row.args?.[0] === 'smoke:real').length, 2);
      const seal = events.findIndex(row => row.command === 'watchdog-seal');
      const readback = events.findIndex(row => row.command === 'watchdog-retry-readback');
      assert.ok(seal >= 0 && readback > seal, result.log);
      const { elapsedMs } = events[seal];
      assert.ok(elapsedMs >= 2100 && elapsedMs < 8000, `seal after ${elapsedMs} ms`);
      t.diagnostic(`owned writers reaped and evidence sealed at ${Math.round(elapsedMs)} ms`);
      assert.equal(existsSync(term), false);
      process.kill(bystander.pid, 0);
      const selected = [first, second].find(attempt => read(attempt, 'status') === '0\n');
      if (status === 0) {
        assert.equal(selected, second);
        const report = JSON.parse(read(selected, 'smoke-real/report.json'));
        assert.deepEqual(report.checks, { 'independent socket observation': 'ok', 'later check': 'ok' });
        assert.deepEqual(report.errors, []);
        assert.deepEqual(report.failures, []);
        assert.match(result.summary, /^SHIPPED /);
      } else {
        assert.equal(selected, undefined);
        assert.equal(deploys(events).length, 0);
        assert.match(result.summary, /NOT SHIPPED: pnpm smoke:real \(twice\)/);
      }
    } finally {
      bystander.kill('SIGKILL');
      await bystanderExit;
      // Regressions can strand the fixture. Only clean up its exact command lines.
      for (const role of ['harness', 'detached']) {
        if (!first || !existsSync(join(first, `${role}.pid`))) continue;
        const pid = Number(readFileSync(join(first, `${role}.pid`), 'utf8'));
        const command = `/proc/${pid}/cmdline`;
        const identity = [join(f.root, 'scripts/ship-fixture-watchdog.mjs'), role, first, ''].join('\0');
        if (existsSync(command) && readFileSync(command, 'utf8').endsWith(identity)) process.kill(pid, 'SIGKILL');
      }
    }
  });
}
