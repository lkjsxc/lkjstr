import { afterEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { SELF } from '../src/engine/mock/people.ts';
import { MOCK_PASSWORD, mockEncrypted } from '../src/engine/mock/vault.ts';
import type { Action, FromEngine } from '../src/engine/protocol.ts';

let engine: MockEngine | undefined;
afterEach(() => {
  engine?.dispose();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  const out: FromEngine[] = [];
  engine = createMockEngine(
    (m) => out.push(m),
    () => 1700000000000,
  );
  engine.handle({
    t: 'configure',
    config: { language: 'en', heuristics: true, prefetch: true, mock: { live: false } },
  });
  let serial = 0;
  const act = (action: Action) => {
    const req = 'zap-mock-' + ++serial;
    engine?.handle({ t: 'act', req, action });
    return req;
  };
  const result = (req: string) =>
    out.filter((m): m is Extract<FromEngine, { t: 'result' }> => m.t === 'result' && m.req === req);
  const pubkey = SELF.author.pubkey;
  const invoice = () =>
    act({
      a: 'zap.invoice',
      as: pubkey,
      intent: {
        target: { k: 'profile', pubkey },
        amountMsat: 21_000,
        comment: 'fixture',
      },
    });
  return { out, act, result, pubkey, invoice };
}
it('returns an explicitly unpayable invoice only after validated mock success', async () => {
  const x = setup(),
    req = x.invoice();
  expect(x.result(req)).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(120);
  expect(x.result(req)).toHaveLength(1);
  expect(x.result(req)[0]?.zapIntent).toMatchObject({ state: 'unpaid', amountMsat: 21_000 });
  expect(x.result(req)[0]?.zapIntent?.invoices[0]?.invoice).toMatch(/^mock-zap-invoice:/);
});
it('failed unlock does not revoke work; committed lock revokes before its acknowledgement', async () => {
  const x = setup();
  x.act({ a: 'account.importEncrypted', key: mockEncrypted(x.pubkey), password: MOCK_PASSWORD });
  const retained = x.invoice();
  const failed = x.act({ a: 'account.unlock', pubkey: x.pubkey, password: 'wrong' });
  expect(x.result(failed)[0]?.ok).toBe(false);
  await vi.advanceTimersByTimeAsync(120);
  expect(x.result(retained)[0]?.ok).toBe(true);
  const cancelled = x.invoice();
  const lock = x.act({ a: 'account.lock', pubkey: x.pubkey });
  expect(x.result(cancelled)).toEqual([
    { t: 'result', req: cancelled, ok: false, error: { code: 'signer-missing' } },
  ]);
  expect(x.out.indexOf(x.result(cancelled)[0]!)).toBeLessThan(x.out.indexOf(x.result(lock)[0]!));
  await vi.advanceTimersByTimeAsync(120);
  expect(x.result(cancelled)).toHaveLength(1);
});
it('close cancels once and detach releases jobs without posting a stale invoice', async () => {
  const x = setup(),
    cancelled = x.invoice();
  engine?.handle({ t: 'zap.close', req: cancelled });
  engine?.handle({ t: 'zap.close', req: cancelled });
  expect(x.result(cancelled)).toEqual([
    { t: 'result', req: cancelled, ok: false, cancelled: true },
  ]);
  const detached = x.invoice();
  engine?.handle({ t: 'detach' });
  await vi.advanceTimersByTimeAsync(120);
  expect(x.result(cancelled)).toHaveLength(1);
  expect(x.result(detached)).toHaveLength(0);
});

it('ignores duplicate active invoice ownership without a contradictory terminal', async () => {
  const x = setup(),
    req = x.invoice();
  engine?.handle({
    t: 'act',
    req,
    action: {
      a: 'zap.invoice',
      as: x.pubkey,
      intent: { target: { k: 'profile', pubkey: x.pubkey }, amountMsat: 21000, comment: 'fixture' },
    },
  });
  expect(x.result(req)).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(120);
  expect(x.result(req)).toHaveLength(1);
  expect(x.result(req)[0]?.ok).toBe(true);
});

it('a closed query callback cannot settle a reused request owner', async () => {
  const x = setup(),
    req = 'reused-query';
  engine?.handle({
    t: 'zap.quote',
    req,
    query: { target: { k: 'profile', pubkey: '0'.repeat(64) } },
  });
  await vi.advanceTimersByTimeAsync(60);
  engine?.handle({ t: 'zap.close', req });
  engine?.handle({ t: 'zap.quote', req, query: { target: { k: 'profile', pubkey: x.pubkey } } });
  await vi.advanceTimersByTimeAsync(60);
  const terminal = () =>
    x.out.filter((m) => m.t === 'zap.quote' && m.req === req && m.quote.phase !== 'loading');
  expect(terminal()).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(60);
  expect(terminal()).toHaveLength(1);
  expect(terminal()[0]).toMatchObject({ quote: { phase: 'ready', target: { pubkey: x.pubkey } } });
});
