import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.env.LKJSTR_SHIP_TEST_ROOT;
const command = (name, args) => {
  const result = spawnSync(name, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`owned fixture ${name} failed`);
  return result.stdout.trim();
};
export function afterHash(args, log) {
  if (!args[0]?.endsWith('/lkjstr-dist.tar.gz')) return;
  const kind = process.env.LKJSTR_SHIP_TEST_AFTER_HASH;
  const once = join(root, 'tmp/hash-change-once');
  if (!kind || existsSync(once)) return;
  writeFileSync(once, kind);
  if (kind === 'head') {
    writeFileSync(join(root, 'tracked.txt'), 'later unverified candidate');
    command('git', ['add', 'tracked.txt']);
    command('git', ['commit', '-qm', 'Concurrent unverified fixture']);
    log({ command: 'mutate-head', revision: command('git', ['rev-parse', 'HEAD']) });
  } else if (kind === 'archive') {
    const dir = join(root, 'tmp/replaced-dist');
    mkdirSync(dir);
    writeFileSync(join(dir, 'index.html'), '<title>later unverified output</title>');
    command('tar', ['-czf', join(root, 'tmp/lkjstr-dist.tar.gz'), '-C', dir, '.']);
    log({ command: 'mutate-archive' });
  } else throw new Error('unknown fixture hash mutation');
}
export function onDeploy(log) {
  const kind = process.env.LKJSTR_SHIP_TEST_AFTER_VERIFY;
  const once = join(root, 'tmp/verify-change-once');
  if (!kind || existsSync(once)) return;
  writeFileSync(once, kind);
  if (kind === 'helper') {
    writeFileSync(join(root, 'scripts/ship-receipt.mjs'), 'process.exit(73);\n');
  } else if (kind === 'driver') {
    const path = join(root, 'scripts', existsSync(join(root, 'scripts/ship-run.sh')) ? 'ship-run.sh' : 'ship.sh');
    const script = readFileSync(path, 'utf8');
    const final = script.split('\n').findLast(line => line.startsWith('end "SHIPPED '));
    if (!final) throw new Error('fixture cannot find final driver command');
    writeFileSync(path, script.replace(final, 'exit 73'.padEnd(final.length, ' ')));
  } else throw new Error('unknown fixture verification mutation');
  log({ command: `mutate-${kind}` });
}

export function beforeCopy(log) {
  if (!process.env.LKJSTR_SHIP_TEST_BEFORE_COPY) return;
  writeFileSync(join(root, 'tracked.txt'), 'unverified source at snapshot time');
  command('git', ['add', 'tracked.txt']);
  command('git', ['commit', '-qm', 'Concurrent snapshot fixture']);
  const dir = join(root, 'tmp/copy-replaced-dist');
  mkdirSync(dir);
  writeFileSync(join(dir, 'index.html'), '<title>unverified snapshot replacement</title>');
  command('tar', ['-czf', join(root, 'tmp/lkjstr-dist.tar.gz'), '-C', dir, '.']);
  log({ command: 'mutate-copy-source', revision: command('git', ['rev-parse', 'HEAD']) });
}
