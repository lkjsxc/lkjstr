// Production-only account persistence contract. All input artifacts are explicit.
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadavg } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const packages = {};
for (const [name, prefix] of [['current', 'LKJSTR_ACCOUNT'], ['legacy', 'LKJSTR_ACCOUNT_LEGACY']]) {
  const path = process.env[prefix + '_PACKAGE'];
  const wasm = process.env[prefix + '_WASM_SHA256'];
  const loader = process.env[prefix + '_LOADER_SHA256'];
  if (!path || !/^[a-f0-9]{64}$/.test(wasm ?? '') || !/^[a-f0-9]{64}$/.test(loader ?? '')) {
    throw Error('Explicit current and older production package paths and expected hashes are required');
  }
  const directory = await realpath(path);
  if (hash(await readFile(join(directory, 'lkjstr_engine_bg.wasm'))) !== wasm ||
      hash(await readFile(join(directory, 'lkjstr_engine.js'))) !== loader) throw Error('Account package content differs from expected identity');
  packages[name] = { path: directory, wasmSha256: wasm, loaderSha256: loader };
}
await mkdir(join(root, 'tmp'), { recursive: true });
const output = process.env.LKJSTR_ENGINE_REPORT ? resolve(process.env.LKJSTR_ENGINE_REPORT) : await mkdtemp(join(root, 'tmp/account-contract-'));
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), packages, steps: [] };
await writeFile(join(output, 'claim.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
let active, cancelled = false;
const stop = () => { if (active && active.exitCode === null) { try { process.kill(-active.pid, 'SIGTERM'); } catch {} } };
const cancel = () => { cancelled = true; stop(); };
process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
async function run(name, script, args = []) {
  if (cancelled) throw Error('Account contract canceled');
  const startedAt = new Date().toISOString(), begin = performance.now(), chunks = [];
  const env = { ...process.env, LKJSTR_ENGINE_REPORT: join(output, name) };
  const child = spawn(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  active = child;
  let bytes = 0, timedOut = false;
  const collect = chunk => { if (bytes < 512 * 1024) { chunks.push(chunk); bytes += chunk.length; } };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const timeout = setTimeout(() => { timedOut = true; stop(); }, name === 'guards' ? 180_000 : 90_000);
  const hard = setTimeout(() => { if (active === child && child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } }, name === 'guards' ? 190_000 : 100_000);
  const code = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('close', value => resolve(value ?? -1)); });
  clearTimeout(timeout); clearTimeout(hard); active = undefined;
  await writeFile(join(output, name + '.log'), Buffer.concat(chunks));
  const step = { name, startedAt, finishedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - begin), code, timedOut };
  if (name === 'race' || name === 'guards') {
    try {
      const bytes = await readFile(join(output, name, 'report.json')), result = JSON.parse(bytes);
      step.reportSha256 = hash(bytes); step.checks = result.checks.length;
      step.passed = result.checks.filter(check => check.ok).length;
      step.cleanup = result.cleanup;
    } catch { step.reportMissing = true; }
  }
  report.steps.push(step); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(step));
  if (code !== 0 || timedOut || cancelled) throw Error('Account contract stage failed: ' + name);
}
try {
  await run('current-production', 'engine-production-check.mjs', [packages.current.path]);
  await run('legacy-production', 'engine-production-check.mjs', [packages.legacy.path]);
  await run('race', 'engine-accounts-persistence.mjs');
  await run('guards', 'engine-accounts-guards.mjs');
  report.ok = true;
} catch {
  report.ok = false; process.exitCode = 1;
} finally {
  stop(); process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  report.cancelled = cancelled;
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
