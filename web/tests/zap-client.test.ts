import { afterEach, expect, it, vi } from 'vitest';
import { createEngine, type Transport } from '../src/engine/client.ts';
import { createZapClient } from '../src/engine/client-zaps.ts';
import type { FromEngine, ToEngine, ZapQuote, ZapTarget } from '../src/engine/protocol.ts';

const target: ZapTarget = { k: 'profile', pubkey: '2'.repeat(64) };
afterEach(() => vi.useRealTimers());
it('closes a finite quote exactly once and ignores late answers', () => {
  vi.useFakeTimers();
  const sent: ToEngine[] = [],
    receive = vi.fn();
  const client = createZapClient({
    post: (m) => {
      sent.push(m);
    },
    listen() {},
    close() {},
  });
  const query = client.quote({ target }, receive);
  const quote: ZapQuote = { target, phase: 'loading', error: null, recipients: [] };
  client.receive({ t: 'zap.quote', req: query.id, quote });
  expect(receive).toHaveBeenCalledTimes(1);
  expect(sent.filter((m) => m.t === 'zap.close')).toHaveLength(0);
  client.receive({
    t: 'zap.quote',
    req: query.id,
    quote: { ...quote, phase: 'unsupported', error: 'unsupported' },
  });
  client.receive({ t: 'zap.quote', req: query.id, quote });
  query.close();
  client.dispose();
  expect(receive).toHaveBeenCalledTimes(2);
  expect(sent.filter((m) => m.t === 'zap.close')).toEqual([{ t: 'zap.close', req: query.id }]);
});
it('bounds pending reads and reports a lost reply as failure', async () => {
  vi.useFakeTimers();
  const sent: ToEngine[] = [],
    receive = vi.fn();
  const client = createZapClient({
    post: (m) => {
      sent.push(m);
    },
    listen() {},
    close() {},
  });
  for (let n = 0; n < 16; n++) client.quote({ target }, receive);
  expect(() => client.quote({ target }, receive)).toThrow('zap query limit');
  await vi.advanceTimersByTimeAsync(25_000);
  expect(receive).toHaveBeenCalledTimes(16);
  expect(receive.mock.calls[0]?.[0]).toMatchObject({ phase: 'failed', error: 'network' });
  expect(sent.filter((m) => m.t === 'zap.close')).toHaveLength(16);
  client.dispose();
});
function connected() {
  const sent: ToEngine[] = [];
  let receive: (msg: FromEngine) => void = () => {};
  const transport: Transport = {
    post: (m) => {
      sent.push(m);
    },
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  };
  const engine = createEngine(transport);
  return { engine, sent, receive: (msg: FromEngine) => receive(msg) };
}
const intent = { target, amountMsat: 21_000, comment: 'fixture' };
it('cancels invoice ownership before allowing any queued extension dialog', async () => {
  const x = connected(),
    abort = new AbortController(),
    signEvent = vi.fn(async () => ({}));
  (window as { nostr?: unknown }).nostr = { signEvent };
  try {
    const result = x.engine.act(
      { a: 'zap.invoice', as: '1'.repeat(64), intent },
      { zapSignal: abort.signal },
    );
    const action = x.sent.find((m) => m.t === 'act');
    if (action?.t !== 'act') throw new Error('missing invoice action');
    abort.abort();
    abort.abort();
    expect(x.sent.filter((m) => m.t === 'zap.close')).toEqual([
      { t: 'zap.close', req: action.req },
    ]);
    x.receive({
      t: 'sign',
      req: 'late-zap',
      actionReq: action.req,
      pubkey: '1'.repeat(64),
      event: '{}',
    });
    await Promise.resolve();
    expect(signEvent).not.toHaveBeenCalled();
    x.receive({ t: 'result', req: action.req, ok: false, cancelled: true });
    expect(await result).toMatchObject({ ok: false, cancelled: true });
  } finally {
    delete (window as { nostr?: unknown }).nostr;
    x.engine.dispose();
  }
});
it('bounds invoice reply waiting without submitting a payment', async () => {
  vi.useFakeTimers();
  const x = connected();
  try {
    const result = x.engine.act({ a: 'zap.invoice', as: '1'.repeat(64), intent });
    await vi.advanceTimersByTimeAsync(95_000);
    expect(await result).toMatchObject({ ok: false, error: { code: 'offline' } });
    expect(x.sent.filter((m) => m.t === 'zap.close')).toHaveLength(1);
    expect(x.sent.filter((m) => m.t === 'act')).toHaveLength(1);
  } finally {
    x.engine.dispose();
  }
});

it('gates and deduplicates current reading hints without changing retained windows', () => {
  const x = connected();
  const sub = x.engine.open({ source: 'global' }, { rows() {}, patch() {} });
  try {
    sub.reading?.('middle');
    x.receive({ t: 'ready', engine: 'fixture', version: 8 });
    sub.reading?.('middle');
    expect(x.sent.filter((m) => m.t === 'reading')).toHaveLength(0);
    x.receive({ t: 'ready', engine: 'fixture', version: 9 });
    sub.reading?.('middle');
    sub.reading?.('middle');
    sub.reading?.('new-middle');
    sub.reading?.(null);
    expect(x.sent.filter((m) => m.t === 'reading')).toEqual([
      { t: 'reading', sub: sub.id, key: 'middle' },
      { t: 'reading', sub: sub.id, key: 'new-middle' },
      { t: 'reading', sub: sub.id, key: null },
    ]);
    expect(x.sent.filter((m) => m.t === 'window')).toHaveLength(0);
    sub.close();
    sub.reading?.('after-close');
    expect(x.sent.filter((m) => m.t === 'reading')).toHaveLength(3);
  } finally {
    x.engine.dispose();
  }
});
