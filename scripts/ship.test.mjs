import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import './ship-safety-cases.mjs';
import { fixture, deploys, notices } from './ship-test-support.mjs';

test('a rejected real Git push touches no host and reports no shipment', t => {
  const f = fixture(t, { rejectPush: true });
  const result = f.run();
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /NOT SHIPPED: cannot push/);
  assert.equal(f.events().some(row => row.command === 'ssh'), false);
  assert.equal(notices(f.events()).length, 0);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

test('one ordinary ship binds package and HTTPS digest, defers cleanup and tells the owner once', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.log);
  assert.match(result.summary, /^SHIPPED /);
  const events = f.events();
  const pnpm = events.filter(row => row.command === 'pnpm');
  assert.deepEqual(pnpm.slice(0, 2), [
    { command: 'pnpm', args: ['install', '--frozen-lockfile'], cwd: f.root },
    { command: 'pnpm', args: ['check'], cwd: join(f.root, 'web') },
  ]);
  assert.equal(deploys(events).length, 1);
  assert.equal(notices(events).length, 1);
  assert.ok(events.findIndex(row => row.command === 'push') < events.findIndex(row => row.command === 'ssh'));
  assert.equal(events.some(row => row.command === 'cargo'), false);
  assert.match(result.log, /debug cleanup deferred/);
  assert.equal(existsSync(join(f.root, 'target/debug')), true);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
});

test('schema-compatible baseline uses two verified copies, linked history and one owner note', t => {
  const f = fixture(t);
  const result = f.run('--establish-rollback-baseline');
  assert.equal(result.status, 0, result.log);
  const state = JSON.parse(readFileSync(join(f.root, 'tmp/host-state.json'), 'utf8'));
  assert.equal(state.current, '2'.padStart(32, '0'));
  assert.equal(state.previous, '1'.padStart(32, '0'));
  assert.equal(deploys(f.events()).length, 2);
  assert.equal(notices(f.events()).length, 1);
  assert.match(result.summary, /baseline=0+1/);
});

test('a quiet ship records the verified release timestamp without sending a note', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_NOTIFY: '0' });
  assert.equal(result.status, 0, result.log);
  assert.match(result.summary, /^SHIPPED /);
  assert.equal(deploys(f.events()).length, 1);
  assert.equal(notices(f.events()).length, 0);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
});

test('failed second baseline is incomplete, leaves the safe first copy, and can be retried', t => {
  const f = fixture(t);
  const result = f.run('--establish-rollback-baseline', { LKJSTR_SHIP_TEST_FAIL_DEPLOY: '2' });
  assert.equal(result.status, 1);
  assert.match(result.summary, /compatible rollback baseline is incomplete/);
  assert.equal(notices(f.events()).length, 0);
  const state = JSON.parse(readFileSync(join(f.root, 'tmp/host-state.json'), 'utf8'));
  assert.equal(state.current, '1'.padStart(32, '0'));
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
  const retry = f.run('--establish-rollback-baseline');
  assert.equal(retry.status, 0, retry.log);
  assert.equal(notices(f.events()).length, 1);
});

test('only an occupied host lock is retried', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_BUSY: '1' });
  assert.equal(result.status, 0, result.log);
  assert.equal(deploys(f.events()).length, 2);
  assert.equal(f.events().filter(row => row.command === 'sleep').length, 1);
});

test('an ordinary host error stops without retrying a possibly committed deployment', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_FAIL_DEPLOY: '1' });
  assert.equal(result.status, 1);
  assert.match(result.summary, /inspect its receipt and current release/);
  assert.equal(deploys(f.events()).length, 1);
  assert.equal(notices(f.events()).length, 0);
});

test('a mismatched served index cannot produce a ship note or a successful record', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_WRONG_INDEX: '1' });
  assert.equal(result.status, 1);
  assert.match(result.summary, /live verification failed/);
  assert.equal(notices(f.events()).length, 0);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

test('source changes during gates stop before push or host transfer', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_SOURCE_CHANGE: '1' });
  assert.equal(result.status, 1);
  assert.match(result.summary, /source changed during verification/);
  assert.equal(f.events().some(row => ['push', 'ssh', 'desk'].includes(row.command)), false);
});

test('failed owner notification preserves the truthful deployed state and ship timestamp', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_DESK_FAILURE: '1' });
  assert.equal(result.status, 1);
  assert.match(result.summary, /^SHIPPED .*desk note failed/);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
});

test('debug cleanup defers while an owned gate process remains active', async t => {
  const f = fixture(t);
  const active = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'verify:quiet'], {
    cwd: f.root, stdio: 'ignore',
  });
  await new Promise((resolve, reject) => { active.once('spawn', resolve); active.once('error', reject); });
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.log);
    assert.match(result.log, /debug cleanup deferred/);
    assert.equal(existsSync(join(f.root, 'target/debug')), true);
    assert.equal(f.events().some(row => row.command === 'cargo'), false);
  } finally { active.kill(); }
});

test('debug cleanup defers without touching a target outside the owned repository', t => {
  const f = fixture(t);
  const outside = join(f.origin, 'unrelated-target');
  mkdirSync(outside);
  writeFileSync(join(outside, 'preserve'), 'unrelated');
  const result = f.run('', { CARGO_TARGET_DIR: outside });
  assert.equal(result.status, 0, result.log);
  assert.match(result.log, /debug cleanup deferred/);
  assert.equal(readFileSync(join(outside, 'preserve'), 'utf8'), 'unrelated');
  assert.equal(f.events().some(row => row.command === 'cargo'), false);
});

for (const [mode, directory] of [['fallback', 'authDefault'], ['explicit', 'authCustom'], ['xdg', 'authXdg']]) {
  test(`Git credentials survive build XDG isolation: ${mode}`, t => {
    const f = fixture(t, { auth: mode });
    const result = f.run();
    assert.equal(result.status, 0, result.log);
    const events = f.events();
    const authentication = events.filter(row => row.command === 'authentication');
    assert.equal(authentication.length, 2);
    assert.ok(authentication.every(row => row.directory === f[directory]));
    assert.equal(authentication[0].dryRun, true);
    assert.equal(authentication[1].dryRun, false);
    assert.ok(events.indexOf(authentication[0]) < events.findIndex(row => row.command === 'pnpm'));
    assert.doesNotMatch(result.log + result.summary, /synthetic-password/);
  });
}

test('missing authentication stops before any expensive gate or host action', t => {
  const f = fixture(t, { auth: 'missing' });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.summary, /cannot authenticate/);
  assert.equal(f.events().some(row => ['pnpm', 'ssh', 'desk'].includes(row.command)), false);
});
