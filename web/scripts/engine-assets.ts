// Publish the package's dependency graph from the leaves up. Every rewritten import and
// Worker URL points at immutable content; no sibling with a mutable name is left behind.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import { assertProductionEngine } from '../../scripts/engine-production.ts';

export function engineAssets(dir: string, out: string): { engine: string; wasm: string } {
  const emit = (name: string, ext: string, bytes: string | Uint8Array): string => {
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const path = `/${name}-${hash}.${ext}`;
    writeFileSync(join(out, path), bytes);
    return path;
  };
  const bytes = readFileSync(join(dir, 'lkjstr_engine_bg.wasm'));
  assertProductionEngine(bytes, readFileSync(join(dir, 'lkjstr_engine.js'), 'utf8'));
  const wasm = emit('engine', 'wasm', bytes);
  const js = (file: string, name: string, refs: Record<string, string>, bundle = false): string => {
    let text = readFileSync(join(dir, file), 'utf8');
    for (const [from, to] of Object.entries(refs)) text = text.replaceAll(from, to);
    // Keep small transport modules in one response: splitting source must not add a cold-start round trip.
    if (bundle)
      text = buildSync({
        stdin: { contents: text, resolveDir: dir, sourcefile: file },
        bundle: true,
        format: 'esm',
        target: 'es2022',
        write: false,
      }).outputFiles[0]!.text;
    return emit(name, 'js', text);
  };
  const module = js('lkjstr_engine.js', 'engine-wasm', { 'lkjstr_engine_bg.wasm': wasm });
  const shared = js('shared.js', 'engine-shared', { './lkjstr_engine.js': module });
  const worker = js('worker.js', 'engine-worker', { './lkjstr_engine.js': module });
  const engine = js(
    'transport.js',
    'engine',
    {
      "'shared.js'": `'${shared}'`,
      "'worker.js'": `'${worker}'`,
    },
    true,
  );
  return { engine, wasm };
}
