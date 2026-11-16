import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliver, fixture, hello, welcome } from './engine-transport-fixture.mjs';

const invoice = (req) => ({ t: 'act', req, action: {
  a: 'zap.invoice', as: 'a'.repeat(64),
  intent: { target: { k: 'profile', pubkey: 'b'.repeat(64) }, amountMsat: 21000, comment: 'owned fixture' },
} });
const result = (messages, req) => messages.filter((m) => m.t === 'result' && m.req === req);
const ready = { t: 'ready', version: 9, engine: 'fixture' };

test('cancelled invoice never reaches a SharedWorker when initial ready is delayed', () => {
  fixture((transport, port) => {
    const received = [];
    transport.listen((m) => received.push(m));
    transport.post(invoice('cancel-before-ready'));
    transport.post({ t: 'zap.close', req: 'cancel-before-ready' });
    assert.deepEqual(result(received, 'cancel-before-ready'), [
      { t: 'result', req: 'cancel-before-ready', ok: false, cancelled: true },
    ]);
    deliver(port, ready);
    deliver(port, ready);
    assert.equal(port.sent.some((m) => m.t === 'act'), false);
    assert.equal(result(received, 'cancel-before-ready').length, 1);
  });
});

test('cancel before fallback leader election removes the queued invoice', () => {
  fixture((transport, _port, state) => {
    const received = [];
    transport.listen((m) => received.push(m));
    transport.post(invoice('cancel-before-leader'));
    transport.post({ t: 'zap.close', req: 'cancel-before-leader' });
    assert.equal(result(received, 'cancel-before-leader')[0]?.cancelled, true);
    void state.lead();
    const port = state.pairs[0].port1;
    deliver(port, ready);
    assert.equal(port.sent.some((m) => m.t === 'act'), false);
  }, true);
});

test('cancel before follower welcome cannot be forwarded after delayed ready', () => {
  fixture((transport, _port, state) => {
    const received = [], channel = state.channels[0];
    transport.listen((m) => received.push(m));
    transport.post(invoice('cancel-before-welcome'));
    transport.post({ t: 'zap.close', req: 'cancel-before-welcome' });
    assert.equal(result(received, 'cancel-before-welcome')[0]?.cancelled, true);
    welcome(channel, 'current-leader');
    deliver(channel, { to: hello(channel).from, epoch: 'current-leader', msg: ready });
    assert.equal(channel.sent.some((m) => m.msg?.t === 'act'), false);
  }, true);
});

test('live invoice cancellation waits for the owning Worker acknowledgement', () => {
  fixture((transport, port) => {
    const received = [];
    transport.listen((m) => received.push(m));
    deliver(port, ready);
    const action = invoice('live');
    transport.post(action);
    transport.post({ t: 'zap.close', req: 'live' });
    assert.deepEqual(port.sent, [action, { t: 'zap.close', req: 'live' }]);
    assert.deepEqual(result(received, 'live'), []);
    deliver(port, { t: 'result', req: 'live', ok: false, cancelled: true });
    assert.equal(result(received, 'live').length, 1);
  });
});

test('zap close cannot remove an unrelated queued upload', () => {
  fixture((transport, port) => {
    const received = [], action = { t: 'act', req: 'upload', action: {
      a: 'upload', as: 'a'.repeat(64), bytes: new ArrayBuffer(1), name: 'fixture', mime: 'text/plain',
    } };
    transport.listen((m) => received.push(m));
    transport.post(action);
    transport.post({ t: 'zap.close', req: 'upload' });
    assert.deepEqual(result(received, 'upload'), []);
    deliver(port, ready);
    assert.equal(port.sent.filter((m) => m.t === 'act').length, 1);
  });
});

test('a duplicate request cannot grow the startup queue or create a second invoice', () => {
  fixture((transport, port) => {
    for (let n = 0; n < 256; n++) transport.post(invoice('same-owner'));
    deliver(port, ready);
    assert.equal(port.sent.filter((m) => m.t === 'act').length, 1);
  });
});

