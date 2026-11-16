// Exercise the existing-dist package command, with fresh local data and no module execution.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import {
  productionBindings as bindings,
  productionWasm as wasm,
} from '../tests/package-production-fixture.ts';
import { fixture } from './package-engine-fixture.mjs';

function rejected(binary, script, pattern, extra) {
  const f = fixture(binary, script, extra);
  try {
    const r = f.run();
    assert.notEqual(r.status, 0, 'existing-dist package must reject unsafe engine artifacts');
    assert.match(r.stderr, pattern);
    assert.equal(
      existsSync(join(f.dir, 'tmp/lkjstr-dist.tar.gz')),
      false,
      'no compressed output on rejection',
    );
  } finally {
    f.close();
  }
}
test('existing-dist package rejects reachable harness exports despite renamed assets', () => {
  rejected(wasm(['workerhandle_hold_public_sign']), bindings, /test-only engine exports/);
});
test('existing-dist package rejects production WASM paired with stale harness bindings', () => {
  rejected(
    wasm(),
    bindings.replace('stop() {}', 'stop() {} hold_public_sign() {}'),
    /test-only engine bindings/,
  );
});
test('existing-dist package requires an unambiguous engine binding pair', () => {
  rejected(wasm(), bindings, /engine.*pair/, {
    'app.js': "import './renamed-loader.js'; new URL('./renamed-data.wasm', import.meta.url);",
  });
});
test('existing-dist package cannot hide an orphan harness next to the engine', () => {
  rejected(wasm(), bindings, /exactly one.*WASM/, { 'unused.wasm': wasm(['benchmark']) });
});
test('existing-dist package preserves valid renamed production artifacts', () => {
  const f = fixture();
  try {
    const r = f.run();
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^ok package [0-9a-f]{64} /);
    const raw = gunzipSync(readFileSync(join(f.dir, 'tmp/lkjstr-dist.tar.gz')));
    assert.ok(raw.includes(wasm()));
    assert.ok(raw.includes(Buffer.from(bindings)));
  } finally {
    f.close();
  }
});
test('mock package with an orphan WASM still fails the original reachable graph check', () => {
  rejected(wasm(), 'export const mock=true;', /no reachable app .js and .wasm graph/);
});
