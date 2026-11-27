import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { Action, FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { fixtureNow, rows } from './signer-ownership-fixture.ts';
import { deferred } from './vault-ui-fixture.ts';

const pubkey = '11'.repeat(32);
const injected = window as { nostr?: unknown };
const actions = {
  'core-publish': { a: 'publish', as: pubkey, what: { k: 'note', draft: { text: 'fixture' } } },
  'core-action': { a: 'profile.save', as: pubkey, profile: { name: 'fixture', about: '' } },
  discovery: { a: 'account.add', how: 'extension' },
  upload: {
    a: 'upload',
    as: pubkey,
    name: 'fixture.png',
    mime: 'image/png',
    bytes: new ArrayBuffer(4),
  },
  'upload-nip98': {
    a: 'upload',
    as: pubkey,
    name: 'fixture.png',
    mime: 'image/png',
    bytes: new ArrayBuffer(4),
  },
  zap: {
    a: 'zap.invoice',
    as: pubkey,
    intent: { target: { k: 'event', id: '33'.repeat(32) }, amountMsat: 1000, comment: '' },
  },
} satisfies Record<string, Action>;
type Scenario = keyof typeof rows;
function wire(scenario: Scenario, action?: string) {
  const row = rows[scenario];
  let message = structuredClone(row.message);
  if ('expiresAt' in message && message.expiresAt !== undefined)
    message = { ...message, expiresAt: performance.timeOrigin + (message.expiresAt - fixtureNow) };
  if (action && row.lifecycle === 'action-by-req') message = { ...message, req: action };
  if (action && message.t === 'sign' && row.lifecycle === 'action-by-actionReq')
    message = { ...message, actionReq: action };
  return message;
}
function page() {
  let receive: (message: FromEngine) => void = () => {};
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (message) => sent.push(message),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  });
  return {
    engine,
    receive: (message: FromEngine) => receive(message),
    action: () => {
      const last = sent.findLast((message) => message.t === 'act');
      if (last?.t !== 'act') throw new Error('no action');
      return last.req;
    },
    replies: () => sent.filter((message) => ['signed', 'publicKey', 'crypted'].includes(message.t)),
    sent,
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});
afterEach(() => {
  delete injected.nostr;
  localStorage.clear();
  vi.useRealTimers();
});

it.each(Object.keys(actions) as (keyof typeof actions)[])(
  'native %s binds to the actual pending client action and replies exactly once',
  async (scenario) => {
    const signEvent = vi.fn(async () => ({ id: 'signed' }));
    const getPublicKey = vi.fn(async () => pubkey);
    injected.nostr = { signEvent, getPublicKey };
    const p = page();
    try {
      const waiting = vi.fn();
      const result = p.engine.act(actions[scenario], { signerWait: waiting });
      const action = p.action();
      const message = wire(scenario, action);
      p.receive(message);
      await vi.advanceTimersByTimeAsync(1);
      expect(p.replies()).toEqual([
        scenario === 'discovery'
          ? { t: 'publicKey', req: message.req, pubkey }
          : { t: 'signed', req: message.req, event: '{"id":"signed"}' },
      ]);
      expect(waiting).not.toHaveBeenCalled();
      p.receive({ t: 'result', req: action, ok: true });
      expect(await result).toMatchObject({ req: action, ok: true });
    } finally {
      p.engine.dispose();
    }
  },
);

it.each(['upload', 'upload-nip98', 'zap', 'discovery'] as const)(
  'orphaned native %s is refused without opening a prompt',
  async (scenario) => {
    const signEvent = vi.fn(),
      getPublicKey = vi.fn();
    injected.nostr = { signEvent, getPublicKey };
    const p = page();
    try {
      const message = wire(scenario);
      p.receive(message);
      await vi.advanceTimersByTimeAsync(1);
      expect(p.replies()).toEqual([
        {
          t: scenario === 'discovery' ? 'publicKey' : 'signed',
          req: message.req,
          error: 'signer-refused',
        },
      ]);
      expect(signEvent).not.toHaveBeenCalled();
      expect(getPublicKey).not.toHaveBeenCalled();
    } finally {
      p.engine.dispose();
    }
  },
);