const read = (t, req) => ({ t, req, query: { target: { k: 'profile', pubkey: 'b'.repeat(64) }, ...(t === 'zap.receipts' ? { limit: 20 } : {}) } });
for (const kind of ['zap.quote', 'zap.receipts']) {
  test(kind + ' survives initial fallback leader election and is forwarded once', () => {
    fixture((transport, _port, state) => {
      const request = read(kind, 'read-before-leader');
      transport.post(request);
      void state.lead();
      const port = state.pairs[0].port1;
      deliver(port, ready);
      deliver(port, ready);
      assert.deepEqual(port.sent.filter((m) => m.t === kind), [request]);
    }, true);
  });
  test(kind + ' closed before follower welcome is never forwarded', () => {
    fixture((transport, _port, state) => {
      const channel = state.channels[0];
      transport.post(read(kind, 'closed-read'));
      transport.post({ t: 'zap.close', req: 'closed-read' });
      welcome(channel, 'new-leader');
      deliver(channel, { to: hello(channel).from, epoch: 'new-leader', msg: ready });
      assert.equal(channel.sent.some((m) => m.msg?.t === kind), false);
    }, true);
  });
  test(kind + ' reconnect fails the old read once and holds a reentrant retry until ready', () => {
    fixture((transport, port, state) => {
      const received = [], request = read(kind, 'replace-read');
      let retried = false;
      transport.listen((m) => {
        received.push(m);
        if (m.t === kind && !retried) {
          retried = true;
          transport.post(request);
        }
      });
      deliver(port, ready);
      transport.post(request);
      deliver(port, { t: 'reconnect' });
      const current = state.ports.at(-1);
      assert.notEqual(current, port);
      assert.equal(received.filter((m) => m.t === kind).length, 1);
      const failed = received.find((m) => m.t === kind);
      assert.equal((failed.quote ?? failed.page).phase, 'failed');
      assert.equal((failed.quote ?? failed.page).error, 'network');
      assert.equal(current.sent.some((m) => m.t === kind), false);
      deliver(port, { t: kind, req: request.req, quote: { phase: 'ready' }, page: { phase: 'ready' } });
      assert.equal(received.filter((m) => m.t === kind).length, 1);
      deliver(current, ready);
      assert.deepEqual(current.sent.filter((m) => m.t === kind), [request]);
    });
  });
}

test('queued finite zap reads stay bounded and share request ownership with actions', () => {
  fixture((transport, _port, state) => {
    const received = [];
    transport.listen((m) => received.push(m));
    for (let n = 0; n < 32; n++) transport.post(read('zap.quote', 'bounded-' + n));
    transport.post(invoice('bounded-0'));
    const failures = received.filter((m) => m.t === 'zap.quote' && m.quote.error === 'too-large');
    assert.equal(failures.length, 16);
    void state.lead();
    const port = state.pairs[0].port1;
    deliver(port, ready);
    assert.equal(port.sent.filter((m) => m.t === 'zap.quote').length, 16);
    assert.equal(port.sent.some((m) => m.t === 'act'), false);
  }, true);
});

test('closing an owned queued read cannot leave a duplicate invoice behind', () => {
  fixture((transport, port) => {
    transport.post(read('zap.quote', 'one-owner'));
    transport.post(invoice('one-owner'));
    transport.post({ t: 'zap.close', req: 'one-owner' });
    deliver(port, ready);
    assert.equal(port.sent.some((m) => m.t === 'act' || m.t === 'zap.quote'), false);
  });
});

for (const kind of ['zap.quote', 'zap.receipts']) {
  test(kind + ' closed before SharedWorker ready never reaches the Worker', () => {
    fixture((transport, port) => {
      transport.post(read(kind, 'closed-shared-read'));
      transport.post({ t: 'zap.close', req: 'closed-shared-read' });
      deliver(port, ready);
      assert.equal(port.sent.some((m) => m.t === kind), false);
    });
  });
}

test('finite zap read byte bound rejects oversized UTF-8 before queuing', () => {
  fixture((transport, port) => {
    const received = [];
    transport.listen((m) => received.push(m));
    for (const [req, extra] of [['ascii', 'x'.repeat(4096)], ['utf8', '\u3042'.repeat(1400)]]) {
      const request = read('zap.quote', req);
      request.query.extra = extra;
      transport.post(request);
    }
    assert.deepEqual(received.map((m) => m.quote.error), ['too-large', 'too-large']);
    deliver(port, ready);
    assert.equal(port.sent.some((m) => m.t === 'zap.quote'), false);
  });
});

test('finite zap read byte bound snapshots caller-owned objects before delayed ready', () => {
  fixture((transport, port) => {
    const request = read('zap.quote', 'snapshot');
    const expected = structuredClone(request);
    transport.post(request);
    request.query.target.pubkey = 'c'.repeat(64);
    request.query.extra = 'x'.repeat(100_000);
    deliver(port, ready);
    assert.deepEqual(port.sent.filter((m) => m.t === 'zap.quote'), [expected]);
  });
});
