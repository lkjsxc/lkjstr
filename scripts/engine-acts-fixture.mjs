// Uses an already-built native fixture; never invokes Cargo or exports a key.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, open, copyFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildActsData } from './engine-acts-data.mjs';
export async function actsFixture(directory) {
  const limit = 2 * 1024 * 1024, deadline = performance.now() + 20_000;
  if (process.env.LKJSTR_ACTS_FIXTURE_FILE) {
    const handle = await open(resolve(process.env.LKJSTR_ACTS_FIXTURE_FILE), 'r');
    let raw;
    try { const buffer = Buffer.alloc(limit + 1); let used = 0;
      while (used < buffer.length) { const read = await handle.read(buffer, used, buffer.length - used, used);
        if (!read.bytesRead) break; used += read.bytesRead; }
      if (used > limit) throw Error('act fixture body bound');
      raw = buffer.subarray(0, used).toString('utf8');
    } finally { await handle.close(); }
    const data = JSON.parse(raw);
    if (!data.catalog?.length || data.catalog.length > 64) throw Error('act fixture event bound');
    return data;
  }
  const bin = resolve(process.env.LKJSTR_ACTS_FIXTURE_BIN ?? join(process.env.CARGO_TARGET_DIR ?? 'target', 'debug/examples/zap-fixtures'));
  const frozen = join(directory, 'zap-fixtures');
  await copyFile(bin, frozen); await chmod(frozen, 0o500);
  const helperSha256 = createHash('sha256').update(await readFile(frozen)).digest('hex');
  const child = spawn(frozen, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  let diagnostics = '';
  child.stderr.on('data', value => { diagnostics = (diagnostics + value).slice(-500); });
  const exited = new Promise(ok => { child.once('exit', ok); child.once('error', ok); });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => {
    const remaining = Math.min(5000, deadline - performance.now());
    if (remaining <= 0) throw Error('act fixture aggregate deadline');
    let timer;
    try {
      const line = await Promise.race([lines.next(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('act fixture deadline')), remaining);
      })]);
      if (line.done) throw Error('act fixture ended: ' + diagnostics);
      return JSON.parse(line.value);
    } finally { clearTimeout(timer); }
  };
  try {
    const seed = await next();
    const rpc = value => { child.stdin.write(JSON.stringify(value) + '\n'); return next(); };
    const data = await buildActsData({ rpc, seed });
    if (data.catalog.length > 64 || Buffer.byteLength(JSON.stringify(data)) > 2 * 1024 * 1024)
      throw Error('act fixture event/body bound');
    return { ...data, helperSha256 };
  } finally {
    child.stdin.end(); let timer;
    try { await Promise.race([exited, new Promise(ok => { timer = setTimeout(() => { child.kill('SIGKILL'); ok(); }, 2000); })]); }
    finally { clearTimeout(timer); await exited; }
  }
}
