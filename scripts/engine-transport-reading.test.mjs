import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture } from './engine-transport-fixture.mjs';
const open = { t: 'open', sub: 'view', query: { source: 'global' } };
const window = { t: 'window', sub: 'view', anchor: { key: 'retained-end' }, before: 6000, after: 60 };
const reading = { t: 'reading', sub: 'view', key: 'middle-reader' };
const rows = (key) => ({ t: 'rows', sub: 'view', rows: [{ kind: 'note', key }], atTop: false, atBottom: false });
test('reconnect restores current reading only after that row is delivered', () => {
  fixture((transport, first, state) => {
    transport.post(open); transport.post(window); transport.post(reading);
    deliver(first, { t: 'ready', version: 9, engine: 'fixture' });
    state.workers[0].onerror();
    const port = state.ports[1];
    deliver(port, { t: 'ready', version: 9, engine: 'replacement' });
    assert.equal(port.sent.some((m) => m.t === 'reading'), false);
    deliver(port, rows('retained-end'));
    assert.equal(port.sent.some((m) => m.t === 'reading'), false);
    deliver(port, rows(reading.key));
    assert.deepEqual(port.sent.filter((m) => m.t === 'reading'), [reading]);
    assert.deepEqual(port.sent.filter((m) => m.t === 'window').at(-1), window);
  });
});
test('close and query replacement release the previous reading intent', () => {
  fixture((transport, port) => {
    transport.post(open); transport.post(reading);
    transport.post({ ...open, query: { source: 'search', text: 'changed' } });
    port.sent.length = 0;
    deliver(port, rows(reading.key));
    assert.equal(port.sent.length, 0);
    transport.post(reading);
    transport.post({ t: 'close', sub: 'view' });
    port.sent.length = 0;
    transport.post(reading);
    deliver(port, rows(reading.key));
    assert.equal(port.sent.length, 0);
  });
});
test('reading hints retain one bounded immutable key for the owning subscription', () => {
  fixture((transport, port) => {
    transport.post(open);
    const mutable = { ...reading };
    transport.post(mutable);
    mutable.key = 'changed-outside-transport';
    transport.post({ ...reading, key: 'x'.repeat(257) });
    transport.post({ ...reading, sub: 'unknown' });
    port.sent.length = 0;
    deliver(port, rows(reading.key));
    assert.deepEqual(port.sent, [reading]);
  });
});
