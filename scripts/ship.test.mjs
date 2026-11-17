import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const source = dirname(fileURLToPath(import.meta.url));
const temporary = join(source, '../tmp');
mkdirSync(temporary, { recursive: true });
const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
function fixture(t, options = {}) {
  const base = mkdtempSync(join(temporary, 'ship-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'work');
  const origin = join(base, 'remote.git');
  const state = join(base, 'state');
  for (const path of [root, join(root, 'scripts'), join(root, 'web'), join(root, 'tmp'), join(root, '.test-bin')]) {
    mkdirSync(path, { recursive: true });
  }
  for (const name of ['ship.sh', 'ship-clean.mjs', 'ship-receipt.mjs', 'ship-fixture.mjs']) {
    copyFileSync(join(source, name), join(root, 'scripts', name));
  }
  writeFileSync(join(root, '.gitignore'), '/tmp/\n/target/\n/.test-bin/\n');
  writeFileSync(join(root, 'web/keep'), 'test build output is produced by the fixture');
  writeFileSync(join(root, 'tracked.txt'), 'before');
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'Shipping test']);
  git(['config', 'user.email', 'shipping-test@example.invalid']);
  git(['add', '.']);
  git(['commit', '-qm', 'Initial fixture']);
  git(['init', '--bare', '-q', origin]);
  git(['remote', 'add', 'origin', origin]);
  git(['push', '-qu', 'origin', 'main']);
  const hook = `#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' '{"command":"push"}' >> ${quote(join(root, 'tmp/actions.jsonl'))}\n` +
    `test ! -f ${quote(join(origin, 'reject-push'))}\n`;
  writeFileSync(join(origin, 'hooks/pre-receive'), hook, { mode: 0o755 });
  writeFileSync(join(root, 'tracked.txt'), 'tested candidate');
  git(['commit', '-qam', 'Candidate fixture']);
  if (options.rejectPush) writeFileSync(join(origin, 'reject-push'), 'reject');
  const authEnv = {};
  const authDefault = join(base, 'login/.config/gh');
  const authXdg = join(base, 'redirected/gh');
  const authCustom = join(base, 'custom-gh');
  if (options.auth) {
    for (const directory of [authDefault, authXdg, authCustom]) mkdirSync(directory, { recursive: true });
    const chosen = options.auth === 'explicit' ? authCustom : options.auth === 'xdg' ? authXdg : authDefault;
    if (options.auth !== 'missing') writeFileSync(join(chosen, 'hosts.yml'), 'synthetic credential fixture');
    Object.assign(authEnv, { HOME: join(base, 'login'), XDG_CONFIG_HOME: join(base, 'redirected'),
      GH_CONFIG_DIR: options.auth === 'explicit' ? authCustom : '', LKJSTR_SHIP_TEST_REAL_GIT: realGit,
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
  }
  for (const name of ['pnpm', 'ssh', 'desk', 'cargo', 'sleep', ...(options.auth ? ['git', 'credential-fixture'] : [])]) {
    writeFileSync(join(root, '.test-bin', name), `#!${process.execPath}\nimport ${JSON.stringify(join(root, 'scripts/ship-fixture.mjs'))};\n`, { mode: 0o755 });
  }
  const events = () => existsSync(join(root, 'tmp/actions.jsonl'))
    ? readFileSync(join(root, 'tmp/actions.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const run = (mode = '', env = {}) => {
    const result = spawnSync('bash', ['scripts/ship.sh', '保存した内容を安全に保ちます', ...(mode ? [mode] : [])], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, PATH: `${join(root, '.test-bin')}:${process.env.PATH}`,
        LKJSTR_SHIP_STATE_DIR: state, LKJSTR_SHIP_TEST_ROOT: root, ...authEnv, ...env },
    });
    return { ...result, summary: readFileSync(join(root, 'tmp/ship.out'), 'utf8'),
      log: readFileSync(join(root, 'tmp/ship.log'), 'utf8') };
  };
  return { root, origin, state, git, events, run, authDefault, authXdg, authCustom };
}
const deploys = events => events.filter(row => row.command === 'ssh' && row.action.includes('ops/lkjstr.py deploy'));
const notices = events => events.filter(row => row.command === 'desk');

test('a rejected real Git push touches no host and reports no shipment', t => {
  const f = fixture(t, { rejectPush: true });
  const result = f.run();
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /NOT SHIPPED: cannot push/);
  assert.equal(f.events().some(row => row.command === 'ssh'), false);
  assert.equal(notices(f.events()).length, 0);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), false);
});

test('one ordinary ship binds package and HTTPS digest, then cleans and tells the owner once', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.log);
  assert.match(result.summary, /^SHIPPED /);
  const events = f.events();
  assert.equal(deploys(events).length, 1);
  assert.equal(notices(events).length, 1);
  assert.ok(events.findIndex(row => row.command === 'push') < events.findIndex(row => row.command === 'ssh'));
  assert.ok(events.findIndex(row => row.command === 'cargo') < events.findIndex(row => row.command === 'desk'));
  assert.equal(existsSync(join(f.root, 'target/debug')), false);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
  const count = events.length;
  const again = f.run();
  assert.equal(again.status, 1);
  assert.match(again.summary, /less than two hours/);
  assert.equal(f.events().length, count);
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

test('failed owner notification preserves the truthful deployed state and rate record', t => {
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

test('debug cleanup refuses a target outside the owned repository', t => {
  const f = fixture(t);
  const outside = join(f.origin, 'unrelated-target');
  mkdirSync(outside);
  writeFileSync(join(outside, 'preserve'), 'unrelated');
  const result = f.run('', { CARGO_TARGET_DIR: outside });
  assert.equal(result.status, 0, result.log);
  assert.match(result.log, /unrelated target directory/);
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
