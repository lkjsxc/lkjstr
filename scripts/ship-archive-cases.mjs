import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, retained } from './ship-test-support.mjs';

const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

test('the smoke serves the exact archive that ships, across a retry', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_SMOKE: 'fail,pass' });
  assert.equal(result.status, 0, result.log);
  const run = retained(f);
  const archive = join(run, 'lkjstr-dist.tar.gz');
  const shipped = spawnSync('tar', ['-xzOf', archive, './build.txt'], { encoding: 'utf8' }).stdout;
  const served = f.events().filter(row => row.command === 'served').map(row => row.build);
  assert.deepEqual(served, [shipped, shipped]);
  assert.deepEqual(f.events().filter(row => row.command === 'transfer').map(row => row.digest), [digest(archive)]);
  assert.equal(readFileSync(join(run, 'archive.sha256'), 'utf8'), `${digest(archive)}  lkjstr-dist.tar.gz\n`);
  assert.deepEqual(JSON.parse(readFileSync(join(run, 'served-manifest.json'), 'utf8')), {
    '.': null,
    assets: null,
    'assets/stamp.txt': digest(join(run, 'served/assets/stamp.txt')),
    'build.txt': digest(join(run, 'served/build.txt')),
    'index.html': digest(join(run, 'served/index.html')),
  });
});

test('a smoke that changes its served files cannot ship', t => {
  const f = fixture(t);
  const result = f.run('', { LKJSTR_SHIP_TEST_SERVED_WRITE: '1' });
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /smoked files differ from the shipped archive/);
  assert.equal(f.events().some(row => ['push', 'ssh', 'desk'].includes(row.command)), false);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

for (const type of ['symlink', 'hardlink', 'fifo']) {
  test(`a package containing a ${type} is rejected before smoke`, t => {
    const f = fixture(t);
    const result = f.run('', { LKJSTR_SHIP_TEST_ARCHIVE_MEMBER: type });
    assert.equal(result.status, 1, result.log);
    assert.match(result.log, /unsupported archive member type: /);
    assert.match(result.summary, /cannot extract the exact archive/);
    assert.equal(existsSync(join(retained(f), 'smoke-1')), false);
    assert.equal(f.events().some(row => ['push', 'ssh', 'desk'].includes(row.command)), false);
  });
}

for (const [name, change] of [
  ['adds a served symlink', { LKJSTR_SHIP_TEST_SERVED_LINK: '1' }],
  ['rewrites a served file and the manifest', { LKJSTR_SHIP_TEST_SERVED_WRITE: '1', LKJSTR_SHIP_TEST_REWRITE_MANIFEST: '1' }],
  ['rewrites the retained archive', { LKJSTR_SHIP_TEST_RETAINED_WRITE: '1' }],
]) {
  test(`a failed smoke that ${name} is sealed and cannot retry`, t => {
    const f = fixture(t);
    const result = f.run('', { ...change, LKJSTR_SHIP_TEST_SMOKE: 'fail,pass' });
    assert.equal(result.status, 1, result.log);
    assert.match(result.summary, /smoked files differ from the shipped archive/);
    const run = retained(f);
    const attempt = join(run, 'smoke-1');
    assert.equal(readFileSync(join(attempt, 'status'), 'utf8'), '1\n');
    const hashes = spawnSync('sha256sum', ['-c', 'evidence.sha256'], { cwd: attempt, encoding: 'utf8' });
    assert.equal(hashes.status, 0, hashes.stdout + hashes.stderr);
    assert.equal(existsSync(join(run, 'smoke-2')), false);
    assert.equal(f.events().some(row => ['push', 'ssh', 'desk'].includes(row.command)), false);
  });
}
