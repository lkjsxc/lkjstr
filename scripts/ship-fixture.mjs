import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
  if (args[0] === 'smoke:real' && process.env.LKJSTR_SHIP_TEST_SMOKE) {
    const attempt = basename(process.env.LKJSTR_SMOKE_OUTPUT);
    if (process.env.LKJSTR_SHOTS !== '1') throw new Error('smoke capture flag is missing');
    const mode = process.env.LKJSTR_SHIP_TEST_SMOKE.split(',')[Number(attempt.at(-1)) - 1];
    console.log(`stdout ${attempt}`);
    console.error(`stderr ${attempt}`);
    if (mode === 'timeout') process.exit(124); // Simulate a timed-out build before the harness writes anything.
    const { createSmokeResults } = await import('../web/scripts/smoke-real-results.mjs');
    const results = createSmokeResults();
    const page = { locator: () => ({ innerText: async () => `failure DOM ${attempt}` }) };
    await results.observe([['independent socket observation', mode === 'pass']], page);
    results.check('later check');
    await results.writeReport([], { published: [], searches: [] });
    results.finish([]);
  }
  if (args[0] === 'package') {
    const source = join(root, 'tmp/dist');
    mkdirSync(source, { recursive: true });
    mkdirSync(join(root, 'target/debug'), { recursive: true });
    writeFileSync(join(source, 'index.html'), index);
    const tar = spawnSync('tar', ['-czf', join(root, 'tmp/lkjstr-dist.tar.gz'), '-C', source, '.']);
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
  const result = spawnSync('/usr/bin/sha256sum', args, { input: args.length ? undefined : readFileSync(0) });
  if (result.status !== 0) process.exit(result.status ?? 1);
  afterHash(args, log);
  process.stdout.write(result.stdout);
} else if (name === 'sleep') {
  log({ command: name, args });
} else {
  throw new Error(`unexpected fixture command ${name}`);
}
