import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Extension } from '../src/engine/client-crypto.ts';
import { createExtensionClient } from '../src/engine/client-extension.ts';
import { type SignerWait, waitForInjection } from '../src/engine/extension-wait.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';

const injected = window as { nostr?: Extension };
const sign = { t: 'sign', req: 'post', pubkey: 'owner', event: '{}' } as const;
const discover = { t: 'getPublicKey', req: 'sign-in' } as const;
const delayed = <T>(value: T, ms: number) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});
afterEach(() => {
  delete injected.nostr;
  vi.useRealTimers();
});
function harness(request: FromEngine = sign) {
  const sent: ToEngine[] = [];
  const stages: SignerWait[] = [];
  const client = createExtensionClient((message) => sent.push(message));
  const pressedAt = performance.now();
  client.receive(
    request,
    () => true,
    () => ({
      pressedAt,
      cancelled: false,
      wait: (stage) => stages.push(stage),
    }),
  );
  return { sent, stages, client };
}
it.each([sign, discover])(
  'fast 50ms $t never names a wait and has no extra delay',
  async (request) => {
    const getPublicKey = vi.fn(() => delayed('owner', 50));
    const signEvent = vi.fn(() => delayed({ id: 'signed' }, 50));
    injected.nostr = { getPublicKey, signEvent };
    const { sent, stages } = harness(request);
    await vi.advanceTimersByTimeAsync(49);
    expect(sent).toEqual([]);
    expect(stages).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([
      request.t === 'sign'
        ? { t: 'signed', req: 'post', event: '{"id":"signed"}' }
        : { t: 'publicKey', req: 'sign-in', pubkey: 'owner' },
    ]);
    expect(stages).toEqual([]);
    expect(getPublicKey).toHaveBeenCalledTimes(request.t === 'sign' ? 0 : 1);
    expect(signEvent).toHaveBeenCalledTimes(request.t === 'sign' ? 1 : 0);
  },
);
it.each([sign, discover])('late injection at 1.5s: finding then fast $t', async (request) => {
  const signEvent = vi.fn(() => delayed({ id: 'signed' }, 50));
  const getPublicKey = vi.fn(() => delayed('owner', 50));
  setTimeout(() => {
    injected.nostr = { signEvent, getPublicKey };
  }, 1500);
  const { sent, stages } = harness(request);
  await vi.advanceTimersByTimeAsync(999);
  expect(stages).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(stages).toEqual(['finding']);
  await vi.advanceTimersByTimeAsync(550);
  expect(stages).toEqual(['finding', undefined]);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ t: request.t === 'sign' ? 'signed' : 'publicKey' });
  expect(signEvent).toHaveBeenCalledTimes(request.t === 'sign' ? 1 : 0);
  expect(getPublicKey).toHaveBeenCalledTimes(request.t === 'sign' ? 0 : 1);
});
it.each([sign, discover])(
  '20s $t approval can be cancelled once; late reply is dropped',
  async (request) => {
    injected.nostr = {
      signEvent: () => delayed({ id: 'late' }, 20_000),
      getPublicKey: () => delayed('owner', 20_000),
    };
    const { sent, stages, client } = harness(request);
    await vi.advanceTimersByTimeAsync(999);
    expect(stages).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(stages).toEqual(['approval']);
    client.cancel(request.req, undefined, true);
    client.cancel(request.req, undefined, true);
    const cancelled = {
      t: request.t === 'sign' ? 'signed' : 'publicKey',
      req: request.req,
      error: 'cancelled',
    };
    expect(sent).toEqual([cancelled]);
    expect(stages).toEqual(['approval', undefined]);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(sent).toEqual([cancelled]);
  },
);
it.each([sign, discover])('refusal of $t remains a refusal', async (request) => {
  const refuse = async () => {
    throw new Error('extension refused');
  };
  injected.nostr = { getPublicKey: refuse, signEvent: refuse };
  const { sent, stages } = harness(request);
  await vi.advanceTimersByTimeAsync(1);
  expect(stages).toEqual([]);
  expect(sent).toEqual([
    { t: request.t === 'sign' ? 'signed' : 'publicKey', req: request.req, error: 'signer-refused' },
  ]);
});
it('polls at 100ms and releases the timer immediately on abort', async () => {
  const abort = new AbortController();
  const lookup = vi.fn(() => undefined);
  const result = expect(
    waitForInjection(lookup, { signal: abort.signal, pressedAt: performance.now() }),
  ).rejects.toThrow('cancelled');
  await vi.advanceTimersByTimeAsync(299);
  expect(lookup).toHaveBeenCalledTimes(3);
  abort.abort();
  await result;
  await vi.advanceTimersByTimeAsync(4000);
  expect(lookup).toHaveBeenCalledTimes(3);
});
it('honors the load deadline and a minimum of one second for a later press', async () => {
  // A synthetic document has completed load by the time the module is imported.
  const a = harness();
  await vi.advanceTimersByTimeAsync(3100);
  expect(a.sent).toEqual([{ t: 'signed', req: 'post', error: 'signer-missing' }]);
  const b = harness();
  await vi.advanceTimersByTimeAsync(999);
  expect(b.sent).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(b.sent).toEqual([{ t: 'signed', req: 'post', error: 'signer-missing' }]);
});
it('cancellation before the Worker request arrives never invokes an extension', () => {
  const sent: ToEngine[] = [];
  const signEvent = vi.fn();
  injected.nostr = { signEvent };
  const client = createExtensionClient((message) => sent.push(message));
  client.receive(
    sign,
    () => false,
    () => ({ pressedAt: 0, cancelled: true }),
  );
  expect(sent).toEqual([{ t: 'signed', req: 'post', error: 'cancelled' }]);
  expect(signEvent).not.toHaveBeenCalled();
});
it('releases an injection search on pagehide even without an owner cancellation', async () => {
  const lookup = vi.fn(() => undefined);
  const result = expect(
    waitForInjection(lookup, {
      signal: new AbortController().signal,
      pressedAt: performance.now(),
    }),
  ).rejects.toThrow('cancelled');
  await vi.advanceTimersByTimeAsync(100);
  window.dispatchEvent(new Event('pagehide'));
  await result;
  await vi.advanceTimersByTimeAsync(4000);
  expect(lookup).toHaveBeenCalledTimes(2);
});

