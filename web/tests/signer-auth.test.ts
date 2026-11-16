import { afterEach, expect, it, vi } from 'vitest';
import { createSignerAuthClient } from '../src/engine/client-signer-auth.ts';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine, SignerAuthorization, ToEngine } from '../src/engine/protocol.ts';

afterEach(() => vi.useRealTimers());
const intent = (id = 'one'): Extract<FromEngine, { t: 'signer.auth' }> => ({
  t: 'signer.auth',
  id,
  peer: 'a'.repeat(64),
  method: 'sign_event',
  url: 'https://signer.invalid/auth?token=fixture',
  expiresAt: Date.now() + 60_000,
});
function fixture() {
  const sent: ToEngine[] = [];
  const auth = createSignerAuthClient({
    post: (m) => {
      sent.push(m);
    },
    listen() {},
    close() {},
  });
  return { sent, auth };
}
it('keeps an auth intent ephemeral and cancels only a currently owned handle', () => {
  vi.useFakeTimers();
  localStorage.clear();
  const { auth, sent } = fixture();
  const opened = vi.spyOn(window, 'open');
  try {
    auth.receive(intent());
    auth.cancel('unknown');
    auth.cancel('one');
    expect(sent).toEqual([{ t: 'signer.auth.cancel', id: 'one' }]);
    expect(auth.pending.get()).toHaveLength(1);
    auth.receive({ t: 'signer.auth.clear', id: 'one' });
    expect(auth.pending.get()).toEqual([]);
    expect(opened).not.toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain('token');
  } finally {
    auth.dispose();
    opened.mockRestore();
  }
});
it('deduplicates challenges without extending the original deadline', async () => {
  vi.useFakeTimers();
  const { auth } = fixture();
  const changed = vi.fn();
  const off = auth.pending.subscribe(changed),
    first = intent();
  auth.receive(first);
  auth.receive(first);
  expect(changed).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30_000);
  auth.receive({ ...first, url: first.url + '&step=2', expiresAt: Date.now() + 60_000 });
  expect(auth.pending.get()[0]?.expiresAt).toBe(first.expiresAt);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(auth.pending.get()).toEqual([]);
  off();
  auth.dispose();
});
it('connection loss and disposal erase intents instead of replaying authorization tokens', () => {
  vi.useFakeTimers();
  const { auth, sent } = fixture();
  auth.receive(intent());
  auth.receive({ t: 'reconnect' });
  expect(auth.pending.get()).toEqual([]);
  expect(sent).toEqual([]);
  auth.receive({ t: 'ready', version: 11, engine: 'fixture' });
  auth.receive(intent('two'));
  auth.dispose();
  auth.receive(intent('late'));
  expect(auth.pending.get()).toEqual([]);
  expect(sent).toEqual([{ t: 'signer.auth.cancel', id: 'two' }]);
});
it('bounds retained intents and drops an account-bound intent after authority disappears', () => {
  vi.useFakeTimers();
  const { auth, sent } = fixture();
  for (let n = 0; n < 17; n++) auth.receive({ ...intent(String(n)), account: 'b'.repeat(64) });
  expect(auth.pending.get()).toHaveLength(16);
  expect(sent).toContainEqual({ t: 'signer.auth.cancel', id: '16' });
  auth.receive({ t: 'accounts', accounts: [] });
  expect(auth.pending.get()).toEqual([]);
  auth.dispose();
});
it('mock authorization is an explicit fixture and clears before the terminal callback', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [];
  const mock = createMockEngine((m) => out.push(m));
  const { t: _type, id: _id, expiresAt: _expiry, ...input } = intent();
  const done = vi.fn(() => expect(out.at(-1)?.t).toBe('signer.auth.clear'));
  const id = mock.authorization.start(input, done);
  if (!id) throw Error('mock challenge missing');
  mock.handle({ t: 'signer.auth.cancel', id: 'unknown' });
  expect(done).not.toHaveBeenCalled();
  mock.handle({ t: 'signer.auth.cancel', id, reason: 'unsupported' });
  expect(done).toHaveBeenCalledExactlyOnceWith('unsupported');
  mock.authorization.challenge(id, input.url + '&late');
  expect(out.filter((m) => m.t === 'signer.auth')).toHaveLength(1);
  mock.dispose();
});
it('mock changed challenges keep the deadline and stop at the fourth URL', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [];
  const mock = createMockEngine((m) => out.push(m));
  const done = vi.fn(),
    input: Omit<SignerAuthorization, 'id' | 'expiresAt'> = {
      peer: 'a'.repeat(64),
      method: 'connect',
      url: 'https://signer.invalid/?step=0',
    };
  const id = mock.authorization.start(input, done);
  if (!id) throw Error('mock challenge missing');
  mock.authorization.challenge(id, input.url);
  for (let n = 1; n <= 4; n++)
    mock.authorization.challenge(id, `https://signer.invalid/?step=${n}`);
  const urls = out.filter((m) => m.t === 'signer.auth');
  expect(urls).toHaveLength(4);
  expect(new Set(urls.map((m) => m.expiresAt)).size).toBe(1);
  expect(done).toHaveBeenCalledExactlyOnceWith('too-large');
  mock.dispose();
});

it('mock account revocation clears the exact account intent and retains pending discovery', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [],
    mock = createMockEngine((m) => out.push(m));
  const revoked = vi.fn(),
    discovery = vi.fn();
  mock.authorization.start(
    {
      peer: 'a'.repeat(64),
      method: 'sign_event',
      account: 'b'.repeat(64),
      url: 'https://signer.invalid/auth',
    },
    revoked,
  );
  mock.authorization.start(
    { peer: 'a'.repeat(64), method: 'connect', url: 'https://signer.invalid/auth' },
    discovery,
  );
  mock.authorization.observe({ t: 'accounts', accounts: [] });
  expect(revoked).toHaveBeenCalledExactlyOnceWith('offline');
  expect(discovery).not.toHaveBeenCalled();
  mock.dispose();
});
it('mock refuses unsafe challenge URLs without emitting or opening them', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [],
    mock = createMockEngine((m) => out.push(m));
  for (const url of [
    'javascript:alert(1)',
    'http://remote.invalid/auth',
    'https://user@remote.invalid/auth',
    'https://remote.invalid/a b',
  ]) {
    const done = vi.fn();
    mock.authorization.start({ peer: 'a'.repeat(64), method: 'connect', url }, done);
    expect(done).toHaveBeenCalledExactlyOnceWith('signer-refused');
  }
  expect(out.filter((m) => m.t === 'signer.auth')).toEqual([]);
  mock.dispose();
});
