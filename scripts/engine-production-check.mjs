// Inspect generated artifacts only; do not load the binding module or instantiate WASM.
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { assertProductionEngine } from './engine-production.ts';
const directory = resolve(process.argv[2] ?? 'tmp/engine-pkg');
try {
  const [wasm, bindings] = await Promise.all([
    readFile(join(directory, 'lkjstr_engine_bg.wasm')),
    readFile(join(directory, 'lkjstr_engine.js'), 'utf8'),
  ]);
  assertProductionEngine(wasm, bindings);
  console.log('ok engine-production-exports');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'production engine export audit failed');
  process.exitCode = 1;
}
