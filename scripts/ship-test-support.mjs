import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = dirname(fileURLToPath(import.meta.url));
const temporary = join(source, '../tmp');
mkdirSync(temporary, { recursive: true });
const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
export function fixture(t, options = {}) {
  const base = mkdtempSync(join(temporary, 'ship-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'work');
  const origin = join(base, 'remote.git');
  const state = join(base, 'state');
  for (const path of [root, join(root, 'scripts'), join(root, 'web/scripts'), join(root, 'tmp'), join(root, '.test-bin')]) {
    mkdirSync(path, { recursive: true });
  }
  for (const name of ['ship.sh', 'nostr-enqueue.mjs', 'ship-clean.mjs', 'ship-receipt.mjs', 'ship-fixture.mjs',
    'ship-fixture-change.mjs', 'ship-run.sh', 'ship-smoke.py', 'ship-archive.py', 'ship-fixture-watchdog.mjs']) {
    copyFileSync(join(source, name), join(root, 'scripts', name));
  }
  for (const name of ['smoke-output.ts', 'smoke-real-results.mjs']) {
    const file = join('web/scripts', name);
    copyFileSync(join(source, '..', file), join(root, file));
  }
  if (options.mutableDriver) {
    const path = join(root, 'scripts/ship-run.sh');
    const script = readFileSync(path, 'utf8');
    const marker = "FIRST=$(deploy first) || fail 'host deployment did not finish; inspect its receipt and current release'\n";
    assert.ok(script.includes(marker));
    writeFileSync(path, script.replace(marker, `${marker}${'# fixture buffer boundary\n'.repeat(4096)}`));
  }
  if (options.watchdog) {
    const path = join(root, 'scripts/ship-run.sh');
    const source = readFileSync(path, 'utf8');
    const deadline = '"$ATTEMPT" 2400 60 pnpm smoke:served';
    assert.ok(source.includes(deadline));
    writeFileSync(path, source.replace(deadline, '"$ATTEMPT" 1.5 0.75 pnpm smoke:served'));
  }
  writeFileSync(join(root, '.gitignore'), '/dist/\n/tmp/\n/target/\n/.test-bin/\n');
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
  for (const name of ['pnpm', 'ssh', 'desk', 'cargo', 'sleep', 'sha256sum', 'cp', 'date', ...(options.auth ? ['git', 'credential-fixture'] : [])]) {
    writeFileSync(join(root, '.test-bin', name), `#!${process.execPath}\nimport ${JSON.stringify(join(root, 'scripts/ship-fixture.mjs'))};\n`, { mode: 0o755 });
  }
  const lock = join(state, 'lkjstr-ship.lock');
  if (options.localLockBusy) {
    mkdirSync(state);
    // Keep the real lock through the driver invocation and shorten its wait in the fixture.
    writeFileSync(join(root, '.test-bin/flock'), '#!/bin/bash\nprintf "%s\\n" "$*"\nexec /usr/bin/flock -n "$3"\n', { mode: 0o755 });
  }
  const events = () => existsSync(join(root, 'tmp/actions.jsonl'))
    ? readFileSync(join(root, 'tmp/actions.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const run = (mode = '', env = {}) => {
    const ship = ['bash', 'scripts/ship.sh', '保存した内容を安全に保ちます', ...(mode ? [mode] : [])];
    const parent = options.ignoreSigchld ? ['python3', '-I', '-c',
      'import os, signal, sys; signal.signal(signal.SIGCHLD, signal.SIG_IGN); os.execvp(sys.argv[1], sys.argv[1:])'] : [];
    const launcher = options.localLockBusy ? ['/usr/bin/flock', '--close', lock, ...ship] : ship;
    const [command, ...args] = [...parent, ...launcher];
    const result = spawnSync(command, args, {
      cwd: root, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, PATH: `${join(root, '.test-bin')}:${process.env.PATH}`,
        CARGO_TARGET_DIR: join(root, 'target'), LKJSTR_SHIP_STATE_DIR: state, LKJSTR_SHIP_TEST_ROOT: root, ...authEnv, ...env },
    });
    return { ...result, summary: readFileSync(join(root, 'tmp/ship.out'), 'utf8'),
      log: readFileSync(join(root, 'tmp/ship.log'), 'utf8') };
  };
  return { root, origin, state, git, events, run, authDefault, authXdg, authCustom };
}
export const deploys = events => events.filter(row => row.command === 'ssh' && row.action.includes('ops/lkjstr.py deploy'));
export const notices = events => events.filter(row => row.command === 'desk');

export const retained = f => {
  const names = readdirSync(join(f.root, 'tmp')).filter(name => /^ship-\d/.test(name));
  assert.equal(names.length, 1);
  return join(f.root, 'tmp', names[0]);
};
