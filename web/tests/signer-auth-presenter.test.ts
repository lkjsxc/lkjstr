import { afterEach, expect, it, vi } from 'vitest';
import { createSignerAuthClient } from '../src/engine/client-signer-auth.ts';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';

afterEach(() => vi.useRealTimers());
function fixture() {
  const sent: ToEngine[] = [];
  const auth = createSignerAuthClient({
    post: (message) => {
      sent.push(message);
    },
    listen() {},
    close() {},
  });
  return { auth, sent };
}
const challenge = (id = 'owned'): Extract<FromEngine, { t: 'signer.auth' }> => ({
  t: 'signer.auth',
  id,
  peer: 'a'.repeat(64),
  method: 'connect',
  url: 'https://signer.invalid/authorize?token=fixture',
  expiresAt: Date.now() + 60_000,
});

it('rejects an unavailable authorization surface without retaining a hidden wait', () => {
  vi.useFakeTimers();
  const { auth, sent } = fixture();
  try {
    expect(auth.receive(challenge())).toBe(true);
    expect([...sent]).toEqual([{ t: 'signer.auth.cancel', id: 'owned', reason: 'unsupported' }]);
    expect(auth.pending.get()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    auth.dispose();
  }
});

it('keeps a challenge while a presenter remains and releases it with the last presenter', () => {
  vi.useFakeTimers();
  const { auth, sent } = fixture();
  const first = auth.pending.subscribe(() => {});
  const second = auth.pending.subscribe(() => {});
  try {
    auth.receive(challenge());
    expect(auth.pending.get()).toHaveLength(1);
    first();
    first();
    expect([...sent]).toEqual([]);
    expect(auth.pending.get()).toHaveLength(1);
    second();
    expect([...sent]).toEqual([{ t: 'signer.auth.cancel', id: 'owned', reason: 'unsupported' }]);
    expect(auth.pending.get()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    auth.receive(challenge('late'));
    expect(sent.at(-1)).toEqual({ t: 'signer.auth.cancel', id: 'late', reason: 'unsupported' });
    expect(auth.pending.get()).toEqual([]);
  } finally {
    first();
    second();
    auth.dispose();
  }
});

it('does not send another cancellation after client disposal and presenter release', () => {
  vi.useFakeTimers();
  const { auth, sent } = fixture(),
    off = auth.pending.subscribe(() => {});
  auth.receive(challenge());
  auth.dispose();
  off();
  off();
  auth.receive(challenge('late'));
  expect([...sent]).toEqual([{ t: 'signer.auth.cancel', id: 'owned' }]);
  expect(auth.pending.get()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});

it('settles the existing mock action as unsupported when no presenter is registered', () => {
  vi.useFakeTimers();
  let auth: ReturnType<typeof createSignerAuthClient>;
  const mock = createMockEngine((message) => {
    auth?.receive(message);
  });
  auth = createSignerAuthClient({
    post: (message) => mock.handle(message),
    listen() {},
    close() {},
  });
  const complete = vi.fn();
  const baselineTimers = vi.getTimerCount();
  try {
    const { t: _type, id: _id, expiresAt: _expires, ...intent } = challenge();
    mock.authorization.start(intent, complete);
    expect(complete).toHaveBeenCalledExactlyOnceWith('unsupported');
    expect(auth.pending.get()).toEqual([]);
    expect(vi.getTimerCount()).toBe(baselineTimers);
  } finally {
    auth.dispose();
    mock.dispose();
  }
  expect(vi.getTimerCount()).toBe(0);
});