it.each(['dm-advertisement', 'dm-seal', 'auth-visible', 'auth-background', 'auth-write'] as const)(
  'authorized native %s without actionReq is a silent page-lifetime request',
  async (scenario) => {
    const signEvent = vi.fn(async () => ({ id: 'worker-signed' }));
    injected.nostr = { signEvent };
    const p = page();
    try {
      const message = wire(scenario);
      p.receive(message);
      await vi.advanceTimersByTimeAsync(1);
      expect(signEvent).toHaveBeenCalledTimes(1);
      expect(p.replies()).toEqual([
        { t: 'signed', req: message.req, event: '{"id":"worker-signed"}' },
      ]);
      expect(p.sent.some((m) => m.t === 'act')).toBe(false);
    } finally {
      p.engine.dispose();
    }
  },
);

it.each(['dispose', 'expiry', 'worker-cancel'] as const)(
  'native silent signing retires on %s',
  async (mode) => {
    const held = deferred<{ id: string }>();
    const signEvent = vi.fn(() => held.promise);
    injected.nostr = { signEvent };
    const p = page();
    try {
      p.receive(wire('dm-seal'));
      await vi.advanceTimersByTimeAsync(1);
      expect(signEvent).toHaveBeenCalledTimes(1);
      p.receive(wire('auth-background'));
      await vi.advanceTimersByTimeAsync(1);
      expect(signEvent).toHaveBeenCalledTimes(1);
      if (mode === 'dispose') p.engine.dispose();
      else if (mode === 'worker-cancel') {
        p.receive(wire('dm-seal-cancel'));
        // The separate queued request remains valid; explicitly retire it at its page deadline.
        await vi.advanceTimersByTimeAsync(60_000);
      } else await vi.advanceTimersByTimeAsync(60_000);
      held.resolve({ id: 'late' });
      await vi.advanceTimersByTimeAsync(1);
      expect(p.replies()).toEqual([]);
      expect(signEvent).toHaveBeenCalledTimes(1);
      if (mode !== 'dispose') {
        signEvent.mockResolvedValue({ id: 'new' });
        const fresh = wire('dm-advertisement');
        if (fresh.t !== 'sign') throw new Error('sign');
        p.receive({ ...fresh, expiresAt: performance.timeOrigin + performance.now() + 60_000 });
        await vi.advanceTimersByTimeAsync(1);
        expect(p.replies()).toEqual([{ t: 'signed', req: fresh.req, event: '{"id":"new"}' }]);
      }
    } finally {
      if (mode !== 'dispose') p.engine.dispose();
    }
  },
);

it('correlated extension sign-in cancellation replies once and suppresses late approval', async () => {
  const held = deferred<string>();
  injected.nostr = { getPublicKey: () => held.promise };
  const p = page();
  try {
    const abort = new AbortController();
    const result = p.engine.act(actions.discovery, { signerSignal: abort.signal });
    const req = p.action();
    p.receive(wire('discovery', req));
    await vi.advanceTimersByTimeAsync(1000);
    abort.abort();
    expect(p.replies()).toEqual([{ t: 'publicKey', req, error: 'cancelled' }]);
    held.resolve(pubkey);
    p.receive({ t: 'result', req, ok: false, error: { code: 'cancelled' } });
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ req, ok: false });
    expect(p.replies()).toHaveLength(1);
  } finally {
    p.engine.dispose();
  }
});

it('native upload cancellation retires by sign req, not the action ID', async () => {
  const held = deferred<{ id: string }>();
  const signEvent = vi.fn(() => held.promise);
  injected.nostr = { signEvent };
  const p = page();
  try {
    const abort = new AbortController();
    const result = p.engine.act(actions.upload, { uploadSignal: abort.signal });
    const req = p.action();
    p.receive(wire('upload', req));
    await vi.advanceTimersByTimeAsync(1);
    expect(signEvent).toHaveBeenCalledTimes(1);
    abort.abort();
    expect(p.sent).toContainEqual({ t: 'upload.cancel', req });
    p.receive(wire('upload-cancel'));
    p.receive({ t: 'result', req, ok: false, cancelled: true });
    held.resolve({ id: 'late' });
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ req, cancelled: true });
    expect(p.replies()).toEqual([]);
  } finally {
    p.engine.dispose();
  }
});
