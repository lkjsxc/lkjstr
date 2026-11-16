import { webcrypto } from 'node:crypto';
import { workerTransport } from '../engine/transport.js';

export function fixture(run, fallback = false) {
  const descriptors = new Map(), ports = [], workers = [], channels = [], pairs = [];
  const listeners = new Map(), documentListeners = new Map();
  const listen = (set, name, fn, options) => {
    const rows = set.get(name) ?? [];
    if (!rows.some((r) => r.fn === fn)) rows.push({ fn, once: options?.once === true });
    set.set(name, rows);
  };
  const unlisten = (set, name, fn) => set.set(name, (set.get(name) ?? []).filter((r) => r.fn !== fn));
  const dispatch = (set, name, event = {}) => {
    for (const row of [...(set.get(name) ?? [])]) {
      if (row.once) unlisten(set, name, row.fn);
      row.fn(event);
    }
  };
  const state = { ports, workers, channels, pairs, now: 0, tick() {}, lead() {},
    window: (name, event) => dispatch(listeners, name, event),
    document: (name, event) => dispatch(documentListeners, name, event),
    listeners: (name) => (listeners.get(name) ?? []).length,
  };
  const set = (name, value) => {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const port = () => ({ sent: [], onmessage: null, start() {}, close() { this.closed = true; },
    postMessage(message) { this.sent.push(message); } });
  set('crypto', webcrypto);
  set('performance', { now: () => state.now });
  set('setInterval', (fn) => { state.tick = fn; return 1; });
  set('clearInterval', () => {});
  set('SharedWorker', fallback ? undefined : class {
    constructor() { this.port = port(); ports.push(this.port); workers.push(this); }
  });
  set('Worker', class {
    constructor() { this.sent = []; workers.push(this); }
    postMessage(message, transfer) { this.sent.push({ message, transfer }); }
    terminate() { this.terminated = true; }
  });
  set('MessageChannel', class {
    constructor() { this.port1 = port(); this.port2 = port(); pairs.push(this); }
  });
  set('BroadcastChannel', class {
    constructor() { this.sent = []; channels.push(this); }
    postMessage(message) { this.sent.push(message); }
    close() { this.closed = true; }
  });
  set('navigator', { locks: { request(_name, _options, fn) {
    state.lead = fn; return new Promise(() => {});
  } } });
  set('document', { visibilityState: 'visible',
    addEventListener: (...args) => listen(documentListeners, ...args),
    removeEventListener: (...args) => unlisten(documentListeners, ...args),
  });
  set('addEventListener', (...args) => listen(listeners, ...args));
  set('removeEventListener', (...args) => unlisten(listeners, ...args));
  const transport = workerTransport();
  const cleanup = () => {
    transport.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
  try {
    const result = run(transport, ports[0], state, set);
    if (result?.then) return result.finally(cleanup);
    cleanup();
  } catch (error) { cleanup(); throw error; }
}
export const deliver = (port, data) => port.onmessage({ data });
export const hello = (channel) => channel.sent.findLast((m) => m.hello);
export const welcome = (channel, epoch, request = hello(channel)) =>
  deliver(channel, { to: request.from, welcome: true, join: request.join, epoch });
