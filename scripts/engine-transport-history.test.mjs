import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture, hello, welcome } from './engine-transport-fixture.mjs';

const account = 'a'.repeat(64), query = { account };
const ready = { t: 'ready', engine: 'fixture', version: 8 };
const editor = (req) => ({ t: 'act', req, action: {
  a: 'dm.editor', as: account, editor: 'retained-editor', open: true, dirty: true,
} });

test('retained history preserves the live port, pending result and private editor lease', () => {
  fixture((transport, port, state) => {
    const received = [];
    transport.listen((m) => received.push(m));
    deliver(port, ready);
    transport.post(editor('registration'));
    const from = port.sent.length;
    state.window('pagehide', { persisted: true });
    assert.equal(port.closed === true, false);
    assert.equal(port.sent.slice(from).some((m) => m.t === 'detach'), false);
    state.window('pageshow', { persisted: true });
    assert.deepEqual(port.sent.at(-1), { t: 'heartbeat' });
    deliver(port, { t: 'heartbeat' });
    deliver(port, { t: 'result', req: 'registration', ok: true });
    assert.deepEqual(received.filter((m) => m.t === 'result'),
      [{ t: 'result', req: 'registration', ok: true }]);
    transport.post(editor('current'));
    assert.deepEqual(port.sent.at(-1), editor('current'));
  });
});

test('an expired retained port reconnects without detach and rejects its old callbacks', () => {
  fixture((transport, first, state) => {
    const received = [];
    transport.listen((m) => received.push(m));
    deliver(first, ready);
    transport.post({ t: 'hint', hint: { visibleSubs: [], pageHidden: true } });
    transport.post({ t: 'dm.open', sub: 'private', query, visible: false });
    transport.post(editor('unanswered'));
    state.window('pagehide', { persisted: true });
    state.window('pageshow', { persisted: true });
    assert.deepEqual(first.sent.at(-1), { t: 'heartbeat' });
    const retired = first.onmessage;
    deliver(first, { t: 'reconnect' });
    assert.equal(first.closed, true);
    assert.equal(first.sent.some((m) => m.t === 'detach'), false);
    assert.equal(state.ports.length, 2);
    const fresh = state.ports[1];
    deliver(fresh, ready);
    assert.equal(fresh.sent.findIndex((m) => m.t === 'hint') <
      fresh.sent.findIndex((m) => m.t === 'dm.open'), true);
    assert.deepEqual(fresh.sent.find((m) => m.t === 'dm.open'),
      { t: 'dm.open', sub: 'private', query, visible: false });
    assert.deepEqual(received.find((m) => m.t === 'result' && m.req === 'unanswered'),
      { t: 'result', req: 'unanswered', ok: false, error: { code: 'offline' } });
    received.length = 0;
    deliver(fresh, { t: 'dm.flush', req: 'fresh-lock', account, phase: 'hold' });
    retired({ data: { t: 'dm.flush', req: 'fresh-lock', account, phase: 'release' } });
    assert.deepEqual(received.map((m) => m.phase), ['hold']);
    transport.post(editor('rebind'));
    assert.deepEqual(fresh.sent.at(-1), editor('rebind'));
  });
});

test('a retained follower probes its current leader without dropping the existing route', () => {
  fixture((transport, _port, state) => {
    const channel = state.channels[0];
    welcome(channel, 'current');
    const client = hello(channel).from;
    deliver(channel, { to: client, epoch: 'current', msg: ready });
    const from = channel.sent.length;
    state.window('pagehide', { persisted: true });
    assert.equal(channel.closed === true, false);
    assert.equal(channel.sent.slice(from).some((m) => m.msg?.t === 'detach'), false);
    state.window('pageshow', { persisted: true });
    assert.equal(channel.sent.slice(from).some((m) =>
      m.epoch === 'current' && m.msg?.t === 'heartbeat'), true);
    const returning = hello(channel);
    welcome(channel, 'current', returning);
    transport.post(editor('returning'));
    assert.deepEqual(channel.sent.at(-1), { from: client, epoch: 'current', msg: editor('returning') });
  }, true);
});

test('history restore accepts a new leader and cannot route back through a retired welcome', () => {
  fixture((transport, _port, state) => {
    const channel = state.channels[0], initial = hello(channel), received = [];
    transport.listen((m) => received.push(m));
    welcome(channel, 'old', initial);
    deliver(channel, { to: initial.from, epoch: 'old', msg: ready });
    state.window('pagehide', { persisted: true });
    state.window('pageshow', { persisted: true });
    const returned = hello(channel);
    assert.notEqual(returned.join, initial.join);
    welcome(channel, 'new', returned);
    deliver(channel, { to: initial.from, epoch: 'new', msg: ready });
    received.length = 0;
    deliver(channel, { to: initial.from, epoch: 'new',
      msg: { t: 'dm.flush', req: 'new-lock', account, phase: 'hold' } });
    welcome(channel, 'old', initial);
    deliver(channel, { to: initial.from, epoch: 'old',
      msg: { t: 'dm.flush', req: 'new-lock', account, phase: 'release' } });
    assert.deepEqual(received.map((m) => m.phase), ['hold']);
    transport.post(editor('new-owner'));
    assert.equal(channel.sent.at(-1).epoch, 'new');
  }, true);
});

