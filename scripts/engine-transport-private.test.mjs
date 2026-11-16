import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import { workerTransport } from '../engine/transport.js';

function fixture(run) {
  const descriptors = new Map();
  const ports = [];
  const set = (name, value) => {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  set('crypto', webcrypto);
  set('SharedWorker', class {
    constructor() {
      this.port = { sent: [], onmessage: null, start() {}, close() {},
        postMessage(message) { this.sent.push(message); } };
      ports.push(this.port);
    }
  });
  set('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} });
  set('addEventListener', () => {});
  set('removeEventListener', () => {});
  const transport = workerTransport();
  try { run(transport, ports[0]); }
  finally {
    transport.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}
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
