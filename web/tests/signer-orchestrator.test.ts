import { afterEach, expect, it, vi } from 'vitest';
import { createExtensionDecrypts } from '../src/engine/client-dm-decrypt.ts';
import { createExtensionClient } from '../src/engine/client-extension.ts';
import type { ToEngine } from '../src/engine/protocol.ts';
import {
  BACKGROUND_INTERVAL_MS,
  createSignerOrchestrator,
  EXTENSION_DEADLINE_MS,
} from '../src/engine/signer-orchestrator.ts';
import { deferred, tick } from './vault-ui-fixture.ts';

afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
  vi.useRealTimers();
});

it('dispatches Post, interactive work and visible reads ahead of a background burst', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const queue = createSignerOrchestrator();
  const lookup = deferred<string>();
  const order: string[] = [];
  const first = queue.run(1, async (call) => {
    await call(() => {
      order.push('lookup');
      return lookup.promise;
    });
    return call(async () => order.push('decrypt'));
  });
  await tick();
  const passive = Array.from({ length: 8 }, (_, n) =>
    queue.run(2, (call) => call(async () => order.push(`passive ${n}`))),
  );
  const burst = Promise.allSettled(passive);
  const post = queue.run(16, (call) => call(async () => order.push('post')));
  const user = queue.run(8, (call) => call(async () => order.push('lookup account')));
  const visible = queue.run(4, (call) => call(async () => order.push('visible decrypt')));
  expect(queue.stats()).toMatchObject({ pending: 12, callsPerMinute: 1, latencyMs: null });
  lookup.resolve('owner');
  await Promise.all([first, post, user, visible]);
  expect(order).toEqual(['lookup', 'post', 'lookup account', 'visible decrypt', 'decrypt']);
  await vi.advanceTimersByTimeAsync(BACKGROUND_INTERVAL_MS);
  await passive[0];
  expect(order.slice(5)).toEqual(['passive 0']);
  await vi.advanceTimersByTimeAsync(BACKGROUND_INTERVAL_MS);
  await passive[1];
  expect(order.slice(5)).toEqual(['passive 0', 'passive 1']);
  queue.reset();
  await burst;
  expect(queue.stats()).toMatchObject({ pending: 0, callsPerMinute: 7, timeouts: 0 });
  expect(queue.stats().latencyMs).toBeGreaterThanOrEqual(0);
});

it('drops a cancelled queued call and opens a new slot after an unanswered method times out', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const queue = createSignerOrchestrator();
  const late = deferred<string>();
  const active = queue.run(8, (call) => call(() => late.promise));
  const timedOut = expect(active).rejects.toThrow('signer-timeout');
  await tick();
  const abort = new AbortController();
  const decrypt = vi.fn(async () => 'late private reply');
  const abandoned = expect(queue.run(1, (call) => call(decrypt), abort.signal)).rejects.toThrow(
    'cancelled',
  );
  abort.abort();
  await abandoned;
  await vi.advanceTimersByTimeAsync(1000);
  const post = queue.run(16, (call) => call(async () => 'signed'));
  expect(queue.stats().pending).toBe(2);
  await vi.advanceTimersByTimeAsync(EXTENSION_DEADLINE_MS - 1000);
  await timedOut;
  await expect(post).resolves.toBe('signed');
  late.resolve('stale reply');
  expect(decrypt).not.toHaveBeenCalled();
  expect(queue.stats()).toMatchObject({ pending: 0, timeouts: 1, callsPerMinute: 1 });
});

it('computes the median of the most recent twenty replies and ages out the call rate', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const queue = createSignerOrchestrator();
  for (let ms = 10; ms <= 210; ms += 10) {
    const done = queue.run(8, (call) =>
      call(() => new Promise((answer) => setTimeout(answer, ms))),
    );
    await vi.advanceTimersByTimeAsync(ms);
    await done;
  }
  expect(queue.stats()).toMatchObject({ latencyMs: 115, callsPerMinute: 21, timeouts: 0 });
  await vi.advanceTimersByTimeAsync(60000);
  expect(queue.stats()).toMatchObject({ latencyMs: 115, callsPerMinute: 0 });
});

it('expires an auxiliary request in the queue at the Worker deadline', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const queue = createSignerOrchestrator();
  const held = deferred<string>();
  const post = queue.run(16, (call) => call(() => held.promise));
  const authorize = vi.fn(async () => 'signed authorization');
  const deadline = performance.timeOrigin + performance.now() + 500;
  const refused = expect(
    queue.run(8, (call) => call(authorize), undefined, deadline),
  ).rejects.toThrow('signer-timeout');
  await vi.advanceTimersByTimeAsync(500);
  await refused;
  held.resolve('signed Post');
  await post;
  expect(authorize).not.toHaveBeenCalled();
  expect(queue.stats()).toMatchObject({ pending: 0, timeouts: 1, callsPerMinute: 1 });
});

it('shares a pending decrypt until the last authorized consumer cancels', async () => {
  const queue = createSignerOrchestrator();
  const decrypt = createExtensionDecrypts(queue);
  const first = new AbortController();
  const second = new AbortController();
  const raw = deferred<string>();
  const decryptMethod = vi.fn(() => raw.promise);
  (window as { nostr?: unknown }).nostr = {
    getPublicKey: async () => 'owner',
    nip44: { decrypt: decryptMethod },
  };
  const request = {
    t: 'crypt',
    req: 'first',
    pubkey: 'owner',
    peer: 'peer',
    operation: 'nip44.decrypt',
    data: 'cipher fixture',
  } as const;
  const a = expect(decrypt(request, 4, 0, () => {}, first.signal)).rejects.toThrow('cancelled');
  const b = decrypt({ ...request, req: 'second' }, 4, 0, () => {}, second.signal);
  await vi.waitFor(() => expect(decryptMethod).toHaveBeenCalledTimes(1));
  first.abort();
  await a;
  raw.resolve('plain fixture');
  await expect(b).resolves.toBe('plain fixture');
  expect(decryptMethod).toHaveBeenCalledTimes(1);
  expect(queue.stats().callsPerMinute).toBe(3);
});

it('does not send a discovery reply across a Worker restart', async () => {
  const sent: ToEngine[] = [];
  const key = deferred<string>();
  const getPublicKey = vi.fn(() => key.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey };
  const ext = createExtensionClient((message) => sent.push(message));
  ext.receive({ t: 'getPublicKey', req: 'old' }, (req) => req === 'old');
  await tick();
  expect(getPublicKey).toHaveBeenCalledTimes(1);
  expect(sent).toEqual([]);
  ext.receive({ t: 'reconnect' }, () => false);
  key.resolve('old key');
  await tick();
  expect(sent).toEqual([]);
  expect(ext.orchestrator.stats().pending).toBe(0);
});
