import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, linkSync, mkdirSync, readFileSync,
  rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { afterHash, beforeCopy, onDeploy } from './ship-fixture-change.mjs';

const root = process.env.LKJSTR_SHIP_TEST_ROOT;
if (!root) throw new Error('test fixture root is required');
const name = basename(process.argv[1]);
const args = process.argv.slice(2);
const log = action => appendFileSync(join(root, 'tmp/actions.jsonl'), `${JSON.stringify(action)}\n`);
const digest = data => createHash('sha256').update(data).digest('hex');
const index = '<!doctype html><title>deployment fixture</title>';
const statePath = join(root, 'tmp/host-state.json');
const state = () => existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { calls: 0, current: 'a'.repeat(32) };
const save = value => writeFileSync(statePath, JSON.stringify(value));
const watchdog = process.env.LKJSTR_SHIP_TEST_WATCHDOG;

function assertWatchdogDrained(attempt) {
  const read = name => readFileSync(join(attempt, name), 'utf8');
  for (const role of ['pnpm', 'harness', 'detached']) {
    const pid = read(`${role}.pid`);
    assert.equal(existsSync(`/proc/${pid}`), false, `${role} must be reaped`);
  }
  assert.equal(read('harness.session'), read('pnpm.pid'));
  assert.equal(read('detached.session'), read('detached.pid'));
  assert.notEqual(read('harness.session'), read('detached.session'));
  process.kill(Number(watchdog), 0);
  assert.equal(existsSync(join(root, 'tmp/unrelated-term')), false);
  assert.ok(existsSync(join(attempt, 'closed')), 'graceful diagnostics must finish');
}

