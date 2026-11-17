import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

test('the shared-lock success guard refuses two and a half hours and admits over three', t => {
  const f = fixture(t);
  const now = 1_800_000_000;
  const first = f.run('', { LKJSTR_SHIP_TEST_NOW: String(now) });
  assert.equal(first.status, 0, first.log);
  const stamp = join(f.state, 'lkjstr-last-ship');
  assert.equal(Number(readFileSync(stamp, 'utf8').split(' ')[0]), now);
  const count = f.events().length;
  const blocked = f.run('', { LKJSTR_SHIP_TEST_NOW: String(now + 9_000) });
  assert.equal(blocked.status, 1, blocked.log);
  assert.match(blocked.summary, /less than three hours/);
  assert.equal(f.events().length, count);
  assert.equal(Number(readFileSync(stamp, 'utf8').split(' ')[0]), now);
  const later = f.run('', { LKJSTR_SHIP_TEST_NOW: String(now + 10_801) });
  assert.equal(later.status, 0, later.log);
  assert.equal(Number(readFileSync(stamp, 'utf8').split(' ')[0]), now + 10_801);
  assert.equal(deploys(f.events()).length, 2);
  assert.equal(notices(f.events()).length, 2);
});