it('uses the remaining epoch budget after a wall clock step and polls inside 100ms', async () => {
  await vi.advanceTimersByTimeAsync(120_000);
  const wall = performance.timeOrigin + performance.now() - 60_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(wall);
  try {
    const lookup = vi.fn<() => string | undefined>().mockReturnValueOnce(undefined);
    lookup.mockReturnValue('injected');
    const result = expect(
      waitForInjection(lookup, {
        signal: new AbortController().signal,
        pressedAt: performance.now(),
        expiresAt: wall + 40,
      }),
    ).resolves.toBe('injected');
    await vi.advanceTimersByTimeAsync(39);
    expect(lookup).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(lookup).toHaveBeenCalledTimes(2);
    await result;
  } finally {
    clock.mockRestore();
  }
});

it('rejects a missing extension at a sub-100ms deadline', async () => {
  const lookup = vi.fn(() => undefined);
  const result = expect(
    waitForInjection(lookup, {
      signal: new AbortController().signal,
      pressedAt: performance.now(),
      expiresAt: Date.now() + 30,
    }),
  ).rejects.toThrow('signer-missing');
  await vi.advanceTimersByTimeAsync(29);
  expect(lookup).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(lookup).toHaveBeenCalledTimes(2);
  await result;
});

it.each(['cancel', 'sign.cancel', 'reset'] as const)(
  '%s frees a full request map synchronously without a hung signer replying',
  async (method) => {
    const signEvent = vi.fn(() => new Promise<never>(() => {}));
    injected.nostr = { signEvent };
    const sent: ToEngine[] = [];
    const client = createExtensionClient((message) => sent.push(message));
    const receive = (req: string, owned = true) =>
      client.receive({ ...sign, req, actionReq: req }, () => owned);
    for (let i = 0; i < 128; i++) receive(String(i));
    await vi.advanceTimersByTimeAsync(1);
    expect(signEvent).toHaveBeenCalledTimes(1);
    receive('overflow');
    expect(sent).toEqual([{ t: 'signed', req: 'overflow', error: 'signer-refused' }]);
    if (method === 'reset') client.reset();
    else if (method === 'cancel') client.cancel('0');
    else client.receive({ t: 'sign.cancel', req: '0' }, () => true);
    receive('0'); // reuse immediately, before the old task's finally runs
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    // An old finalizer must not remove the replacement: an unowned duplicate
    // is ignored, whereas a fresh unowned request would be refused.
    receive('0', false);
    expect(sent).toHaveLength(1);
    client.reset();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(1);
  },
);
