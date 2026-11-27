import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture, hello, welcome } from './engine-transport-fixture.mjs';

const query = { account: 'a'.repeat(64), conversation: 'b'.repeat(64), before: 'c'.repeat(64) };

test('replay opens a retained hidden private view atomically without losing its query', () => {
  fixture((transport, port) => {
    transport.post({ t: 'dm.open', sub: 'hidden', query });
    transport.post({ t: 'dm.visible', sub: 'hidden', visible: false });
    port.sent.length = 0;
    port.onmessage({ data: { t: 'ready', engine: 'fixture', version: 7 } });
    assert.deepEqual(port.sent, [{ t: 'dm.open', sub: 'hidden', query, visible: false }]);
    transport.post({ t: 'dm.visible', sub: 'hidden', visible: true });
    port.sent.length = 0;
    port.onmessage({ data: { t: 'ready', engine: 'fixture', version: 7 } });
    assert.deepEqual(port.sent, [{ t: 'dm.open', sub: 'hidden', query, visible: true }]);
    transport.post({ t: 'dm.close', sub: 'hidden' });
    port.sent.length = 0;
    port.onmessage({ data: { t: 'ready', engine: 'fixture', version: 7 } });
    assert.deepEqual(port.sent, []);
  });
});

test('pageHidden reaches the Worker before any private open during replay', () => {
  fixture((transport, port) => {
    const hint = { t: 'hint', hint: { visibleSubs: [], pageHidden: true, idle: false, saveData: false } };
    transport.post({ t: 'dm.open', sub: 'page-hidden', query, visible: true });
    transport.post(hint);
    port.sent.length = 0;
    port.onmessage({ data: { t: 'ready', engine: 'fixture', version: 7 } });
    assert.deepEqual(port.sent, [hint, { t: 'dm.open', sub: 'page-hidden', query, visible: true }]);
  });
});

test('an initially hidden private query stays hidden without a separate visibility message', () => {
  fixture((transport, port) => {
    transport.post({ t: 'dm.open', sub: 'initial-hidden', query, visible: false });
    port.sent.length = 0;
    port.onmessage({ data: { t: 'ready', engine: 'fixture', version: 7 } });
    assert.deepEqual(port.sent, [{ t: 'dm.open', sub: 'initial-hidden', query, visible: false }]);
  });
});

test('an upload cancelled before ready cannot be replayed with its bytes', () => {
  fixture((transport, port) => {
    const received = [];
    transport.listen((m) => received.push(m));
    const bytes = new ArrayBuffer(8);
    transport.post({ t: 'act', req: 'queued-upload', action: { a: 'upload', as: 'fixture', bytes, name: 'file.png', mime: 'image/png' } }, [bytes]);
    assert.equal(port.sent.length, 0);
    transport.post({ t: 'upload.cancel', req: 'queued-upload' });
    assert.deepEqual(received, [{ t: 'result', req: 'queued-upload', ok: false, cancelled: true }]);
    port.onmessage({ data: { t: 'ready', version: 7, engine: 'fixture' } });
    assert.equal(port.sent.some((m) => m.t === 'act'), false);
    assert.equal(bytes.byteLength, 8);
  });
});


test('retired SharedWorker callbacks cannot deliver releases or reconnect a newer connection', () => {
  fixture((transport, first, state) => {
    const received = [];
    transport.listen((m) => received.push(m));
    deliver(first, { t: 'ready', version: 8, engine: 'first' });
    const retiredMessage = first.onmessage, retiredError = state.workers[0].onerror;
    retiredError();
    deliver(state.ports[1], { t: 'ready', version: 8, engine: 'second' });
    received.length = 0;
    retiredMessage({ data: { t: 'dm.flush', req: 'old', account: query.account, phase: 'release' } });
    assert.deepEqual(received, []);
    retiredError();
    assert.equal(state.workers.length, 2);
  });
});

