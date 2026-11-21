import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fixture, deploys, notices } from './ship-test-support.mjs';

const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const retained = f => {
  const names = readdirSync(join(f.root, 'tmp')).filter(name => /^ship-\d/.test(name));
  assert.equal(names.length, 1);
  return join(f.root, 'tmp', names[0]);
};

for (const [retry, exit] of [['pass', 0], ['timeout', 1]]) {
  test(`failed smoke evidence survives a ${retry} retry`, t => {
    const f = fixture(t);
    const result = f.run('', { LKJSTR_SHIP_TEST_SMOKE: `fail,${retry}` });
    assert.equal(result.status, exit, result.log);
    const run = retained(f);
    const read = (attempt, file) => readFileSync(join(run, `smoke-${attempt}`, file), 'utf8');
    for (const attempt of [1, 2]) {
      assert.equal(read(attempt, 'stdout').split('\n')[0], `stdout smoke-${attempt}`);
      assert.equal(read(attempt, 'stderr').split('\n')[0], `stderr smoke-${attempt}`);
    }
    assert.equal(read(1, 'status'), '1\n');
    assert.equal(read(1, 'smoke-real-progress.log'), 'FAIL independent socket observation\nok later check\n');
    assert.equal(read(1, 'smoke-real-observation-1.txt'), 'failure DOM smoke-1');
    const first = JSON.parse(read(1, 'smoke-real/report.json'));
    assert.deepEqual(first.checks, { 'independent socket observation': 'FAIL', 'later check': 'ok' });
    assert.match(first.failures[0].stack, /Error: independent socket observation/);
    assert.deepEqual(read(1, 'smoke-real-failures.jsonl').trim().split('\n').map(JSON.parse), first.failures);
    assert.equal(existsSync(join(f.root, 'tmp/smoke-real/report.json')), false);
    assert.equal(read(2, 'status'), retry === 'pass' ? '0\n' : '124\n');
    assert.equal(existsSync(join(run, 'smoke-2/smoke-real-observation-1.txt')), false);
    if (retry === 'pass') {
      const second = JSON.parse(read(2, 'smoke-real/report.json'));
      assert.deepEqual(second.checks, { 'independent socket observation': 'ok', 'later check': 'ok' });
      assert.deepEqual(second.failures, []);
      assert.equal(read(2, 'smoke-real-failures.jsonl'), '');
      assert.match(result.summary, /^SHIPPED /);
    } else {
      assert.equal(existsSync(join(run, 'smoke-2/smoke-real/report.json')), false);
      assert.match(result.summary, /NOT SHIPPED: pnpm smoke:real \(twice\)/);
      assert.equal(f.events().some(row => row.args?.includes('package') || ['push', 'ssh'].includes(row.command)), false);
    }
  });
}

test('a baseline no-op cannot certify a distinct compatible rollback release', t => {
  const f = fixture(t);
  const result = f.run('--establish-rollback-baseline', { LKJSTR_SHIP_TEST_NOOP_BASELINE: '1' });
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /compatible rollback baseline is incomplete/);
  const state = JSON.parse(readFileSync(join(f.root, 'tmp/host-state.json'), 'utf8'));
  assert.equal(state.current, '1'.padStart(32, '0'));
  assert.equal(state.previous, 'a'.repeat(32));
  assert.equal(deploys(f.events()).length, 2);
  assert.equal(notices(f.events()).length, 0);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

test('a later local HEAD cannot be pushed in place of the tested revision', t => {
  const f = fixture(t);
  const tested = f.git(['rev-parse', 'HEAD']).trim();
  const result = f.run('', { LKJSTR_SHIP_TEST_AFTER_HASH: 'head' });
  assert.notEqual(f.git(['rev-parse', 'HEAD']).trim(), tested);
  assert.equal(f.git(['--git-dir', f.origin, 'rev-parse', 'refs/heads/main']).trim(), tested);
  assert.equal(result.status, 0, result.log);
  assert.equal(readFileSync(join(retained(f), 'revision'), 'utf8').trim(), tested);
  assert.equal(notices(f.events()).length, 1);
});

test('upload uses the retained verified archive after build output is replaced', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_AFTER_HASH: 'archive' });
  assert.equal(result.status, 0, result.log);
  const sent = f.events().filter(row => row.command === 'transfer');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].digest, digest(join(retained(f), 'lkjstr-dist.tar.gz')));
  assert.notEqual(sent[0].digest, digest(join(f.root, 'tmp/lkjstr-dist.tar.gz')));
  assert.equal(notices(f.events()).length, 1);
});

test('receipt validation uses the pinned helper after its worktree path changes', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_AFTER_VERIFY: 'helper' });
  assert.equal(result.status, 0, result.log);
  assert.equal(f.events().filter(row => row.command === 'mutate-helper').length, 1);
  assert.equal(readFileSync(join(f.root, 'scripts/ship-receipt.mjs'), 'utf8'), 'process.exit(73);\n');
  assert.notEqual(digest(join(retained(f), 'ship-receipt.mjs')), digest(join(f.root, 'scripts/ship-receipt.mjs')));
  assert.equal(notices(f.events()).length, 1);
});