if (name === 'credential-fixture') {
  const directory = process.env.GH_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(process.env.HOME, '.config'), 'gh');
  if (args[0] === 'get' && existsSync(join(directory, 'hosts.yml'))) {
    process.stdout.write('username=synthetic-user\npassword=synthetic-password\n');
  }
} else if (name === 'git') {
  const executable = process.env.LKJSTR_SHIP_TEST_REAL_GIT;
  if (!executable) throw new Error('real Git fixture path is required');
  if (args[0] === 'push') {
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    const helper = '!' + quote(process.execPath) + ' ' + quote(join(root, '.test-bin/credential-fixture'));
    const authenticated = spawnSync(executable, ['-c', 'credential.helper=', '-c', 'credential.helper=' + helper, 'credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: process.env,
    });
    if (authenticated.status !== 0) process.exit(authenticated.status ?? 1);
    if (!authenticated.stdout.includes('password=synthetic-password')) process.exit(1);
    const directory = process.env.GH_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME, 'gh');
    log({ command: 'authentication', directory, dryRun: args.includes('--dry-run') });
  }
  const result = spawnSync(executable, args, { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
} else if (name === 'pnpm') {
  log({ command: name, args, cwd: process.cwd() });
  if (process.env.LKJSTR_SHIP_TEST_SOURCE_CHANGE) writeFileSync(join(root, 'tracked.txt'), 'changed during build');
  // Like build:real, replace dist/ with a numbered build; smoke:real also builds before it serves dist/.
  const build = () => {
    const counter = join(root, 'tmp/build-count');
    const count = Number(existsSync(counter) ? readFileSync(counter, 'utf8') : 0) + 1;
    writeFileSync(counter, String(count));
    rmSync(join(root, 'dist'), { recursive: true, force: true });
    mkdirSync(join(root, 'dist/assets'), { recursive: true });
    writeFileSync(join(root, 'dist/index.html'), index);
    writeFileSync(join(root, 'dist/build.txt'), `build ${count}\n`);
    writeFileSync(join(root, 'dist/assets/stamp.txt'), `asset ${count}\n`);
    if (process.env.LKJSTR_SMOKE_OUTPUT) writeFileSync(join(process.env.LKJSTR_SMOKE_OUTPUT, 'engine-package.log'), `build ${count}\n`);
  };
  if (args[0] === 'build:real' || args[0] === 'smoke:real') build();
  if (args[0] === 'smoke:real' || args[0] === 'smoke:served') {
    const served = args[0] === 'smoke:real' ? join(root, 'dist') : process.env.LKJSTR_SMOKE_DIST;
    if (!served) throw new Error('smoke:served requires LKJSTR_SMOKE_DIST');
    log({ command: 'served', build: readFileSync(join(served, 'build.txt'), 'utf8') });
    if (process.env.LKJSTR_SHIP_TEST_SERVED_WRITE) {
      chmodSync(join(served, 'build.txt'), 0o644);
      writeFileSync(join(served, 'build.txt'), 'changed by the smoke\n');
    }
    if (process.env.LKJSTR_SHIP_TEST_SERVED_LINK) {
      symlinkSync(join(root, 'dist/build.txt'), join(served, 'extra.txt'));
    }
    if (process.env.LKJSTR_SHIP_TEST_REWRITE_MANIFEST) {
      const manifest = join(dirname(served), 'served-manifest.json');
      chmodSync(manifest, 0o644);
      const changed = JSON.parse(readFileSync(manifest, 'utf8'));
      changed['build.txt'] = digest(readFileSync(join(served, 'build.txt')));
      writeFileSync(manifest, JSON.stringify(changed, null, 2) + '\n');
    }
    if (process.env.LKJSTR_SHIP_TEST_RETAINED_WRITE) {
      const archive = join(dirname(served), 'lkjstr-dist.tar.gz');
      chmodSync(archive, 0o644);
      appendFileSync(archive, Buffer.alloc(512));
    }
  }
  if (args[0].startsWith('smoke:') && process.env.LKJSTR_SHIP_TEST_SMOKE) {
    const attempt = basename(process.env.LKJSTR_SMOKE_OUTPUT);
    if (process.env.LKJSTR_SHOTS !== '1') throw new Error('smoke capture flag is missing');
    const mode = process.env.LKJSTR_SHIP_TEST_SMOKE.split(',')[Number(attempt.at(-1)) - 1];
    console.log(`stdout ${attempt}`);
    console.error(`stderr ${attempt}`);
    if (mode === 'timeout') process.exit(124); // Simulate a timeout before the harness writes anything.
    const output = process.env.LKJSTR_SMOKE_OUTPUT;
    if (mode === 'watchdog') {
      writeFileSync(join(output, 'pnpm.pid'), String(process.pid));
      writeFileSync(join(output, 'watchdog-start'), String(process.hrtime.bigint()));
      const script = join(root, 'scripts/ship-fixture-watchdog.mjs');
      const harness = spawn(process.execPath, [script, 'harness', output], { stdio: 'inherit' });
      await new Promise((resolve, reject) => { harness.once('exit', resolve); harness.once('error', reject); });
      throw new Error('watchdog fixture ended before its deadline');
    }
    if (watchdog && attempt === 'smoke-2') {
      const first = join(dirname(output), 'smoke-1');
      assertWatchdogDrained(first);
      assert.equal(readFileSync(join(first, 'status'), 'utf8'), '124\n');
      const hashes = spawnSync('/usr/bin/sha256sum', ['-c', 'evidence.sha256'], { cwd: first, encoding: 'utf8' });
      assert.equal(hashes.status, 0, hashes.stdout + hashes.stderr);
      log({ command: 'watchdog-retry-readback' });
    }
    const { createSmokeResults } = await import('../web/scripts/smoke-real-results.mjs');
    const results = createSmokeResults();
    const page = { locator: () => ({ innerText: async () => `failure DOM ${attempt}` }) };
    await results.observe([['independent socket observation', mode === 'pass']], page);
    results.check('later check');
    await results.writeReport([], { published: [], searches: [] });
    results.finish([]);
  }
  if (args[0] === 'package') {
    mkdirSync(join(root, 'target/debug'), { recursive: true });
    const dist = join(root, 'dist');
    const extra = join(dist, 'extra.txt');
    const type = process.env.LKJSTR_SHIP_TEST_ARCHIVE_MEMBER;
    if (type === 'symlink') symlinkSync('build.txt', extra);
    if (type === 'hardlink') linkSync(join(dist, 'build.txt'), extra);
    if (type === 'fifo') assert.equal(spawnSync('mkfifo', [extra]).status, 0);
    const tar = spawnSync('tar', ['-czf', join(root, 'tmp/lkjstr-dist.tar.gz'), '-C', dist, '.']);
    process.exit(tar.status ?? 1);
  }
} else if (name === 'ssh') {
  const action = args.at(-1);
  log({ command: name, action });
  if (action.includes('cat >')) {
    const bytes = readFileSync(0);
    log({ command: 'transfer', digest: digest(bytes), bytes: bytes.length });
    process.stdout.write(`${digest(bytes)}  transferred.tar.gz\n`);
  } else if (action.includes('ops/lkjstr.py deploy')) {
    const before = state();
    before.calls += 1;
    if (process.env.LKJSTR_SHIP_TEST_BUSY && before.calls === 1) { save(before); process.exit(75); }
    if (Number(process.env.LKJSTR_SHIP_TEST_FAIL_DEPLOY) === before.calls) { save(before); process.exit(1); }
    const noop = process.env.LKJSTR_SHIP_TEST_NOOP_BASELINE && before.calls === 2;
    const after = noop ? before.current : before.calls.toString(16).padStart(32, '0');
    const health = { edge_https_content_headers_spa_compression: true,
      external_dns_tls_browser_verified: false, served_index_sha256: digest(index) };
    const receipt = { action: 'deploy', status: 'passed', before: before.current, after,
      archive_sha256: action.split(' ').at(-1), health };
    save({ calls: before.calls, current: after, previous: noop ? before.previous : before.current });
    onDeploy(log);
    process.stdout.write(JSON.stringify(receipt));
  } else if (action.endsWith('ops/lkjstr.py verify')) {
    process.stdout.write(JSON.stringify({ edge_https_content_headers_spa_compression: true,
      external_dns_tls_browser_verified: false,
      served_index_sha256: process.env.LKJSTR_SHIP_TEST_WRONG_INDEX ? '0'.repeat(64) : digest(index) }));
  } else if (!action.includes('mkdir -p /root/lkjstr-inbox')) {
    throw new Error('unexpected simulated host command');
  }
} else if (name === 'desk') {
  log({ command: name, args });
  if (process.env.LKJSTR_SHIP_TEST_DESK_FAILURE) process.exit(1);
} else if (name === 'cargo') {
  log({ command: name, args });
  if (args.join(' ').startsWith('clean --profile dev')) rmSync(join(root, 'target/debug'), { recursive: true, force: true });
  else throw new Error('unexpected simulated cargo command');
} else if (name === 'date') {
  const now = process.env.LKJSTR_SHIP_TEST_NOW;
  if (args.length === 1 && args[0] === '+%s' && now) {
    if (!/^[0-9]+$/.test(now)) throw new Error('invalid fixture clock');
    process.stdout.write(now + '\n');
  } else {
    const result = spawnSync('/bin/date', args);
    if (result.status !== 0) process.exit(result.status ?? 1);
    process.stdout.write(result.stdout);
  }
} else if (name === 'cp') {
  if (args.length !== 2 || args[0] !== join(root, 'tmp/lkjstr-dist.tar.gz') ||
      !args[1].startsWith(join(root, 'tmp/ship-')) || !args[1].endsWith('/lkjstr-dist.tar.gz')) {
    throw new Error('unexpected fixture copy outside its snapshot');
  }
  beforeCopy(log);
  const result = spawnSync('/bin/cp', args);
  process.exit(result.status ?? 1);
} else if (name === 'sha256sum') {
  if (watchdog && basename(process.cwd()) === 'smoke-1') {
    assertWatchdogDrained(process.cwd());
    assert.equal(existsSync('status'), false, 'status must follow evidence hashing');
    const start = BigInt(readFileSync('watchdog-start', 'utf8'));
    log({ command: 'watchdog-seal', elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 });
  }
  const result = spawnSync('/usr/bin/sha256sum', args, { input: args.length ? undefined : readFileSync(0) });
  if (result.status !== 0) process.exit(result.status ?? 1);
  afterHash(args, log);
  process.stdout.write(result.stdout);
} else if (name === 'sleep') {
  log({ command: name, args });
} else {
  throw new Error(`unexpected fixture command ${name}`);
}
