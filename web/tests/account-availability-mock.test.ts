import { afterEach, expect, it, vi } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import { type FromEngine, PROTOCOL_VERSION } from '../src/engine/protocol.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
  vi.useRealTimers();
});
function fixture(failed = false) {
  const out: FromEngine[] = [];
  const mock = createMockEngine(
    (message) => out.push(message),
    () => 1000,
    failed ? { accountError: 'internal' } : {},
  );
  cleanup.push(() => mock.dispose());
  return { out, mock };
}
it('keeps the normal mock handshake omission-compatible and sends actual fixture Accounts', () => {
  vi.useFakeTimers();
  const { out, mock } = fixture();
  mock.handle({
    t: 'configure',
    config: {
      language: 'en',
      heuristics: true,
      prefetch: true,
      mock: { live: false, accounts: 'none' },
    },
  });
  expect(out.find((message) => message.t === 'ready')).toEqual({
    t: 'ready',
    version: PROTOCOL_VERSION,
    engine: 'mock',
  });
  expect(out.find((message) => message.t === 'accounts')).toMatchObject({ accounts: [] });
});
it('fails early and future actions and subscriptions with no account or signer output', () => {
  vi.useFakeTimers();
  const { out, mock } = fixture(true);
  mock.handle({ t: 'act', req: 'early', action: { a: 'account.add', how: 'extension' } });
  mock.handle({ t: 'open', sub: 'early-view', query: { source: 'home' } });
  vi.advanceTimersByTime(100);
  mock.handle({ t: 'act', req: 'future', action: { a: 'account.add', how: 'create' } });
  mock.handle({ t: 'open', sub: 'future-view', query: { source: 'global' } });
  expect(out.find((message) => message.t === 'ready')).toEqual({
    t: 'ready',
    version: PROTOCOL_VERSION,
    engine: 'mock',
    accountError: { code: 'internal' },
  });
  expect(out.filter((message) => message.t === 'result')).toEqual([
    { t: 'result', req: 'early', ok: false, error: { code: 'internal' } },
    { t: 'result', req: 'future', ok: false, error: { code: 'internal' } },
  ]);
  expect(out.filter((message) => message.t === 'state')).toHaveLength(2);
  expect(
    out
      .filter((message) => message.t === 'state')
      .every((message) => message.state.phase === 'failed' && message.state.error === 'internal'),
  ).toBe(true);
  expect(
    out.some((message) =>
      ['accounts', 'rows', 'getPublicKey', 'sign', 'crypt'].includes(message.t),
    ),
  ).toBe(false);
});
it('does not restart a failed mock after its owner detaches', () => {
  vi.useFakeTimers();
  const { out, mock } = fixture(true);
  mock.handle({ t: 'detach' });
  vi.advanceTimersByTime(100);
  mock.handle({ t: 'act', req: 'late', action: { a: 'account.add', how: 'create' } });
  expect(out).toEqual([]);
});