test('the already executing verified driver survives a later file replacement', t => {
  const f = fixture(t, { mutableDriver: true });
  const result = f.run('', { LKJSTR_SHIP_TEST_AFTER_VERIFY: 'driver' });
  assert.equal(result.status, 0, result.log);
  assert.equal(f.events().filter(row => row.command === 'mutate-driver').length, 1);
  assert.match(result.summary, /^SHIPPED /);
  assert.equal(notices(f.events()).length, 1);
});

test('an unrecognized coordinator between proof steps keeps its build artifacts', async t => {
  const f = fixture(t);
  const active = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'custom-proof-coordinator'], {
    cwd: f.root, stdio: 'ignore',
  });
  await new Promise((resolve, reject) => { active.once('spawn', resolve); active.once('error', reject); });
  const stopped = new Promise(resolve => active.once('exit', resolve));
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.log);
    assert.equal(existsSync(join(f.root, 'target/debug')), true);
    assert.equal(f.events().some(row => row.command === 'cargo'), false);
  } finally { active.kill(); await stopped; }
});

test('source and archive changes at snapshot time stop before push or host effects', t => {
  const f = fixture(t);
  const tested = f.git(['rev-parse', 'HEAD']).trim();
  const published = f.git(['--git-dir', f.origin, 'rev-parse', 'refs/heads/main']).trim();
  const result = f.run('', { LKJSTR_SHIP_TEST_BEFORE_COPY: '1' });
  assert.notEqual(f.git(['rev-parse', 'HEAD']).trim(), tested);
  assert.equal(f.events().filter(row => row.command === 'mutate-copy-source').length, 1);
  assert.equal(readFileSync(join(retained(f), 'revision'), 'utf8').trim(), tested);
  assert.equal(digest(join(retained(f), 'lkjstr-dist.tar.gz')), digest(join(f.root, 'tmp/lkjstr-dist.tar.gz')));
  assert.equal(f.events().some(row => ['push', 'ssh', 'desk'].includes(row.command)), false);
  assert.equal(f.git(['--git-dir', f.origin, 'rev-parse', 'refs/heads/main']).trim(), published);
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /source changed during verification/);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

test('a distinct revision can ship immediately after a successful ship and reruns every gate', t => {
  const f = fixture(t);
  const now = '1800000000';
  const env = { LKJSTR_SHIP_TEST_NOW: now };
  const firstRevision = f.git(['rev-parse', 'HEAD']).trim();
  const first = f.run('', env);
  assert.equal(first.status, 0, first.log);
  const stamp = join(f.state, 'lkjstr-last-ship');
  assert.equal(readFileSync(stamp, 'utf8'), `${now} ${firstRevision}\n`);
  const count = f.events().length;

  writeFileSync(join(f.root, 'tracked.txt'), 'next tested candidate');
  f.git(['commit', '-qam', 'Next candidate fixture']);
  const nextRevision = f.git(['rev-parse', 'HEAD']).trim();
  assert.notEqual(nextRevision, firstRevision);
  const next = f.run('', env);
  assert.equal(next.status, 0, next.summary + next.log);
  assert.match(next.summary, /^SHIPPED /);
  assert.equal(readFileSync(stamp, 'utf8'), `${now} ${nextRevision}\n`);
  assert.equal(f.git(['--git-dir', f.origin, 'rev-parse', 'refs/heads/main']).trim(), nextRevision);

  const events = f.events().slice(count);
  assert.deepEqual(events.filter(row => row.command === 'pnpm').map(row => row.args), [
    ['install', '--frozen-lockfile'], ['check'], ['smoke:real'], ['build:real'], ['package'],
  ]);
  assert.equal(events.filter(row => row.command === 'transfer').length, 1);
  assert.equal(deploys(events).length, 1);
  assert.equal(events.filter(row => row.command === 'ssh' && row.action.endsWith('ops/lkjstr.py verify')).length, 1);
  assert.deepEqual(notices(events), [{ command: 'desk', args: [
    'note', 'lkjstr を更新: 保存した内容を安全に保ちます https://lkjstr.lkjsxc.com', '--from', 'chatgpt-lkjstr',
  ] }]);
});

test('an occupied local lock protects the earlier result and log before any gate', t => {
  const f = fixture(t, { localLockBusy: true });
  const summary = join(f.root, 'tmp/ship.out');
  const log = join(f.root, 'tmp/ship.log');
  writeFileSync(summary, 'earlier result\n');
  writeFileSync(log, 'earlier log\n');

  const result = f.run();
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '-w 7200 9\n');
  assert.equal(result.summary, 'earlier result\n');
  assert.equal(result.log, 'earlier log\n');
  assert.deepEqual(f.events(), []);
});