test('public-key requests are forwarded with other Worker traffic and drop on retirement', () =>
  fixture((transport, first, state) => {
    const received = [];
    transport.listen((message) => received.push(message));
    deliver(first, { t: 'ready', version: 8, engine: 'first' });
    const retired = first.onmessage;
    const request = { t: 'getPublicKey', req: 'discover' };
    deliver(first, request);
    assert.equal(received.at(-1), request);
    state.workers[0].onerror();
    retired({ data: request });
    assert.equal(received.filter((m) => m === request).length, 1);
  }));

test('a follower rejects old-leader output after the current leader prepares a lock', () => {
  fixture((transport, _port, state) => {
    const channel = state.channels[0], received = [];
    transport.listen((m) => received.push(m));
    welcome(channel, 'old-epoch');
    deliver(channel, { leader: true, epoch: 'new-epoch' });
    welcome(channel, 'new-epoch');
    const client = hello(channel).from;
    deliver(channel, { to: client, epoch: 'new-epoch', msg: { t: 'dm.flush', req: 'one', account: query.account, phase: 'prepare' } });
    deliver(channel, { to: client, epoch: 'old-epoch', msg: { t: 'dm.flush', req: 'one', account: query.account, phase: 'release' } });
    assert.deepEqual(received.filter((m) => m.t === 'dm.flush').map((m) => m.phase), ['prepare']);
  }, true);
});

test('a delayed welcome cannot switch a follower back to a retired leader', () => {
  fixture((transport, _port, state) => {
    const channel = state.channels[0], initial = hello(channel);
    welcome(channel, 'old-epoch', initial);
    deliver(channel, { leader: true, epoch: 'new-epoch' });
    welcome(channel, 'new-epoch');
    welcome(channel, 'old-epoch', initial);
    transport.post({ t: 'heartbeat' });
    assert.equal(channel.sent.at(-1).epoch, 'new-epoch');
  }, true);
});

test('a retired leader port cannot label its queued output with the replacement epoch', () => {
  fixture((transport, _port, state) => {
    void state.lead();
    const channel = state.channels[0];
    deliver(channel, { hello: true, from: 'other-page', join: 'other-join' });
    const retired = state.pairs[1].port1.onmessage;
    for (const now of [20_000, 40_000, 61_000]) {
      state.now = now;
      state.tick();
    }
    const count = channel.sent.length;
    retired({ data: { t: 'dm.flush', req: 'old', account: query.account, phase: 'release' } });
    assert.equal(channel.sent.length, count);
    assert.equal(state.workers.length, 2);
  }, true);
});

test('one hello accepts only one welcome across overlapping leader handoff delivery', () => {
  fixture((transport, _port, state) => {
    const channel = state.channels[0], request = hello(channel);
    welcome(channel, 'current-epoch', request);
    welcome(channel, 'retired-epoch', request);
    transport.post({ t: 'heartbeat' });
    assert.equal(channel.sent.at(-1).epoch, 'current-epoch');
  }, true);
});

test('current leader welcomes a returning peer and keeps its bidirectional route usable', () => {
  fixture((_transport, _port, state) => {
    void state.lead();
    const channel = state.channels[0];
    deliver(channel, { hello: true, from: 'peer', join: 'first-join' });
    const peer = state.pairs[1].port1, epoch = channel.sent.at(-1).epoch;
    deliver(channel, { hello: true, from: 'peer', join: 'second-join' });
    assert.equal(state.pairs.length, 2);
    assert.deepEqual(channel.sent.at(-1), { to: 'peer', epoch, welcome: true, join: 'second-join' });
    deliver(channel, { from: 'peer', epoch, msg: { t: 'heartbeat' } });
    assert.deepEqual(peer.sent, [{ t: 'heartbeat' }]);
    deliver(peer, { t: 'heartbeat' });
    assert.deepEqual(channel.sent.at(-1), { to: 'peer', epoch, msg: { t: 'heartbeat' } });
  }, true);
});
