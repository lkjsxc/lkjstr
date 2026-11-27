import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { workerBoot } from './engine-harness-boot.mjs';
import { signerEpochInBudget } from './engine-upload-review.mjs';

test('upload clock advances with or without a reply port', async () => {
  const self = {};
  const source = workerBoot('/worker.js', 'http://localhost');
  const dependency = "import init, { start } from './lkjstr_engine.js';";
  assert.ok(source.includes(dependency));
  // Exercise the emitted handler with only the WASM dependency replaced.
  const boot = source.replace(dependency, `
    const init = async () => {};
    const start = () => { self.onmessage = () => {}; return {}; };
  `);
  await runInNewContext(`(async () => { ${boot} })()`, { self });
  self.onmessage({ data: { t: 'test.uploadClock', ms: 100 }, ports: [] });
  assert.equal(self.__lkjstrTestDeadlineOffsetMs, 100);
  const replies = [];
  self.onmessage({
    data: { t: 'test.uploadClock', ms: 25 },
    ports: [{ postMessage: value => replies.push(value), close: () => replies.push('closed') }],
  });
  assert.deepEqual(replies, [true, 'closed']);
  assert.equal(self.__lkjstrTestDeadlineOffsetMs, 125);
});

test('upload review rejects zero, stale, future and non-integer signer epochs', () => {
  const now = 1_800_000_000_000;
  for (const epoch of [now - 5000, now, now + 10_000])
    assert.equal(signerEpochInBudget(epoch, now), true);
  for (const epoch of [0, now - 5001, now + 10_001, now + 0.5, NaN, undefined])
    assert.equal(signerEpochInBudget(epoch, now), false);
});
