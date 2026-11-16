import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

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

if (name === 'pnpm') {
  log({ command: name, args });
  if (process.env.LKJSTR_SHIP_TEST_SOURCE_CHANGE) writeFileSync(join(root, 'tracked.txt'), 'changed during build');
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
    process.stdout.write(`${digest(readFileSync(0))}  transferred.tar.gz\n`);
  } else if (action.includes('ops/lkjstr.py deploy')) {
    const before = state();
    before.calls += 1;
    if (process.env.LKJSTR_SHIP_TEST_BUSY && before.calls === 1) { save(before); process.exit(75); }
    if (Number(process.env.LKJSTR_SHIP_TEST_FAIL_DEPLOY) === before.calls) { save(before); process.exit(1); }
    const after = before.calls.toString(16).padStart(32, '0');
    const health = { edge_https_content_headers_spa_compression: true,
      external_dns_tls_browser_verified: false, served_index_sha256: digest(index) };
    const receipt = { action: 'deploy', status: 'passed', before: before.current, after,
      archive_sha256: action.split(' ').at(-1), health };
    save({ calls: before.calls, current: after, previous: before.current });
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
} else if (name === 'sleep') {
  log({ command: name, args });
} else {
  throw new Error(`unexpected fixture command ${name}`);
}