test('a retained fallback leader keeps the Worker and peer route until actual departure', () => {
  fixture((_transport, _port, state) => {
    void state.lead();
    const channel = state.channels[0], worker = state.workers[0];
    deliver(channel, { hello: true, from: 'peer', join: 'peer-join' });
    const peer = state.pairs[1].port1, epoch = channel.sent.at(-1).epoch;
    state.window('pagehide', { persisted: true });
    assert.equal(worker.terminated === true, false);
    assert.equal(peer.closed === true, false);
    state.window('pageshow', { persisted: true });
    assert.deepEqual(state.pairs[0].port1.sent.at(-1), { t: 'heartbeat' });
    deliver(channel, { from: 'peer', epoch, msg: { t: 'heartbeat' } });
    assert.deepEqual(peer.sent.at(-1), { t: 'heartbeat' });
    state.window('pagehide', { persisted: false });
    assert.equal(worker.terminated, true);
    assert.equal(peer.closed, true);
    assert.equal(channel.closed, true);
  }, true);
});

test('ordinary navigation after history restore still detaches once and removes both handlers', () => {
  fixture((transport, port, state) => {
    deliver(port, ready);
    state.window('pagehide', { persisted: true });
    state.window('pageshow', { persisted: true });
    assert.equal(port.sent.some((m) => m.t === 'detach'), false);
    assert.equal(state.listeners('pagehide'), 1);
    assert.equal(state.listeners('pageshow'), 1);
    state.window('pagehide', { persisted: false });
    assert.equal(port.sent.filter((m) => m.t === 'detach').length, 1);
    assert.equal(port.closed, true);
    assert.equal(state.listeners('pagehide'), 0);
    assert.equal(state.listeners('pageshow'), 0);
    const count = port.sent.length;
    state.window('pageshow', { persisted: true });
    transport.post(editor('closed'));
    transport.close();
    assert.equal(port.sent.length, count);
  });
});

test('explicit disposal and an ordinary first navigation retain their detach semantics', () => {
  for (const retained of [false, true]) fixture((transport, port, state) => {
    deliver(port, ready);
    if (retained) state.window('pagehide', { persisted: true });
    if (retained) transport.close();
    else state.window('pagehide', { persisted: false });
    assert.equal(port.sent.filter((m) => m.t === 'detach').length, 1);
    assert.equal(port.closed, true);
    assert.equal(state.listeners('pagehide'), 0);
    assert.equal(state.listeners('pageshow'), 0);
  });
});

test('public signing preserves enqueue time across boot and identifies a restarted route', () => {
  fixture((transport, first, state) => {
    const post = (req) => ({ t: 'act', req, action: {
      a: 'publish', as: 'fixture', what: { k: 'note', draft: { text: 'fixture' } },
    } });
    state.now = 10;
    const click = post('boot');
    transport.post(click);
    assert.equal(first.sent.length, 0);
    assert.equal(click.signingTiming, undefined);
    state.now = 100;
    deliver(first, { t: 'ready', engine: 'fixture', version: 14 });
    assert.deepEqual(first.sent.find((message) => message.t === 'act')?.signingTiming, {
      at: 1010, hidden: false, boot: true, restart: false,
    });

    state.workers[0].onerror();
    state.now = 110;
    globalThis.document.visibilityState = 'hidden';
    transport.post(post('restart'));
    assert.deepEqual(state.ports[1].sent.find((message) => message.t === 'act')?.signingTiming, {
      at: 1110, hidden: true, boot: false, restart: true,
    });
  });
});

for (const fallback of [false, true]) test(`running ${fallback ? 'dedicated' : 'shared'} worker still expires without heartbeats`, () => {
  fixture((_transport, shared, state) => {
    if (fallback) state.lead();
    const port = fallback ? state.pairs[0].port1 : shared;
    deliver(port, ready);
    state.now = 59_000;
    deliver(port, { t: 'heartbeat' });
    state.tick();
    assert.equal(state.workers.length, 1);
    state.now = 119_001;
    state.tick();
    assert.equal(state.workers.length, 2);
    if (fallback) assert.equal(state.workers[0].terminated, true);
    else assert.equal(port.closed, true);
  }, fallback);
});
