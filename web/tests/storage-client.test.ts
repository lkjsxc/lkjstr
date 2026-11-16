import { afterEach, expect, it, vi } from 'vitest';
import { createStorageClient } from '../src/engine/client-storage.ts';
import { createStorageMock } from '../src/engine/mock/storage.ts';
import type { FromEngine, StorageReport, ToEngine } from '../src/engine/protocol.ts';

const report: StorageReport = {
  startedAt: 10,
  finishedAt: 20,
  memory: { events: 8, eventPayloadBytes: 900, at: 10 },
  persistedEvents: { phase: 'ready', count: 23, at: 15 },
  origin: { phase: 'failed' },
};
function fixture(version = 12) {
  const sent: ToEngine[] = [];
  const client = createStorageClient({
    post: (message) => {
      sent.push(message);
    },
    listen() {},
    close() {},
  });
  if (version) client.receive({ t: 'ready', version, engine: 'fixture' });
  const req = () => {
    const message = sent.findLast((message) => message.t === 'storage.inspect');
    if (message?.t !== 'storage.inspect') throw new Error('missing inspection');
    return message.req;
  };
  return { client, sent, req };
}
afterEach(() => vi.useRealTimers());
it('keeps independent unknown components and exact counts unchanged', async () => {
  const x = fixture();
  const pending = x.client.inspect();
  x.client.receive({ t: 'storage', req: x.req(), report });
  expect(await pending).toEqual({ ok: true, report });
  expect(x.sent).toHaveLength(1);
  x.client.dispose();
});
it('bounds one request and consumes only its owned reply', async () => {
  const x = fixture();
  const first = x.client.inspect();
  expect(await x.client.inspect()).toMatchObject({ ok: false, error: { code: 'too-large' } });
  x.client.receive({ t: 'storage', req: 'other-client', report });
  expect(x.sent).toHaveLength(1);
  x.client.receive({ t: 'storage', req: x.req(), report });
  expect(await first).toEqual({ ok: true, report });
  x.client.dispose();
});
it('cancels on hide and cannot apply a late reply to a later read', async () => {
  const x = fixture();
  const first = x.client.inspect();
  const old = x.req();
  x.client.visible(false);
  expect(await first).toEqual({ ok: false, cancelled: true });
  expect(await x.client.inspect()).toEqual({ ok: false, cancelled: true });
  x.client.visible(true);
  const later = x.client.inspect();
  const fresh = x.req();
  expect(fresh).not.toBe(old);
  x.client.receive({ t: 'storage', req: old, report });
  x.client.receive({
    t: 'storage',
    req: fresh,
    report: { ...report, origin: { phase: 'timeout' } },
  });
  expect(await later).toMatchObject({ ok: true, report: { origin: { phase: 'timeout' } } });
  expect(x.sent.filter((m) => m.t === 'storage.close')).toEqual([{ t: 'storage.close', req: old }]);
  x.client.dispose();
});
it('closes on AbortSignal and disposal without another storage effect', async () => {
  const x = fixture();
  const abort = new AbortController();
  const pending = x.client.inspect({ signal: abort.signal });
  const req = x.req();
  abort.abort();
  x.client.dispose();
  expect(await pending).toEqual({ ok: false, cancelled: true });
  expect(x.sent.filter((m) => m.t === 'storage.close')).toEqual([{ t: 'storage.close', req }]);
  expect(await x.client.inspect()).toEqual({ ok: false, cancelled: true });
});
it('reconnect revokes the request without replaying across clock domains', async () => {
  const x = fixture();
  const pending = x.client.inspect();
  const old = x.req();
  x.client.receive({ t: 'reconnect' });
  expect(await pending).toMatchObject({ ok: false, error: { code: 'offline' } });
  x.client.receive({ t: 'ready', version: 12, engine: 'replacement' });
  x.client.receive({ t: 'storage', req: old, report });
  expect(x.sent.filter((m) => m.t === 'storage.inspect')).toHaveLength(1);
  x.client.dispose();
});
it('requires advertised capability and retains real admission errors', async () => {
  const x = fixture(0);
  expect(await x.client.inspect()).toMatchObject({ ok: false, error: { code: 'offline' } });
  x.client.receive({ t: 'ready', version: 11, engine: 'older' });
  expect(await x.client.inspect()).toMatchObject({ ok: false, error: { code: 'unsupported' } });
  expect(x.sent).toHaveLength(0);
  x.client.receive({ t: 'ready', version: 12, engine: 'current' });
  const pending = x.client.inspect();
  x.client.receive({ t: 'result', req: x.req(), ok: false, error: { code: 'rejected' } });
  expect(await pending).toMatchObject({ ok: false, error: { code: 'rejected' } });
  x.client.dispose();
});
it('a missing Worker reply remains a failure, never zero usage', async () => {
  vi.useFakeTimers();
  const x = fixture();
  const pending = x.client.inspect();
  await vi.advanceTimersByTimeAsync(16_000);
  expect(await pending).toEqual({ ok: false, error: { code: 'offline' } });
  expect(x.sent.filter((m) => m.t === 'storage.close')).toHaveLength(1);
  x.client.dispose();
});
it('mock reports unsupported physical observations instead of fixture disk bytes', async () => {
  const replies: FromEngine[] = [];
  let at = 10;
  const mock = createStorageMock(
    (m) => replies.push(m),
    () => at,
  );
  mock.handle({ t: 'storage.inspect', req: 'one' });
  at = 12;
  await Promise.resolve();
  expect(replies).toEqual([
    {
      t: 'storage',
      req: 'one',
      report: {
        startedAt: 10,
        finishedAt: 12,
        memory: { events: 0, eventPayloadBytes: 0, at: 10 },
        persistedEvents: { phase: 'unsupported' },
        origin: { phase: 'unsupported' },
      },
    },
  ]);
  mock.dispose();
});
it('mock close, hidden and detached owners suppress pending completions', async () => {
  const replies: FromEngine[] = [];
  const mock = createStorageMock(
    (m) => replies.push(m),
    () => 10,
  );
  mock.handle({ t: 'storage.inspect', req: 'same' });
  mock.handle({ t: 'storage.close', req: 'same' });
  mock.handle({ t: 'storage.inspect', req: 'same' });
  mock.handle({
    t: 'hint',
    hint: { visibleSubs: [], pageHidden: true, idle: false, saveData: false },
  });
  await Promise.resolve();
  expect(replies).toHaveLength(0);
  mock.handle({
    t: 'hint',
    hint: { visibleSubs: [], pageHidden: false, idle: false, saveData: false },
  });
  mock.handle({ t: 'storage.inspect', req: 'later' });
  mock.handle({ t: 'detach' });
  await Promise.resolve();
  expect(replies).toHaveLength(0);
  mock.dispose();
});
