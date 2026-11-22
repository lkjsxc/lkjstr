// Generated-artifact boundary: test controls must not enter any real app package.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertProductionEngine } from './engine-production.ts';
import { engineAssets } from '../web/scripts/engine-assets.ts';

const required = [
  'start',
  'start_port_host',
  'start_shared',
  'workerhandle_stop',
  'sharedworkerhandle_stop',
];
const prohibited = [
  'benchmark',
  'workerhandle_advance_time',
  'workerhandle_set_test_relays',
  'workerhandle_prime_private_stop',
  'workerhandle_replay_stopped_input',
  'workerhandle_private_stop_counts',
  'sharedworkerhandle_prime_private_stop',
  'sharedworkerhandle_replay_stopped_input',
  'sharedworkerhandle_private_stop_counts',
  'workerhandle_hold_public_sign',
  'workerhandle_public_sign_queued',
  'workerhandle_release_public_sign',
  'workerhandle_renew_queued_bunker',
];
const bindings = `export class WorkerHandle { stop() {} }
export class SharedWorkerHandle { stop() {} }
export function start() {} export function start_port_host() {} export function start_shared() {}`;
const leb = (value) => {
  const bytes = [];
  do {
    const low = value & 127;
    value >>>= 7;
    bytes.push(low | (value ? 128 : 0));
  } while (value);
  return bytes;
};
const section = (id, data) => [id, ...leb(data.length), ...data];
function wasm(names = required) {
  const exports = names.flatMap((name) => {
    const text = [...new TextEncoder().encode(name)];
    return [...leb(text.length), ...text, 0, 0];
  });
  return Uint8Array.from([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    ...section(1, [1, 96, 0, 0]),
    ...section(3, [1, 0]),
    ...section(7, [...leb(names.length), ...exports]),
    ...section(10, [1, 2, 0, 11]),
  ]);
}
test('accepts the complete production entry surface without executing bindings', () => {
  assert.doesNotThrow(() =>
    assertProductionEngine(wasm(), `${bindings}\nthrow Error('bindings must never execute');`),
  );
});
for (const name of prohibited)
  test(`rejects sole test-only binary export ${name}`, () => {
    assert.throws(
      () => assertProductionEngine(wasm([...required, name]), bindings),
      /test-only engine exports/,
    );
  });
test('rejects stale harness wrapper methods paired with production WASM', () => {
  for (const name of prohibited.filter((name) => name !== 'benchmark')) {
    const shared = name.startsWith('shared');
    const method = name.slice(name.indexOf('_') + 1);
    const handle = shared ? 'SharedWorkerHandle' : 'WorkerHandle';
    assert.throws(
      () =>
        assertProductionEngine(
          wasm(),
          bindings.replace(`class ${handle} {`, `class ${handle} { ${method}() {}`),
        ),
      /test-only engine bindings/,
    );
  }
  assert.throws(
    () => assertProductionEngine(wasm(), `${bindings}\nexport function benchmark() {}`),
    /test-only engine bindings/,
  );
});
test('comments and quoted sample declarations do not become callable wrappers', () => {
  assert.doesNotThrow(() =>
    assertProductionEngine(
      wasm(),
      `${bindings}\n// export function benchmark() {}\nconst sample="hold_public_sign() {}";`,
    ),
  );
});
test('rejects corrupt binaries and incomplete Worker entry surfaces', () => {
  assert.throws(
    () => assertProductionEngine(new Uint8Array([0, 97]), bindings),
    /valid WebAssembly/,
  );
  assert.throws(
    () => assertProductionEngine(wasm([]), bindings),
    /missing its Worker entry points/,
  );
  assert.throws(() => assertProductionEngine(wasm(), ''), /bindings are missing/);
});
test('the real app asset boundary rejects a harness package before emitting hashed assets', () => {
  const base = resolve('tmp');
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'engine-export-'));
  try {
    const input = join(root, 'input'),
      output = join(root, 'output');
    mkdirSync(input);
    mkdirSync(output);
    writeFileSync(
      join(input, 'lkjstr_engine_bg.wasm'),
      wasm([...required, 'workerhandle_hold_public_sign']),
    );
    writeFileSync(join(input, 'lkjstr_engine.js'), bindings);
    for (const file of ['worker.js', 'shared.js', 'transport.js', 'transport-avatars.js'])
      writeFileSync(join(input, file), 'export {};');
    assert.throws(() => engineAssets(input, output), /test-only engine exports/);
    assert.deepEqual(readdirSync(output), []);
    writeFileSync(join(input, 'lkjstr_engine_bg.wasm'), wasm());
    writeFileSync(join(input, 'transport-avatars.js'), 'export const avatarTransport = 1;');
    writeFileSync(join(input, 'transport.js'), "export { avatarTransport } from './transport-avatars.js';");
    const published = engineAssets(input, output);
    const adapter = readFileSync(join(output, published.engine), 'utf8');
    assert.ok(adapter.includes('avatarTransport'));
    assert.ok(!readdirSync(output).some((file) => file.startsWith('engine-avatars-')));
    assert.ok(!adapter.includes('./transport-avatars.js'));
    assert.deepEqual(readFileSync(join(output, published.wasm)), Buffer.from(wasm()));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
