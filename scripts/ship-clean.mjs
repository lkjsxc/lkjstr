import { readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = realpathSync(process.argv[2]);
const under = (path, parent) => path === parent || path.startsWith(`${parent}${sep}`);
const git = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error('cannot identify owned build directories');
const worktrees = git.stdout.split('\n').filter(line => line.startsWith('worktree '))
  .map(line => realpathSync(line.slice(9)));
const requested = process.env.CARGO_TARGET_DIR ?? join(root, 'target');
let target;
try { target = realpathSync(isAbsolute(requested) ? requested : resolve(root, requested)); }
catch { process.exit(0); }
const targets = worktrees.flatMap(tree => {
  try { return [realpathSync(join(tree, 'target'))]; } catch { return []; }
});
if (!targets.includes(target) || !worktrees.some(tree => under(target, tree) && target !== tree)) {
  throw new Error('refusing to clean an unrelated target directory');
}
const active = [];
for (const entry of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
  if (Number(entry) === process.pid) continue;
  try {
    const executable = readlinkSync(`/proc/${entry}/exe`);
    const cwd = readlinkSync(`/proc/${entry}/cwd`);
    if (under(executable, join(target, 'debug'))) { active.push(entry); continue; }
    if (!worktrees.some(tree => under(cwd, tree))) continue;
    const compiler = ['cargo', 'rustc', 'rustdoc'].includes(basename(executable));
    const args = readFileSync(`/proc/${entry}/cmdline`, 'utf8');
    const gate = /(?:test:quiet|rust-wasm:quiet|verify:quiet|real:hour|race:open|engine-check\.sh|smoke-real\.(?:ts|mjs))/.test(args);
    if (compiler || gate) active.push(entry);
  } catch { /* A process can exit during the bounded inventory. */ }
}
if (active.length) {
  process.stderr.write(`debug cleanup deferred for ${active.length} active repository processes\n`);
  process.exit(1);
}
const result = spawnSync('cargo', ['clean', '--profile', 'dev', '--target-dir', target], {
  cwd: root, stdio: 'inherit', timeout: 60_000,
});
process.exit(result.status ?? 1);
