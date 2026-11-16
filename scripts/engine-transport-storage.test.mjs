import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture } from './engine-transport-fixture.mjs';
import { validateReplies, messageKinds } from './engine-contract.mjs';
const inspect = { t: 'storage.inspect', req: 'owned' };
const report = { startedAt: 1, finishedAt: 2, memory: { events: 0, eventPayloadBytes: 0, at: 1 },
  persistedEvents: { phase: 'ready', count: 5, at: 2 },
  origin: { phase: 'ready', usage: 20, quota: 100, at: 2, approximate: true } };
test('storage contract accepts literal true and independent failure without widening false', () => {
  validateReplies([{ t: 'storage', req: 'owned', report }]);
  validateReplies([{ t: 'storage', req: 'owned', report: { ...report, origin: { phase: 'failed' } } }]);
  assert.throws(() => validateReplies([{ t: 'storage', req: 'owned', report: { ...report, origin: { ...report.origin, approximate: false } } }]));
  assert.ok(messageKinds.includes('storage.inspect') && messageKinds.includes('storage.close'));
});
test('storage reads and cancellation forward once, with no reconnect replay', () => {
  fixture((transport, first, state) => {
    const replies = []; transport.listen((message) => replies.push(message));
    deliver(first, { t: 'ready', version: 12, engine: 'fixture' });
    transport.post(inspect); transport.post({ t: 'storage.close', req: inspect.req });
    assert.deepEqual(first.sent.filter((m) => m.t.startsWith('storage.')), [inspect, { t: 'storage.close', req: 'owned' }]);
    state.workers[0].onerror(); const replacement = state.ports[1];
    deliver(replacement, { t: 'ready', version: 12, engine: 'replacement' });
    deliver(first, { t: 'storage', req: 'owned', report });
    assert.equal(replacement.sent.some((m) => m.t.startsWith('storage.')), false);
    assert.equal(replies.some((m) => m.t === 'storage'), false);
  });
});
